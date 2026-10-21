const Seller = require("./model");
const Client = require("../clients/model");
const Order = require("../Invoices/model");
const User = require("../users/model");
const ApiError = require("../../utils/ApiError");
const generateCode = require("../../utils/GenerateCode");
const generateEasyPassword = require("../../utils/GeneratePassword");

// ==========================================
// 1. Dashboard Stats (كروت الـ 4 مؤشرات العلوية)
// ==========================================
const getSellersDashboardStats = async (req, res, next) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        // 1. Sellers counts
        const [totalSellers, activeCount, suspendedCount, vacationCount] = await Promise.all([
            Seller.countDocuments(),
            Seller.countDocuments({ status: "ACTIVE" }),
            Seller.countDocuments({ status: "SUSPENDED" }),
            Seller.countDocuments({ status: "VACATION" }),
        ]);

        // 2. Team Monthly Sales & Target
        const sellers = await Seller.find();
        const teamMonthlyTarget = sellers.reduce((acc, s) => acc + (s.monthlyTarget || 500000), 0) || 14500000;

        const thisMonthSalesAgg = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
                    orderStatus: { $ne: "cancelled" },
                },
            },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: "$totalPrice" },
                },
            },
        ]);

        const lastMonthSalesAgg = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
                    orderStatus: { $ne: "cancelled" },
                },
            },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: "$totalPrice" },
                },
            },
        ]);

        const currentMonthSales = thisMonthSalesAgg[0]?.totalSales || 0;
        const lastMonthSales = lastMonthSalesAgg[0]?.totalSales || 0;
        const salesGrowthRate = lastMonthSales > 0
            ? Number((((currentMonthSales - lastMonthSales) / lastMonthSales) * 100).toFixed(1))
            : 0;

        // 3. Target Achievement Rate
        const targetAchievementRate = teamMonthlyTarget > 0
            ? Number(((currentMonthSales / teamMonthlyTarget) * 100).toFixed(1))
            : 0;

        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysRemaining = Math.max(0, daysInMonth - now.getDate());

        // 4. Clients Activity Stats (Real calculation based on 30-day orders)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [totalClients, newClientsThisWeek, activeClientIds] = await Promise.all([
            Client.countDocuments(),
            Client.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
            Order.distinct("client", {
                createdAt: { $gte: thirtyDaysAgo },
                orderStatus: { $ne: "cancelled" },
            }),
        ]);

        const realActivityRate = totalClients > 0
            ? Math.round((activeClientIds.length / totalClients) * 100)
            : 0;

        res.status(200).json({
            status: "success",
            data: {
                certifiedSellers: {
                    total: totalSellers,
                    active: activeCount,
                    suspended: suspendedCount,
                    vacation: vacationCount,
                },
                teamMonthlySales: {
                    totalAchieved: currentMonthSales,
                    monthlyTarget: teamMonthlyTarget,
                    growthRate: salesGrowthRate,
                },
                targetAchievement: {
                    percentage: targetAchievementRate,
                    statusText: targetAchievementRate >= 85 ? "ممتاز" : targetAchievementRate >= 70 ? "جيد جداً" : "يحتاج متابعة",
                    daysRemaining,
                },
                activeFieldClients: {
                    total: totalClients,
                    newThisWeek: newClientsThisWeek,
                    activityRate: realActivityRate,
                },
            },
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 2. Get All Sellers (With Performance, Targets & Filters + Pagination)
// ==========================================
const getAllSellers = async (req, res, next) => {
    try {
        const filterObj = {};

        // 1. Governorate filter
        if (req.query.governorate && req.query.governorate !== "جميع المحافظات (الجمهورية)") {
            filterObj.governorate = req.query.governorate;
        }

        // 2. Status filter
        if (req.query.status) {
            filterObj.status = req.query.status.toUpperCase();
        }

        // 3. Search by name, code or phone
        if (req.query.search) {
            const keyword = req.query.search.trim();
            filterObj.$or = [
                { name: { $regex: keyword, $options: "i" } },
                { code: { $regex: keyword, $options: "i" } },
                { phone: { $regex: keyword, $options: "i" } },
            ];
        }

        const totalSellers = await Seller.countDocuments(filterObj);
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Number(req.query.limit) ? Math.max(1, Number(req.query.limit)) : (req.query.page ? 10 : 0);

        let query = Seller.find(filterObj);
        if (limit > 0) {
            query = query.skip((page - 1) * limit).limit(limit);
        }
        const sellers = await query;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        // Enrich each seller with sales and clients count
        const enrichedSellers = await Promise.all(
            sellers.map(async (seller) => {
                const [monthSalesAgg, clientsCount, quarterInvoicesCount] = await Promise.all([
                    Order.aggregate([
                        {
                            $match: {
                                seller: seller._id,
                                createdAt: { $gte: startOfMonth, $lte: endOfMonth },
                                orderStatus: { $ne: "cancelled" },
                            },
                        },
                        { $group: { _id: null, total: { $sum: "$totalPrice" } } },
                    ]),
                    Client.countDocuments({ seller: seller._id }),
                    Order.countDocuments({ seller: seller._id, createdAt: { $gte: ninetyDaysAgo } }),
                ]);

                const monthlySales = monthSalesAgg[0]?.total || 0;
                const target = seller.monthlyTarget || 500000;
                const achievementPercent = target > 0 ? Math.min(100, Math.round((monthlySales / target) * 100)) : 0;

                return {
                    ...seller.toObject(),
                    monthlySales,
                    monthlyTarget: target,
                    achievementPercent,
                    clientsCount,
                    invoicesThisQuarter: quarterInvoicesCount,
                };
            })
        );

        // Sorting
        if (req.query.sort === "performance" || !req.query.sort) {
            enrichedSellers.sort((a, b) => b.achievementPercent - a.achievementPercent);
        } else if (req.query.sort === "sales") {
            enrichedSellers.sort((a, b) => b.monthlySales - a.monthlySales);
        }

        res.status(200).json({
            status: "success",
            results: enrichedSellers.length,
            pagination: {
                total: totalSellers,
                page,
                limit: limit || totalSellers,
                pages: limit > 0 ? Math.ceil(totalSellers / limit) : 1,
            },
            data: enrichedSellers,
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 3. Get Single Seller Performance (للبانر ومؤشرات المندوب المالي)
// ==========================================
const getSellerPerformance = async (req, res, next) => {
    try {
        const seller = await Seller.findById(req.params.id);
        if (!seller) {
            return next(new ApiError(`المندوب غير موجود: ${req.params.id}`, 404));
        }

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        const [monthOrdersAgg, todayOrdersAgg, clientsCount, totalInvoicesCount] = await Promise.all([
            Order.aggregate([
                {
                    $match: {
                        seller: seller._id,
                        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
                        orderStatus: { $ne: "cancelled" },
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalPrice: { $sum: "$totalPrice" },
                        totalPaid: { $sum: "$totalPaid" },
                    },
                },
            ]),
            Order.aggregate([
                {
                    $match: {
                        seller: seller._id,
                        createdAt: { $gte: startOfDay, $lte: endOfDay },
                        orderStatus: { $ne: "cancelled" },
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalPrice: { $sum: "$totalPrice" },
                        count: { $sum: 1 },
                    },
                },
            ]),
            Client.countDocuments({ seller: seller._id }),
            Order.countDocuments({ seller: seller._id }),
        ]);

        const currentMonthSales = monthOrdersAgg[0]?.totalPrice || 0;
        const totalPaidMonth = monthOrdersAgg[0]?.totalPaid || 0;
        const target = seller.monthlyTarget || 500000;
        const achievementRate = target > 0 ? Number(((currentMonthSales / target) * 100).toFixed(1)) : 0;
        const commissionRate = seller.commissionRate || 6;
        const commissionAmount = Math.round(currentMonthSales * (commissionRate / 100));
        const collectionRate = currentMonthSales > 0 ? Math.round((totalPaidMonth / currentMonthSales) * 100) : 0;

        // Daily performance metrics (for petrokema_mobile_4 & rep daily tracking)
        const todaySales = todayOrdersAgg[0]?.totalPrice || 0;
        const todayOrdersCount = todayOrdersAgg[0]?.count || 0;
        const dailyTarget = target > 0 ? Math.round(target / daysInMonth) : 0;
        const todayAchievementRate = dailyTarget > 0 ? Number(((todaySales / dailyTarget) * 100).toFixed(1)) : 0;
        const remainingTodayTarget = Math.max(0, dailyTarget - todaySales);

        res.status(200).json({
            status: "success",
            data: {
                seller: seller.toObject(),
                metrics: {
                    currentMonthSales,
                    monthlyTarget: target,
                    achievementRate,
                    commissionRate,
                    commissionAmount,
                    collectionRate,
                    clientsCount,
                    totalInvoicesCount,
                    todaySales,
                    todayOrdersCount,
                    dailyTarget,
                    todayAchievementRate,
                    remainingTodayTarget,
                },
            },
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 4. Create Seller (+ تسجيل مندوب جديد وإنشاء حسابه)
// ==========================================
const createSeller = async (req, res, next) => {
    try {
        if (!req.body.code) {
            req.body.code = await generateCode(Seller, "PK");
        }
        const sellerCode = req.body.code;
        const easyPassword = req.body.password || generateEasyPassword();

        // 1. Create User account for the seller
        const user = await User.create({
            name: req.body.name,
            code: sellerCode,
            phone: req.body.phone,
            email: req.body.email || `${sellerCode.toLowerCase()}@petrokema.local`,
            password: easyPassword,
            role: "seller",
        });

        // 2. Create Seller profile linked to user
        const seller = await Seller.create({
            ...req.body,
            code: sellerCode,
            user: user._id,
        });

        // 3. Link back user.sellerProfile
        user.sellerProfile = seller._id;
        await user.save();

        res.status(201).json({
            status: "success",
            message: "تم تسجيل المندوب وإنشاء حسابه بنجاح",
            data: seller,
            credentials: {
                code: sellerCode,
                password: easyPassword,
                role: "seller",
            },
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 5. Get Seller By ID
// ==========================================
const getSellerById = async (req, res, next) => {
    try {
        const seller = await Seller.findById(req.params.id);
        if (!seller) {
            return next(new ApiError(`المندوب غير موجود: ${req.params.id}`, 404));
        }
        res.status(200).json({ status: "success", data: seller });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 6. Update Seller (تعديل البيانات)
// ==========================================
const updateSeller = async (req, res, next) => {
    try {
        const seller = await Seller.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!seller) {
            return next(new ApiError(`المندوب غير موجود: ${req.params.id}`, 404));
        }
        res.status(200).json({
            status: "success",
            message: "تم تحديث بيانات المندوب بنجاح",
            data: seller,
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 7. Delete Seller (With Orphan Prevention)
// ==========================================
const deleteSeller = async (req, res, next) => {
    try {
        const seller = await Seller.findById(req.params.id);
        if (!seller) {
            return next(new ApiError(`المندوب غير موجود: ${req.params.id}`, 404));
        }

        const [clientsCount, ordersCount] = await Promise.all([
            Client.countDocuments({ seller: req.params.id }),
            Order.countDocuments({ seller: req.params.id }),
        ]);

        if (clientsCount > 0 || ordersCount > 0) {
            return next(
                new ApiError(
                    `لا يمكن حذف المندوب (${seller.name}) لوجود ${clientsCount} عميل و ${ordersCount} فاتورة مرتبطة به في النظام. يمكنك تعليق حسابه (SUSPENDED) بدلاً من الحذف حفاظاً على السجلات المالية`,
                    400
                )
            );
        }

        await Seller.findByIdAndDelete(req.params.id);
        if (seller.user) {
            await User.findByIdAndDelete(seller.user);
        }
        res.status(200).json({
            status: "success",
            message: "تم حذف المندوب وحسابه بنجاح",
            data: null,
        });
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 8. Reset Seller Password (Admin / Manager only)
// ==========================================
const resetSellerPassword = async (req, res, next) => {
    try {
        const { id } = req.params;
        const seller = await Seller.findById(id);
        if (!seller) {
            return next(new ApiError("المندوب غير موجود", 404));
        }

        let user = null;
        if (seller.user) {
            user = await User.findById(seller.user);
        }
        if (!user && seller.code) {
            user = await User.findOne({ code: seller.code });
        }
        if (!user && seller.phone) {
            user = await User.findOne({ phone: seller.phone, role: "seller" });
        }

        const newPassword = req.body?.password || generateEasyPassword();

        if (user) {
            user.password = newPassword;
            if (!user.sellerProfile) {
                user.sellerProfile = seller._id;
            }
            await user.save();
        } else {
            const sellerCode = seller.code || `PK-${Date.now().toString().slice(-4)}`;
            user = await User.create({
                name: seller.name,
                code: sellerCode,
                phone: seller.phone,
                email: `${sellerCode.toLowerCase()}@petrokema.local`,
                password: newPassword,
                role: "seller",
                sellerProfile: seller._id,
            });
            seller.user = user._id;
            seller.code = sellerCode;
            await seller.save();
        }

        res.status(200).json({
            status: "success",
            message: "تم إعادة تعيين كلمة مرور المندوب بنجاح",
            credentials: {
                name: seller.name,
                code: user.code || seller.code,
                password: newPassword,
                phone: seller.phone,
                role: "seller",
            },
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getSellersDashboardStats,
    getAllSellers,
    getSellerPerformance,
    getSellerById,
    createSeller,
    updateSeller,
    deleteSeller,
    resetSellerPassword,
};
