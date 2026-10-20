const Product = require("./model");
const Category = require("../categores/model");
const ApiFeatures = require("../../utils/ApiFeatures");
const ApiError = require("../../utils/ApiError");
const generateCode = require("../../utils/GenerateCode");

// ==========================================
// 1. Dashboard Inventory Stats & KPIs (كروت المؤشرات الأربعة العلوية)
// ==========================================
const getProductsDashboardStats = async (req, res, next) => {
    try {
        const totalProducts = await Product.countDocuments();

        // Products added this quarter (last 90 days)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const quarterAdded = await Product.countDocuments({ createdAt: { $gte: ninetyDaysAgo } });

        // Total inventory value & distinct warehouses
        const products = await Product.find().select("quantity price packages warehouse minStockThreshold name code");

        let totalStockValue = 0;
        let criticalAlertsCount = 0;
        const warehousesSet = new Set();
        const criticalProducts = [];

        products.forEach((prod) => {
            if (prod.warehouse) warehousesSet.add(prod.warehouse);

            // Unit price calculation: bestela price or galon or first package
            const unitPrice = prod.price?.bestela || prod.price?.galon || prod.packages?.[0]?.price || 0;
            totalStockValue += (prod.quantity || 0) * unitPrice;

            const threshold = prod.minStockThreshold || 20;
            if ((prod.quantity || 0) <= threshold) {
                criticalAlertsCount++;
                criticalProducts.push({
                    _id: prod._id,
                    name: prod.name,
                    code: prod.code,
                    quantity: prod.quantity,
                    warehouse: prod.warehouse,
                });
            }
        });

        // Categories count
        const categoriesCount = await Category.countDocuments();

        res.status(200).json({
            status: "success",
            data: {
                totalProducts: {
                    count: totalProducts,
                    quarterAdded,
                },
                totalStockValue: {
                    value: totalStockValue,
                    warehousesCount: warehousesSet.size || 1,
                    warehousesList: Array.from(warehousesSet),
                },
                criticalStockAlerts: {
                    count: criticalAlertsCount,
                    products: criticalProducts.slice(0, 5),
                },
                categoriesCount,
            },
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 2. Get Featured / Best Seller Product (بانر المنتج الأكثر مبيعاً)
// ==========================================
const getFeaturedProduct = async (req, res, next) => {
    try {
        let product = await Product.findOne({ isBestSeller: true }).populate("category", "name nameEn code");
        if (!product) {
            product = await Product.findOne({ isFeatured: true }).populate("category", "name nameEn code");
        }
        if (!product) {
            product = await Product.findOne().sort({ quantity: -1 }).populate("category", "name nameEn code");
        }

        res.status(200).json({
            status: "success",
            data: product,
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 3. Get All Products (With Search, Filter, Pagination & Category Populate)
// ==========================================
const getAllProducts = async (req, res, next) => {
    try {
        const filterObj = {};

        // 1. Filter by category
        if (req.query.category && req.query.category !== "all") {
            filterObj.category = req.query.category;
        }

        // 2. Filter by warehouse
        if (req.query.warehouse) {
            filterObj.warehouse = req.query.warehouse;
        }

        // 3. Filter by low stock alerts
        if (req.query.isLowStock === "true") {
            filterObj.$expr = { $lte: ["$quantity", "$minStockThreshold"] };
        }

        // 4. Search query
        if (req.query.search) {
            const keyword = req.query.search.trim();
            filterObj.$or = [
                { name: { $regex: keyword, $options: "i" } },
                { code: { $regex: keyword, $options: "i" } },
                { description: { $regex: keyword, $options: "i" } },
            ];
        }

        const totalCount = await Product.countDocuments(filterObj);

        const features = new ApiFeatures(Product.find(filterObj), req.query)
            .sort()
            .pagination(totalCount)
            .limitation();

        const products = await features.mongooseQuery.populate("category", "name nameEn code");

        res.status(200).json({
            status: "success",
            results: products.length,
            totalCount,
            pagination: features.pagination,
            data: products,
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 4. Get Product By ID
// ==========================================
const getProductById = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id).populate("category", "name nameEn code");
        if (!product) {
            return next(new ApiError(`المنتج غير موجود: ${req.params.id}`, 404));
        }
        res.status(200).json({
            status: "success",
            data: product,
        });
    } catch (err) {
        next(err);
    }
};

// Helper: Sync pricing, discounts, weights between packages array and legacy price fields
const syncPricingAndPackages = (body) => {
    const data = { ...body };

    data.price = { ...(data.price || {}) };
    data.discount = { ...(data.discount || {}) };
    data.priceAfterDiscount = { ...(data.priceAfterDiscount || {}) };
    data.weight = { ...(data.weight || {}) };

    if (Array.isArray(data.packages) && data.packages.length > 0) {
        data.packages.forEach((pkg) => {
            const nameLower = (pkg.unitName || "").toLowerCase();

            // Extract numeric weight from string (e.g. "3.75 لتر" -> 3.75, "14 لتر" -> 14, "4.5 كجم" -> 4.5)
            let weightNum = 0;
            if (pkg.weight) {
                const match = pkg.weight.toString().match(/[\d.]+/);
                if (match) weightNum = parseFloat(match[0]);
            }

            // Check for galon (جالون)
            if (nameLower.includes("جالون") || nameLower.includes("galon")) {
                if (pkg.price !== undefined) data.priceAfterDiscount.galon = pkg.price;
                if (pkg.oldPrice !== undefined && pkg.oldPrice > 0) {
                    data.price.galon = pkg.oldPrice;
                    data.discount.galon = pkg.oldPrice - pkg.price;
                } else if (!data.price.galon) {
                    data.price.galon = pkg.price;
                }
                if (weightNum > 0) data.weight.galon = weightNum;
            }

            // Check for bestela (بستلة) or شكارة or برميل
            if (nameLower.includes("بستلة") || nameLower.includes("bestela") || nameLower.includes("شكارة") || nameLower.includes("برميل")) {
                if (pkg.price !== undefined) data.priceAfterDiscount.bestela = pkg.price;
                if (pkg.oldPrice !== undefined && pkg.oldPrice > 0) {
                    data.price.bestela = pkg.oldPrice;
                    data.discount.bestela = pkg.oldPrice - pkg.price;
                } else if (!data.price.bestela) {
                    data.price.bestela = pkg.price;
                }
                if (weightNum > 0) data.weight.bestela = weightNum;
            }
        });
    }

    // Fallbacks if price is sent directly
    if (data.price) {
        if (data.price.galon && (!data.priceAfterDiscount.galon || data.priceAfterDiscount.galon === 0)) {
            data.priceAfterDiscount.galon = data.discount?.galon
                ? data.price.galon - data.discount.galon
                : data.price.galon;
        }
        if (data.price.bestela && (!data.priceAfterDiscount.bestela || data.priceAfterDiscount.bestela === 0)) {
            data.priceAfterDiscount.bestela = data.discount?.bestela
                ? data.price.bestela - data.discount.bestela
                : data.price.bestela;
        }
    }

    return data;
};

// ==========================================
// 5. Create Product
// ==========================================
const createProduct = async (req, res, next) => {
    try {
        const payload = syncPricingAndPackages(req.body);

        // Validate category
        if (!payload.category) {
            return next(new ApiError("حقل التصنيف (category) مطلوب للمنتج", 400));
        }

        const categoryExists = await Category.findById(payload.category);
        if (!categoryExists) {
            return next(
                new ApiError(
                    `التصنيف المحدد غير موجود في قاعدة البيانات: ${payload.category}. يرجى إنشاء تصنيف أولاً من قائمة التصنيفات أو استخدام معرّف تصنيف صالح.`,
                    400
                )
            );
        }

        const code = await generateCode(Product, "PK");
        const product = await Product.create({ ...payload, code: code });
        const populated = await Product.findById(product._id).populate("category", "name nameEn code");

        res.status(201).json({
            status: "success",
            message: "تم إضافة المنتج بنجاح",
            data: populated,
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 6. Update Product
// ==========================================
const updateProduct = async (req, res, next) => {
    try {
        const payload = syncPricingAndPackages(req.body);

        if (payload.category) {
            const categoryExists = await Category.findById(payload.category);
            if (!categoryExists) {
                return next(new ApiError(`التصنيف المحدد غير موجود: ${payload.category}`, 400));
            }
        }

        const product = await Product.findByIdAndUpdate(req.params.id, payload, {
            new: true,
            runValidators: true,
        }).populate("category", "name nameEn code");

        if (!product) {
            return next(new ApiError(`المنتج غير موجود: ${req.params.id}`, 404));
        }

        res.status(200).json({
            status: "success",
            message: "تم تحديث المنتج بنجاح",
            data: product,
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 7. Quick Action: Update Stock & Price (تعديل السعر والمخزون السريع)
// ==========================================
const updateProductStockAndPrice = async (req, res, next) => {
    try {
        const payload = syncPricingAndPackages(req.body);
        const updateFields = {};

        if (payload.quantity !== undefined) updateFields.quantity = payload.quantity;
        if (payload.price !== undefined) updateFields.price = payload.price;
        if (payload.discount !== undefined) updateFields.discount = payload.discount;
        if (payload.priceAfterDiscount !== undefined) updateFields.priceAfterDiscount = payload.priceAfterDiscount;
        if (payload.weight !== undefined) updateFields.weight = payload.weight;
        if (payload.packages !== undefined) updateFields.packages = payload.packages;

        const product = await Product.findByIdAndUpdate(req.params.id, updateFields, {
            new: true,
            runValidators: true,
        }).populate("category", "name nameEn code");

        if (!product) {
            return next(new ApiError(`المنتج غير موجود: ${req.params.id}`, 404));
        }

        res.status(200).json({
            status: "success",
            message: "تم تحديث السعر والمخزون بنجاح",
            data: product,
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 8. Quick Action: Issue Supply Order (إصدار طلب توريد فوري للأصناف المنخفضة)
// ==========================================
const quickSupplyRequest = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return next(new ApiError(`المنتج غير موجود: ${req.params.id}`, 404));
        }

        const requestedQuantity = req.body.requestedQuantity || 100;
        const notes = req.body.notes || `طلب توريد عاجل للمستودع: ${product.warehouse}`;

        res.status(200).json({
            status: "success",
            message: `تم إصدار طلب توريد عاجل بكمية ${requestedQuantity} وحدة للمنتج (${product.name})`,
            data: {
                productId: product._id,
                productName: product.name,
                productCode: product.code,
                warehouse: product.warehouse,
                currentStock: product.quantity,
                requestedQuantity,
                notes,
                orderDate: new Date(),
            },
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 9. Delete Product
// ==========================================
const deleteProduct = async (req, res, next) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return next(new ApiError(`المنتج غير موجود: ${req.params.id}`, 404));
        }
        res.status(200).json({
            status: "success",
            message: "تم حذف المنتج بنجاح",
            data: null,
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 10. Get Products By Category
// ==========================================
const getProductsByCategory = async (req, res, next) => {
    try {
        const products = await Product.find({ category: req.params.category }).populate(
            "category",
            "name nameEn code"
        );
        res.status(200).json({
            status: "success",
            results: products.length,
            data: products,
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getProductsDashboardStats,
    getFeaturedProduct,
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    updateProductStockAndPrice,
    quickSupplyRequest,
    deleteProduct,
    getProductsByCategory,
};