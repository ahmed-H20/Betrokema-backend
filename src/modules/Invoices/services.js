const Order = require("./model");
const Client = require("../clients/model");
const Seller = require("../sellers/model");
const Product = require("../products/model");
const ApiFeatures = require("../../utils/ApiFeatures");
const ApiError = require("../../utils/ApiError");
const generateCode = require("../../utils/GenerateCode");

// ==========================================
// 1. Get All Orders (With Filtering, Search, Pagination & Populate)
// ==========================================
const getAllOrders = async (req, res, next) => {
    try {
        const filterObj = {};

        // Role-based scope (Clients only see their own orders, Sellers see their own assigned orders)
        if (req.user) {
            if (req.user.role === "client") {
                let clientId = req.user.clientProfile?._id || req.user.clientProfile;
                if (!clientId) {
                    const clientDoc = await Client.findOne({ user: req.user._id }).select("_id");
                    if (clientDoc) clientId = clientDoc._id;
                }
                filterObj.client = clientId;
            } else if (req.user.role === "seller") {
                filterObj.seller = req.user.sellerProfile?._id || req.user.sellerProfile;
            }
        }

        if (req.query.client && !filterObj.client) {
            filterObj.client = req.query.client;
        }

        // 1. Warehouse filter
        if (req.query.warehouse && req.query.warehouse !== "كافة المستودعات (المركزية)") {
            filterObj.warehouse = req.query.warehouse;
        }

        // 2. Order status filter (Tabs support)
        if (req.query.orderStatus && req.query.orderStatus !== "all") {
            if (req.query.orderStatus === "pending") {
                filterObj.orderStatus = { $in: ["pending", "processing"] };
            } else {
                filterObj.orderStatus = req.query.orderStatus;
            }
        }

        // 3. Payment status filter
        if (req.query.paymentStatus) {
            filterObj.paymentStatus = req.query.paymentStatus;
        }

        // 4. Date filtering
        if (req.query.month) {
            const [year, month] = req.query.month.split("-");
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0, 23, 59, 59, 999);
            filterObj.createdAt = { $gte: start, $lte: end };
        } else if (req.query.startDate && req.query.endDate) {
            filterObj.createdAt = {
                $gte: new Date(req.query.startDate),
                $lte: new Date(req.query.endDate),
            };
        }

        // 5. Intelligent Multi-field Search
        if (req.query.search) {
            const keyword = req.query.search.trim();
            if (filterObj.client) {
                filterObj.invoiceCode = { $regex: keyword, $options: "i" };
            } else {
                const matchingClients = await Client.find({
                    $or: [
                        { name: { $regex: keyword, $options: "i" } },
                        { organizeName: { $regex: keyword, $options: "i" } },
                        { clientCode: { $regex: keyword, $options: "i" } },
                    ],
                }).select("_id");

                const matchingSellers = await Seller.find({
                    name: { $regex: keyword, $options: "i" },
                }).select("_id");

                const clientIds = matchingClients.map((c) => c._id);
                const sellerIds = matchingSellers.map((s) => s._id);

                filterObj.$or = [
                    { invoiceCode: { $regex: keyword, $options: "i" } },
                    { client: { $in: clientIds } },
                    { seller: { $in: sellerIds } },
                ];
            }
        }

        const totalCount = await Order.countDocuments(filterObj);

        const features = new ApiFeatures(Order.find(filterObj), req.query)
            .sort()
            .pagination(totalCount)
            .limitation();

        const orders = await features.mongooseQuery
            .populate({
                path: "client",
                select: "name organizeName phone city clientCode tier address",
            })
            .populate({
                path: "seller",
                select: "name phone sector city",
            })
            .populate({
                path: "products.productId",
                select: "name price description image weight code",
            })
            .populate({
                path: "payments.receivedBy",
                select: "name role",
            });

        res.status(200).json({
            status: "success",
            results: orders.length,
            totalCount,
            pagination: features.pagination,
            data: orders,
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 2. Get Order By ID (Full Details for Modal / Drawer)
// ==========================================
const getOrderById = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate({
                path: "client",
                select: "name organizeName phone city clientCode tier address notes",
            })
            .populate({
                path: "seller",
                select: "name phone sector city",
            })
            .populate({
                path: "products.productId",
                select: "name price description image weight category code",
            })
            .populate({
                path: "payments.receivedBy",
                select: "name role",
            });

        if (!order) {
            return next(new ApiError(`لا توجد فاتورة بهذا الرقم: ${req.params.id}`, 404));
        }

        res.status(200).json({
            status: "success",
            data: order,
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 3. Create Order / Invoice
// ==========================================
const createOrder = async (req, res, next) => {
    try {
        // Auto-assign client and seller if logged in as client
        if (req.user && req.user.role === "client") {
            req.body.client = req.user.clientProfile?._id || req.user.clientProfile;
            if (!req.body.client) {
                const clientDoc = await Client.findOne({ user: req.user._id }).select("_id seller");
                if (clientDoc) {
                    req.body.client = clientDoc._id;
                    if (!req.body.seller && clientDoc.seller) {
                        req.body.seller = clientDoc.seller;
                    }
                }
            } else if (!req.body.seller) {
                const clientDoc = await Client.findById(req.body.client);
                if (clientDoc && clientDoc.seller) {
                    req.body.seller = clientDoc.seller;
                }
            }
        }

        const code = await generateCode(Order, "INV");

        // Validate and calculate accurate totalPrice from line items
        let calculatedProductsTotal = 0;
        if (Array.isArray(req.body.products)) {
            req.body.products.forEach((item) => {
                const itemTotal = Number(item.price || 0) * Number(item.quantity || 1);
                item.totalPrice = itemTotal;
                calculatedProductsTotal += itemTotal;
            });
        }

        const taxAmount = Number(req.body.taxAmount) || 0;
        const finalTotalPrice = calculatedProductsTotal + taxAmount;
        req.body.totalPrice = finalTotalPrice > 0 ? finalTotalPrice : (Number(req.body.totalPrice) || 0);

        if (req.body.totalPaid && Number(req.body.totalPaid) >= req.body.totalPrice) {
            req.body.paymentStatus = "paid";
        } else if (req.body.totalPaid && Number(req.body.totalPaid) > 0) {
            req.body.paymentStatus = "partially_paid";
        }

        const order = await Order.create({
            ...req.body,
            invoiceCode: req.body.invoiceCode || code,
        });

        const populated = await Order.findById(order._id)
            .populate("client")
            .populate("seller")
            .populate("products.productId");

        res.status(201).json({
            status: "success",
            message: "تم إنشاء الفاتورة بنجاح",
            data: populated,
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 4. Update Order
// ==========================================
const updateOrder = async (req, res, next) => {
    try {
        const order = await Order.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        })
            .populate("client")
            .populate("seller")
            .populate("products.productId");

        if (!order) {
            return next(new ApiError(`لا توجد فاتورة بهذا الرقم: ${req.params.id}`, 404));
        }

        res.status(200).json({
            status: "success",
            message: "تم تحديث الفاتورة بنجاح",
            data: order,
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 5. Delete Order
// ==========================================
const deleteOrder = async (req, res, next) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);
        if (!order) {
            return next(new ApiError(`لا توجد فاتورة بهذا الرقم: ${req.params.id}`, 404));
        }

        res.status(200).json({
            status: "success",
            message: "تم حذف الفاتورة بنجاح",
            data: null,
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 6. Quick Action: Update Order Status (With Status Lifecycle Validation)
// ==========================================
const updateOrderStatus = async (req, res, next) => {
    try {
        const { orderStatus } = req.body;
        const validStatuses = ["pending", "processing", "completed", "cancelled"];
        if (!orderStatus || !validStatuses.includes(orderStatus)) {
            return next(
                new ApiError(
                    `حالة الطلب غير صالحة. الحالات المسموحة: ${validStatuses.join(", ")}`,
                    400
                )
            );
        }

        const existingOrder = await Order.findById(req.params.id);
        if (!existingOrder) {
            return next(new ApiError(`لا توجد فاتورة بهذا الرقم: ${req.params.id}`, 404));
        }

        // Prevent moving cancelled orders back to completed without a formal procedure
        if (existingOrder.orderStatus === "cancelled" && orderStatus === "completed") {
            return next(new ApiError("لا يمكن تحويل فاتورة ملغاة إلى مكتملة مباشرة", 400));
        }

        const previousStatus = existingOrder.orderStatus;
        existingOrder.orderStatus = orderStatus;
        await existingOrder.save();

        // If order became completed and client has an unpaid balance, update client debt
        if (orderStatus === "completed" && previousStatus !== "completed" && existingOrder.client) {
            const clientDoc = await Client.findById(existingOrder.client);
            if (clientDoc) {
                const unpaid = Math.max(0, (existingOrder.totalPrice || 0) - (existingOrder.totalPaid || 0));
                clientDoc.currentDebt = (clientDoc.currentDebt || 0) + unpaid;
                if (clientDoc.currentDebt > (clientDoc.creditLimit || 0)) {
                    clientDoc.paymentStatus = "over_credit";
                }
                await clientDoc.save();
            }
        }

        const populated = await Order.findById(existingOrder._id)
            .populate("client")
            .populate("seller");

        res.status(200).json({
            status: "success",
            message: `تم تغيير حالة الفاتورة إلى ${orderStatus}`,
            data: populated,
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 7. Add Payment to Invoice (With Overflow Guard & Client Debt Sync)
// ==========================================
const addPaymentToInvoice = async (req, res, next) => {
    try {
        const {
            amount,
            paymentMethod,
            paymentType,
            referenceNumber,
            chequeDueDate,
            notes,
            receivedBy,
            receiverName,
            paymentDate,
        } = req.body;

        const paymentNum = Number(amount);
        if (!paymentNum || paymentNum <= 0) {
            return next(new ApiError("المبلغ المدفوع يجب أن يكون رقماً أكبر من صفر", 400));
        }
        if (!paymentMethod) {
            return next(new ApiError("طريقة الدفع مطلوبة", 400));
        }
        if (!paymentType) {
            return next(new ApiError("نوع الدفعة مطلوب (عربون/قسط/سداد نهائي)", 400));
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return next(new ApiError(`لا توجد فاتورة بهذا الرقم: ${req.params.id}`, 404));
        }

        const currentPaid = order.totalPaid || 0;
        const totalPrice = order.totalPrice || 0;
        const remainingAmount = Math.max(0, totalPrice - currentPaid);

        if (remainingAmount <= 0) {
            return next(new ApiError("هذه الفاتورة مسددة بالكامل بالفعل ولا توجد أي متبقيات للتحصيل", 400));
        }

        if (paymentNum > remainingAmount) {
            return next(
                new ApiError(
                    `قيمة الدفعة (${paymentNum} ج.م) تتجاوز إجمالي المبلغ المتبقي على الفاتورة (${remainingAmount} ج.م)`,
                    400
                )
            );
        }

        const newTotalPaid = currentPaid + paymentNum;

        // Add payment to payments array
        order.payments.push({
            amount: paymentNum,
            paymentMethod,
            paymentType,
            referenceNumber: referenceNumber ? String(referenceNumber).trim() : "",
            chequeDueDate: chequeDueDate ? new Date(chequeDueDate) : null,
            notes: notes || "",
            receivedBy: receivedBy || req.user?._id || null,
            receiverName: receiverName || req.user?.name || "الخزينة المركزية",
            paymentDate: paymentDate || new Date(),
        });

        // Update totalPaid
        order.totalPaid = newTotalPaid;

        // Auto-update paymentStatus
        if (newTotalPaid >= totalPrice) {
            order.paymentStatus = "paid";
        } else if (newTotalPaid > 0) {
            order.paymentStatus = "partially_paid";
        }

        await order.save();

        // Safely adjust client currentDebt
        if (order.client) {
            const clientDoc = await Client.findById(order.client);
            if (clientDoc) {
                clientDoc.currentDebt = Math.max(0, (clientDoc.currentDebt || 0) - paymentNum);
                if (clientDoc.currentDebt === 0) {
                    clientDoc.paymentStatus = "settled";
                } else if (clientDoc.currentDebt <= (clientDoc.creditLimit || 0) && clientDoc.paymentStatus === "over_credit") {
                    clientDoc.paymentStatus = "regular";
                }
                await clientDoc.save();
            }
        }

        const populatedOrder = await Order.findById(order._id)
            .populate("client")
            .populate("seller")
            .populate("products.productId")
            .populate("payments.receivedBy");

        res.status(201).json({
            status: "success",
            message: "تم تسجيل الدفعة بنجاح وتحديث حالة الفاتورة",
            data: populatedOrder,
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 8. Dashboard KPIs & Stats (كروت الإحصائيات العلوية)
// ==========================================
const getInvoicesDashboardStats = async (req, res, next) => {
    try {
        const now = new Date();

        // 1. Month calculation
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        // Month Invoices
        const thisMonthInvoices = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
                    orderStatus: { $ne: "cancelled" },
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$totalPrice" },
                    activeInvoicesCount: { $sum: 1 },
                },
            },
        ]);

        const lastMonthInvoices = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
                    orderStatus: { $ne: "cancelled" },
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$totalPrice" },
                },
            },
        ]);

        const thisMonthTotal = thisMonthInvoices[0]?.totalAmount || 0;
        const activeInvoicesCount = thisMonthInvoices[0]?.activeInvoicesCount || 0;
        const lastMonthTotal = lastMonthInvoices[0]?.totalAmount || 0;
        const monthGrowthRate = lastMonthTotal > 0
            ? Number((((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1))
            : 0;

        // 2. Today Collections
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const todayPaymentsAgg = await Order.aggregate([
            { $unwind: "$payments" },
            {
                $match: {
                    "payments.paymentDate": { $gte: startOfToday, $lte: endOfToday },
                },
            },
            {
                $group: {
                    _id: null,
                    collectedToday: { $sum: "$payments.amount" },
                    settlementsCount: { $sum: 1 },
                },
            },
        ]);

        const collectedToday = todayPaymentsAgg[0]?.collectedToday || 0;
        const settlementsCount = todayPaymentsAgg[0]?.settlementsCount || 0;
        // Dynamic daily target computed from active field reps monthly targets divided by month days
        const activeSellers = await Seller.find({ status: "ACTIVE" }).select("monthlyTarget");
        const totalTeamTarget = activeSellers.reduce((sum, s) => sum + (s.monthlyTarget || 500000), 0);
        const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const targetToday = totalTeamTarget > 0 ? Math.round(totalTeamTarget / daysInCurrentMonth) : 250000;
        const collectedPercentage = targetToday > 0
            ? Number(((collectedToday / targetToday) * 100).toFixed(1))
            : 0;

        // 3. Overdue & Bad Debts
        const overdueAgg = await Order.aggregate([
            {
                $match: {
                    orderStatus: { $ne: "cancelled" },
                    paymentStatus: { $ne: "paid" },
                    $or: [
                        { paymentStatus: "overdue" },
                        { dueDate: { $lt: now, $ne: null } },
                    ],
                },
            },
            {
                $project: {
                    client: 1,
                    remaining: { $subtract: ["$totalPrice", "$totalPaid"] },
                },
            },
            {
                $group: {
                    _id: null,
                    totalOverdueAmount: { $sum: "$remaining" },
                    overdueClients: { $addToSet: "$client" },
                },
            },
        ]);

        const totalOverdueAmount = overdueAgg[0]?.totalOverdueAmount || 0;
        const overdueAccountsCount = overdueAgg[0]?.overdueClients?.length || 0;

        // 4. Tab Counters
        const [allCount, pendingCount, completedCount, cancelledCount] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ orderStatus: { $in: ["pending", "processing"] } }),
            Order.countDocuments({ orderStatus: "completed" }),
            Order.countDocuments({ orderStatus: "cancelled" }),
        ]);

        res.status(200).json({
            status: "success",
            data: {
                monthlyInvoices: {
                    totalAmount: thisMonthTotal,
                    activeInvoicesCount,
                    growthRate: monthGrowthRate,
                },
                dailyCollections: {
                    target: targetToday,
                    collected: collectedToday,
                    percentage: collectedPercentage,
                    settlementsCount,
                },
                overdueDebts: {
                    totalAmount: totalOverdueAmount,
                    overdueAccountsCount,
                },
                tabsCounts: {
                    all: allCount,
                    pending: pendingCount,
                    completed: completedCount,
                    cancelled: cancelledCount,
                },
            },
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 9. Seller Profit & Orders
// ==========================================
const getOrdersForSeller = async (req, res, next) => {
    try {
        const orders = await Order.find({ seller: req.params.sellerId })
            .populate("client")
            .populate("products.productId");
        res.status(200).json({ status: "success", results: orders.length, data: orders });
    } catch (err) {
        next(err);
    }
};

const getTotalProfitforSeller = async (req, res, next) => {
    try {
        const orders = await Order.find({ seller: req.params.sellerId });

        let filteredOrders = orders;
        if (req.query.startDate && req.query.endDate) {
            filteredOrders = orders.filter((order) => {
                const orderDate = new Date(order.createdAt);
                const startDate = new Date(req.query.startDate);
                const endDate = new Date(req.query.endDate);
                return orderDate >= startDate && orderDate <= endDate;
            });
        }
        let totalProfit = 0;
        filteredOrders.forEach((order) => {
            totalProfit += order.totalPrice;
        });
        res.status(200).json({ status: "success", data: totalProfit });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 10. Client Profit & Orders
// ==========================================
const getOrdersForClient = async (req, res, next) => {
    try {
        const orders = await Order.find({ client: req.params.clientId })
            .populate("seller")
            .populate("client")
            .populate("products.productId")
            .sort({ createdAt: -1 });
        res.status(200).json({ status: "success", results: orders.length, data: orders });
    } catch (err) {
        next(err);
    }
};

const getTotalProfitforClient = async (req, res, next) => {
    try {
        const orders = await Order.find({ client: req.params.clientId });

        let filteredOrders = orders;
        if (req.query.startDate && req.query.endDate) {
            filteredOrders = orders.filter((order) => {
                const orderDate = new Date(order.createdAt);
                const startDate = new Date(req.query.startDate);
                const endDate = new Date(req.query.endDate);
                return orderDate >= startDate && orderDate <= endDate;
            });
        }
        let totalProfit = 0;
        filteredOrders.forEach((order) => {
            totalProfit += order.totalPrice;
        });
        res.status(200).json({ status: "success", data: totalProfit });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 10. Executive Analytics & Comprehensive Reports
// ==========================================
const getExecutiveAnalytics = async (req, res, next) => {
    try {
        const now = new Date();
        const period = req.query.period || "month"; // "today" | "week" | "month" | "quarter" | "year"

        let startDate;
        if (period === "today") {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        } else if (period === "week") {
            const dayOfWeek = now.getDay();
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0);
        } else if (period === "quarter") {
            const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
            startDate = new Date(now.getFullYear(), quarterMonth, 1);
        } else if (period === "year") {
            startDate = new Date(now.getFullYear(), 0, 1);
        } else {
            // "month"
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        // 1. Overview Totals
        const ordersAgg = await Order.aggregate([
            { $match: { orderStatus: { $ne: "cancelled" } } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$totalPrice" },
                    totalPaid: { $sum: "$totalPaid" },
                    ordersCount: { $sum: 1 },
                },
            },
        ]);

        const totalRevenue = ordersAgg[0]?.totalRevenue || 0;
        const totalPaid = ordersAgg[0]?.totalPaid || 0;
        const totalRemaining = Math.max(0, totalRevenue - totalPaid);
        const collectionRate = totalRevenue > 0 ? Number(((totalPaid / totalRevenue) * 100).toFixed(1)) : 0;
        const totalOrders = ordersAgg[0]?.ordersCount || 0;

        // 2. Overdue Amount
        const overdueAgg = await Order.aggregate([
            {
                $match: {
                    orderStatus: { $ne: "cancelled" },
                    paymentStatus: { $ne: "paid" },
                    $or: [
                        { paymentStatus: "overdue" },
                        { dueDate: { $lt: now, $ne: null } },
                    ],
                },
            },
            {
                $group: {
                    _id: null,
                    overdueAmount: { $sum: { $subtract: ["$totalPrice", "$totalPaid"] } },
                    overdueCount: { $sum: 1 },
                },
            },
        ]);
        const overdueAmount = overdueAgg[0]?.overdueAmount || 0;
        const overdueCount = overdueAgg[0]?.overdueCount || 0;

        // 3. Complete Revenue Trend (Continuous Timeline with zero-fill)
        const trendStartDate = period === "year"
            ? new Date(now.getFullYear(), 0, 1)
            : new Date(now.getFullYear(), now.getMonth() - 5, 1);

        const monthlyTrendAgg = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: trendStartDate },
                    orderStatus: { $ne: "cancelled" },
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                    },
                    revenue: { $sum: "$totalPrice" },
                    collected: { $sum: "$totalPaid" },
                    ordersCount: { $sum: 1 },
                },
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]);

        const aggMap = new Map();
        monthlyTrendAgg.forEach((m) => {
            const key = `${m._id.year}-${m._id.month}`;
            aggMap.set(key, m);
        });

        const continuousTrend = [];
        if (period === "year") {
            const currYear = now.getFullYear();
            for (let m = 1; m <= 12; m++) {
                const key = `${currYear}-${m}`;
                const found = aggMap.get(key);
                continuousTrend.push({
                    year: currYear,
                    month: m,
                    label: `${currYear}-${String(m).padStart(2, "0")}`,
                    revenue: found ? found.revenue : 0,
                    collected: found ? found.collected : 0,
                    ordersCount: found ? found.ordersCount : 0,
                });
            }
        } else {
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const yr = d.getFullYear();
                const mo = d.getMonth() + 1;
                const key = `${yr}-${mo}`;
                const found = aggMap.get(key);
                continuousTrend.push({
                    year: yr,
                    month: mo,
                    label: `${yr}-${String(mo).padStart(2, "0")}`,
                    revenue: found ? found.revenue : 0,
                    collected: found ? found.collected : 0,
                    ordersCount: found ? found.ordersCount : 0,
                });
            }
        }

        // 4. Sector / Territory Distribution
        const sectorAgg = await Order.aggregate([
            { $match: { orderStatus: { $ne: "cancelled" } } },
            {
                $lookup: {
                    from: "sellers",
                    localField: "seller",
                    foreignField: "_id",
                    as: "sellerDoc",
                },
            },
            {
                $unwind: { path: "$sellerDoc", preserveNullAndEmptyArrays: true },
            },
            {
                $group: {
                    _id: { $ifNull: ["$sellerDoc.sector", "المركز الرئيسي"] },
                    revenue: { $sum: "$totalPrice" },
                    collected: { $sum: "$totalPaid" },
                    ordersCount: { $sum: 1 },
                },
            },
            { $sort: { revenue: -1 } },
        ]);

        // 5. Top Best-Selling Products
        const topProductsAgg = await Order.aggregate([
            { $match: { orderStatus: { $ne: "cancelled" } } },
            { $unwind: "$products" },
            {
                $group: {
                    _id: "$products.productId",
                    totalQuantity: { $sum: "$products.quantity" },
                    totalSales: { $sum: { $multiply: ["$products.price", "$products.quantity"] } },
                    unit: { $first: "$products.unit" },
                },
            },
            { $sort: { totalSales: -1 } },
            { $limit: 6 },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDoc",
                },
            },
            {
                $unwind: { path: "$productDoc", preserveNullAndEmptyArrays: true },
            },
            {
                $project: {
                    _id: 1,
                    name: { $ifNull: ["$productDoc.name", "منتج دهانات بتروكيما"] },
                    code: { $ifNull: ["$productDoc.code", "PET-PROD"] },
                    quantity: "$totalQuantity",
                    revenue: "$totalSales",
                    unit: { $ifNull: ["$unit", "بستلة"] },
                },
            },
        ]);

        // 6. Payment Methods Breakdown
        const paymentMethodsAgg = await Order.aggregate([
            { $unwind: "$payments" },
            {
                $group: {
                    _id: "$payments.paymentMethod",
                    totalAmount: { $sum: "$payments.amount" },
                    transactionsCount: { $sum: 1 },
                },
            },
            { $sort: { totalAmount: -1 } },
        ]);

        // 7. Top Sales Reps Performance
        const topSellersAgg = await Seller.find({ status: "ACTIVE" })
            .select("name sector monthlyTarget commissionRate clientCount avatar status")
            .limit(6);

        const topSellersWithSales = await Promise.all(
            topSellersAgg.map(async (seller) => {
                const sellerSalesAgg = await Order.aggregate([
                    {
                        $match: {
                            seller: seller._id,
                            orderStatus: { $ne: "cancelled" },
                            createdAt: { $gte: startDate },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            sales: { $sum: "$totalPrice" },
                            collected: { $sum: "$totalPaid" },
                            ordersCount: { $sum: 1 },
                        },
                    },
                ]);
                const sales = sellerSalesAgg[0]?.sales || 0;
                const collected = sellerSalesAgg[0]?.collected || 0;
                const ordersCount = sellerSalesAgg[0]?.ordersCount || 0;
                const target = seller.monthlyTarget || 500000;
                const achievementRate = target > 0 ? Number(((sales / target) * 100).toFixed(1)) : 0;
                return {
                    _id: seller._id,
                    name: seller.name,
                    sector: seller.sector || "القاهرة الكبرى",
                    sales,
                    collected,
                    target,
                    achievementRate,
                    ordersCount,
                };
            })
        );

        topSellersWithSales.sort((a, b) => b.sales - a.sales);

        res.status(200).json({
            status: "success",
            data: {
                period,
                overview: {
                    totalRevenue,
                    totalPaid,
                    totalRemaining,
                    collectionRate,
                    totalOrders,
                    overdueAmount,
                    overdueCount,
                },
                monthlyTrend: continuousTrend,
                sectors: sectorAgg.map((s) => ({
                    sector: s._id,
                    revenue: s.revenue,
                    collected: s.collected,
                    ordersCount: s.ordersCount,
                    share: totalRevenue > 0 ? Number(((s.revenue / totalRevenue) * 100).toFixed(1)) : 0,
                })),
                topProducts: topProductsAgg,
                paymentMethods: paymentMethodsAgg.map((p) => ({
                    method: p._id,
                    amount: p.totalAmount,
                    count: p.transactionsCount,
                    share: totalPaid > 0 ? Number(((p.totalAmount / totalPaid) * 100).toFixed(1)) : 0,
                })),
                topSellers: topSellersWithSales,
            },
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createOrder,
    updateOrder,
    deleteOrder,
    getAllOrders,
    getOrderById,
    getOrdersForSeller,
    getTotalProfitforSeller,
    getOrdersForClient,
    getTotalProfitforClient,
    updateOrderStatus,
    addPaymentToInvoice,
    getInvoicesDashboardStats,
    getExecutiveAnalytics,
};
