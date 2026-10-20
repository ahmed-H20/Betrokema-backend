const { Warehouse, StockTransfer } = require("./model");
const Product = require("../products/model");
const ApiError = require("../../utils/ApiError");

// ==========================================
// 1. Top 3 KPI Cards Stats
// ==========================================
const getWarehousesStats = async (req, res, next) => {
    try {
        const warehouses = await Warehouse.find();

        // 1. Warehouses count & quick summary
        const totalWarehouses = warehouses.length;
        const activeWarehouses = warehouses.filter((w) => w.isActive).length;
        const warehouseNames = warehouses.map((w) => {
            // Shorten name e.g. "مستودع العاشر من رمضان المركزي" -> "العاشر"
            const name = w.name;
            if (name.includes("العاشر")) return "العاشر";
            if (name.includes("السادات")) return "السادات";
            if (name.includes("برج العرب")) return "برج العرب";
            if (name.includes("أسيوط")) return "أسيوط";
            return w.governorate || name.split(" ")[1] || name;
        });

        // 2. Stock and Chemicals summary
        let totalUnits = 0;
        let totalPalletsOccupied = 0;
        let totalCapacityPallets = 0;
        let criticalStockItemsCount = 0;
        const activeProductIds = new Set();

        warehouses.forEach((w) => {
            totalPalletsOccupied += w.occupiedPallets || 0;
            totalCapacityPallets += w.capacityPallets || 0;

            if (Array.isArray(w.inventory)) {
                w.inventory.forEach((item) => {
                    totalUnits += item.currentStock || 0;
                    if (item.product) {
                        activeProductIds.add(item.product.toString());
                    }
                    if (item.currentStock <= (item.reorderLevel || 0)) {
                        criticalStockItemsCount++;
                    }
                });
            }
        });

        // If no products in warehouses yet, fallback to general product catalog count
        let totalActiveProducts = activeProductIds.size;
        if (totalActiveProducts === 0) {
            totalActiveProducts = await Product.countDocuments();
        }

        const overallOccupancyRate = totalCapacityPallets > 0
            ? Math.round((totalPalletsOccupied / totalCapacityPallets) * 100)
            : 0;

        // 3. Stock Transfers & Critical Alerts
        const pendingTransfers = await StockTransfer.countDocuments({ status: "pending" });

        res.status(200).json({
            status: "success",
            data: {
                warehouses: {
                    total: totalWarehouses,
                    active: activeWarehouses,
                    branches: warehouseNames,
                    displaySummary: warehouseNames.join("، "),
                },
                stockAndChemicals: {
                    totalUnits,
                    activeProductsCount: totalActiveProducts,
                    unitLabel: "وحدة / بستلة وجالون",
                    totalPalletsOccupied,
                    totalCapacityPallets,
                    occupancyRate: overallOccupancyRate,
                    subtitle: `موزعة عبر ${totalActiveProducts} كود منتج نشط`,
                },
                transfersAndCritical: {
                    pendingTransfers,
                    criticalStockItemsCount,
                    pendingTransfersText: `${pendingTransfers} طلبات مناقلة معلقة`,
                    actionRequired: "يتطلب اعتماد مسؤول الإمداد اللوجستي",
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// 2. Get All Warehouses (مع بطاقات المستودعات الإقليمية)
// ==========================================
const getAllWarehouses = async (req, res, next) => {
    try {
        const { filter, search, governorate } = req.query;

        const query = {};

        if (filter === "active") {
            query.isActive = true;
        }

        if (governorate) {
            query.governorate = { $regex: governorate, $options: "i" };
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { code: { $regex: search, $options: "i" } },
                { governorate: { $regex: search, $options: "i" } },
                { supervisorName: { $regex: search, $options: "i" } },
            ];
        }

        const [warehouses, totalAll, totalActive] = await Promise.all([
            Warehouse.find(query).sort({ createdAt: -1 }),
            Warehouse.countDocuments(),
            Warehouse.countDocuments({ isActive: true }),
        ]);

        const formattedWarehouses = warehouses.map((w) => {
            const wObj = w.toObject({ virtuals: true });
            return {
                ...wObj,
                occupancyRate: w.occupancyRate,
                linkedProductsCount: w.linkedProductsCount,
                actualStockUnits: w.actualStockUnits,
            };
        });

        res.status(200).json({
            status: "success",
            results: formattedWarehouses.length,
            counts: {
                all: totalAll,
                active: totalActive,
            },
            data: formattedWarehouses,
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// 3. Get Single Warehouse
// ==========================================
const getWarehouseById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const warehouse = await Warehouse.findById(id).populate({
            path: "inventory.product",
            select: "name code description category packages",
            populate: { path: "category", select: "name" },
        });

        if (!warehouse) {
            return next(new ApiError(`لا يوجد مستودع بهذا المعرف: ${id}`, 404));
        }

        const wObj = warehouse.toObject({ virtuals: true });

        res.status(200).json({
            status: "success",
            data: {
                ...wObj,
                occupancyRate: warehouse.occupancyRate,
                linkedProductsCount: warehouse.linkedProductsCount,
                actualStockUnits: warehouse.actualStockUnits,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// 4. Create New Warehouse (نموذج إضافة مخزن جديد)
// ==========================================
const createWarehouse = async (req, res, next) => {
    try {
        const {
            name,
            code,
            governorate,
            address,
            supervisorName,
            supervisorPhone,
            emergencyPhone,
            capacityPallets,
            occupiedPallets,
            operatingClassification,
            isActive,
            status,
            notes,
        } = req.body;

        if (!name) return next(new ApiError("اسم المستودع / الفرع مطلوب", 400));
        if (!governorate) return next(new ApiError("المحافظة الإقليمية مطلوبة", 400));
        if (!address) return next(new ApiError("العنوان التفصيلي ومجمع المخازن مطلوب", 400));

        let warehouseCode = code;
        if (!warehouseCode) {
            const count = await Warehouse.countDocuments();
            const govAbbr = governorate.includes("شرقية") || governorate.includes("العاشر")
                ? "10R"
                : governorate.includes("سادات") || governorate.includes("منوفية")
                ? "SAD"
                : governorate.includes("إسكندرية") || governorate.includes("برج")
                ? "BRG"
                : governorate.includes("أسيوط")
                ? "ASY"
                : "GEN";
            warehouseCode = `WH-EGY-${govAbbr}-${String(count + 1).padStart(2, "0")}`;
        }

        const newWarehouse = await Warehouse.create({
            name,
            code: warehouseCode,
            governorate,
            address,
            supervisorName: supervisorName || "",
            supervisorPhone: supervisorPhone || "",
            emergencyPhone: emergencyPhone || "",
            capacityPallets: Number(capacityPallets) || 2000,
            occupiedPallets: Number(occupiedPallets) || 0,
            operatingClassification: operatingClassification || "مستودع رئيسي",
            isActive: typeof isActive === "boolean" ? isActive : true,
            status: status || "نشط",
            notes: notes || "",
            inventory: [],
        });

        res.status(201).json({
            status: "success",
            message: "تم حفظ وتثبيت المستودع بنجاح",
            data: newWarehouse,
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// 5. Update Warehouse
// ==========================================
const updateWarehouse = async (req, res, next) => {
    try {
        const { id } = req.params;
        const warehouse = await Warehouse.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true,
        });

        if (!warehouse) {
            return next(new ApiError(`لا يوجد مستودع بهذا المعرف: ${id}`, 404));
        }

        res.status(200).json({
            status: "success",
            message: "تم تحديث بيانات المستودع بنجاح",
            data: warehouse,
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// 6. Delete Warehouse
// ==========================================
const deleteWarehouse = async (req, res, next) => {
    try {
        const { id } = req.params;
        const warehouse = await Warehouse.findByIdAndDelete(id);

        if (!warehouse) {
            return next(new ApiError(`لا يوجد مستودع بهذا المعرف: ${id}`, 404));
        }

        res.status(200).json({
            status: "success",
            message: "تم حذف المستودع بنجاح",
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// 7. Get Warehouse Inventory (جدول توزيع المنتجات والكميات المخزنية)
// ==========================================
const getWarehouseInventory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { search, status, page = 1, limit = 10 } = req.query;

        const warehouse = await Warehouse.findById(id).populate({
            path: "inventory.product",
            select: "name code description category packages quantity",
            populate: { path: "category", select: "name" },
        });

        if (!warehouse) {
            return next(new ApiError(`المستودع غير موجود برقم: ${id}`, 404));
        }

        let items = warehouse.inventory || [];

        // Filter by Search (Product Name, SKU, binLocation)
        if (search) {
            const s = search.toLowerCase();
            items = items.filter((item) => {
                const pName = (item.productName || item.product?.name || "").toLowerCase();
                const pSku = (item.sku || item.product?.code || "").toLowerCase();
                const bin = (item.binLocation || "").toLowerCase();
                return pName.includes(s) || pSku.includes(s) || bin.includes(s);
            });
        }

        // Filter by stockStatus (critical, available)
        if (status === "critical") {
            items = items.filter((item) => item.currentStock <= item.reorderLevel);
        } else if (status === "available") {
            items = items.filter((item) => item.currentStock > item.reorderLevel);
        }

        const totalItems = items.length;
        const startIndex = (Number(page) - 1) * Number(limit);
        const paginatedItems = items.slice(startIndex, startIndex + Number(limit));

        const formattedList = paginatedItems.map((item) => {
            const p = item.product || {};
            const isCritical = (item.currentStock || 0) <= (item.reorderLevel || 0);

            return {
                _id: item._id,
                productId: p._id || item.product,
                productName: item.productName || p.name || "منتج غير محدد",
                productDescription: p.description || "",
                categoryName: p.category?.name || "عام",
                sku: item.sku || p.code || "SKU-N/A",
                packagingUnit: item.packagingUnit || "بستلة 14 لتر",
                binLocation: item.binLocation || "A-01-P01",
                currentStock: item.currentStock || 0,
                reorderLevel: item.reorderLevel || 50,
                stockStatus: isCritical ? "رصيد حرج (إعادة طلب)" : item.stockStatus || "متوفر بكثافة",
                isCritical,
                lastAuditedAt: item.lastAuditedAt,
                notes: item.notes || "",
            };
        });

        res.status(200).json({
            status: "success",
            warehouseId: warehouse._id,
            warehouseName: warehouse.name,
            totalItemsInWarehouse: warehouse.inventory.length,
            filteredCount: totalItems,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(totalItems / Number(limit)) || 1,
            },
            data: formattedList,
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// 8. Assign / Add Product to Warehouse (تخصيص منتج للمخزن)
// ==========================================
const assignProductToWarehouse = async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            productId,
            sku,
            packagingUnit,
            binLocation,
            currentStock,
            reorderLevel,
            notes,
        } = req.body;

        if (!productId) {
            return next(new ApiError("معرف المنتج (productId) مطلوب", 400));
        }

        const warehouse = await Warehouse.findById(id);
        if (!warehouse) {
            return next(new ApiError(`المستودع غير موجود برقم: ${id}`, 404));
        }

        const product = await Product.findById(productId);
        if (!product) {
            return next(new ApiError(`المنتج غير موجود برقم: ${productId}`, 404));
        }

        // Check if product already exists in this warehouse
        const existingItemIndex = warehouse.inventory.findIndex(
            (item) => item.product.toString() === productId.toString()
        );

        const stockNum = Number(currentStock) || 0;
        const reorderNum = Number(reorderLevel) || 50;

        let stockStatus = "متوفر";
        if (stockNum === 0) stockStatus = "نفد الرصيد";
        else if (stockNum <= reorderNum) stockStatus = "رصيد حرج (إعادة طلب)";
        else if (stockNum > reorderNum * 3) stockStatus = "متوفر بكثافة";

        if (existingItemIndex > -1) {
            // Update existing assignment
            warehouse.inventory[existingItemIndex].currentStock = stockNum;
            warehouse.inventory[existingItemIndex].reorderLevel = reorderNum;
            warehouse.inventory[existingItemIndex].stockStatus = stockStatus;
            if (binLocation) warehouse.inventory[existingItemIndex].binLocation = binLocation;
            if (sku) warehouse.inventory[existingItemIndex].sku = sku;
            if (packagingUnit) warehouse.inventory[existingItemIndex].packagingUnit = packagingUnit;
            if (notes) warehouse.inventory[existingItemIndex].notes = notes;
        } else {
            // Push new assignment
            warehouse.inventory.push({
                product: productId,
                productName: product.name,
                sku: sku || product.code || "SKU-N/A",
                packagingUnit: packagingUnit || "بستلة 14 لتر",
                binLocation: binLocation || "A-01-P01",
                currentStock: stockNum,
                reorderLevel: reorderNum,
                stockStatus,
                notes: notes || "",
            });
        }

        await warehouse.save();

        res.status(200).json({
            status: "success",
            message: "تم تخصيص المنتج داخل المستودع وتحديث موقعه التخزيني بنجاح",
            data: warehouse,
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// 9. Update Single Inventory Item in Warehouse
// ==========================================
const updateWarehouseInventoryItem = async (req, res, next) => {
    try {
        const { id, itemId } = req.params;
        const { binLocation, currentStock, reorderLevel, packagingUnit, notes, sku } = req.body;

        const warehouse = await Warehouse.findById(id);
        if (!warehouse) {
            return next(new ApiError(`المستودع غير موجود برقم: ${id}`, 404));
        }

        const item = warehouse.inventory.id(itemId);
        if (!item) {
            return next(new ApiError(`العنصر غير موجود في مخزون المستودع: ${itemId}`, 404));
        }

        if (binLocation !== undefined) item.binLocation = binLocation;
        if (sku !== undefined) item.sku = sku;
        if (packagingUnit !== undefined) item.packagingUnit = packagingUnit;
        if (notes !== undefined) item.notes = notes;
        if (currentStock !== undefined) item.currentStock = Number(currentStock);
        if (reorderLevel !== undefined) item.reorderLevel = Number(reorderLevel);

        // Recalculate status
        if (item.currentStock === 0) item.stockStatus = "نفد الرصيد";
        else if (item.currentStock <= item.reorderLevel) item.stockStatus = "رصيد حرج (إعادة طلب)";
        else if (item.currentStock > item.reorderLevel * 3) item.stockStatus = "متوفر بكثافة";
        else item.stockStatus = "متوفر";

        item.lastAuditedAt = new Date();

        await warehouse.save();

        res.status(200).json({
            status: "success",
            message: "تم تحديث بيانات الصنف المخزني بنجاح",
            data: item,
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// 10. Delete Inventory Item from Warehouse
// ==========================================
const removeProductFromWarehouse = async (req, res, next) => {
    try {
        const { id, itemId } = req.params;

        const warehouse = await Warehouse.findById(id);
        if (!warehouse) {
            return next(new ApiError(`المستودع غير موجود برقم: ${id}`, 404));
        }

        warehouse.inventory = warehouse.inventory.filter(
            (item) => item._id.toString() !== itemId.toString()
        );

        await warehouse.save();

        res.status(200).json({
            status: "success",
            message: "تم إزالة تخصيص المنتج من المستودع بنجاح",
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// 11. Stock Transfers (المناقلات بين المستودعات)
// ==========================================
const getStockTransfers = async (req, res, next) => {
    try {
        const { status } = req.query;
        const query = status ? { status } : {};

        const transfers = await StockTransfer.find(query)
            .populate("fromWarehouse", "name code governorate")
            .populate("toWarehouse", "name code governorate")
            .populate("items.product", "name code")
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: "success",
            results: transfers.length,
            data: transfers,
        });
    } catch (error) {
        next(error);
    }
};

const createStockTransfer = async (req, res, next) => {
    try {
        const { fromWarehouse, toWarehouse, items, requestedBy, notes } = req.body;

        if (!fromWarehouse || !toWarehouse) {
            return next(new ApiError("يجب تحديد المستودع المصدر والمستودع الوجهة", 400));
        }

        if (fromWarehouse === toWarehouse) {
            return next(new ApiError("لا يمكن إنشاء مناقلة لنفس المستودع", 400));
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return next(new ApiError("يجب تحديد صنف واحد على الأقل في أمر المناقلة", 400));
        }

        const transfer = await StockTransfer.create({
            fromWarehouse,
            toWarehouse,
            items,
            requestedBy: requestedBy || "مسؤول اللوجستيات والتوزيع",
            notes: notes || "",
            status: "pending",
        });

        res.status(201).json({
            status: "success",
            message: "تم إنشاء طلب المناقلة بنجاح وهو بانتظار الاعتماد اللوجستي",
            data: transfer,
        });
    } catch (error) {
        next(error);
    }
};

const updateStockTransferStatus = async (req, res, next) => {
    try {
        const { transferId } = req.params;
        const { status, approvedBy } = req.body;

        const transfer = await StockTransfer.findById(transferId);
        if (!transfer) {
            return next(new ApiError(`طلب المناقلة غير موجود: ${transferId}`, 404));
        }

        if (status === "approved" || status === "completed") {
            // Apply balance shifts between warehouses
            const fromWh = await Warehouse.findById(transfer.fromWarehouse);
            const toWh = await Warehouse.findById(transfer.toWarehouse);

            if (fromWh && toWh) {
                transfer.items.forEach((item) => {
                    // Deduct from fromWarehouse
                    const fromItem = fromWh.inventory.find(
                        (inv) => inv.product.toString() === item.product.toString()
                    );
                    if (fromItem) {
                        fromItem.currentStock = Math.max(0, (fromItem.currentStock || 0) - item.quantity);
                    }

                    // Add to toWarehouse
                    const toItem = toWh.inventory.find(
                        (inv) => inv.product.toString() === item.product.toString()
                    );
                    if (toItem) {
                        toItem.currentStock = (toItem.currentStock || 0) + item.quantity;
                    } else {
                        toWh.inventory.push({
                            product: item.product,
                            productName: item.productName || "",
                            packagingUnit: item.unit || "وحدة",
                            binLocation: "A-01-P01",
                            currentStock: item.quantity,
                            reorderLevel: 50,
                        });
                    }
                });

                await fromWh.save();
                await toWh.save();
            }
            transfer.completedAt = new Date();
        }

        transfer.status = status || transfer.status;
        if (approvedBy) transfer.approvedBy = approvedBy;
        await transfer.save();

        res.status(200).json({
            status: "success",
            message: `تم تحديث حالة المناقلة إلى: ${transfer.status}`,
            data: transfer,
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// 12. Export Inventory Report Data (تصدير تقرير المخزون Excel / JSON)
// ==========================================
const exportInventoryReport = async (req, res, next) => {
    try {
        const warehouses = await Warehouse.find().populate({
            path: "inventory.product",
            select: "name code description category packages",
            populate: { path: "category", select: "name" },
        });

        const reportRows = [];

        warehouses.forEach((wh) => {
            wh.inventory.forEach((item) => {
                const prod = item.product || {};
                reportRows.push({
                    warehouseName: wh.name,
                    warehouseCode: wh.code,
                    governorate: wh.governorate,
                    supervisorName: wh.supervisorName,
                    productName: item.productName || prod.name || "",
                    sku: item.sku || prod.code || "",
                    category: prod.category?.name || "عام",
                    binLocation: item.binLocation,
                    packagingUnit: item.packagingUnit,
                    currentStock: item.currentStock,
                    reorderLevel: item.reorderLevel,
                    stockStatus: item.stockStatus,
                    isCritical: item.currentStock <= item.reorderLevel,
                });
            });
        });

        res.status(200).json({
            status: "success",
            generatedAt: new Date().toISOString(),
            totalRecords: reportRows.length,
            data: reportRows,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getWarehousesStats,
    getAllWarehouses,
    getWarehouseById,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    getWarehouseInventory,
    assignProductToWarehouse,
    updateWarehouseInventoryItem,
    removeProductFromWarehouse,
    getStockTransfers,
    createStockTransfer,
    updateStockTransferStatus,
    exportInventoryReport,
};
