const Client = require("./model");
const User = require("../users/model");
const ApiFeatures = require("../../utils/ApiFeatures");
const ApiError = require("../../utils/ApiError");
const generateEasyPassword = require("../../utils/GeneratePassword");

// 1. Create Client (+ إضافة عميل للمندوب أو المنظومة وإنشاء حسابه)
const createClient = async (req, res, next) => {
    try {
        // Automatically link to logged-in seller if creator is a seller
        if (req.user && req.user.role === "seller") {
            req.body.seller = req.user.sellerProfile?._id || req.user.sellerProfile;
        }

        if (!req.body.clientCode) {
            const count = await Client.countDocuments();
            req.body.clientCode = `CLI-${String(count + 1).padStart(4, "0")}`;
        }
        const clientCode = req.body.clientCode;
        const easyPassword = req.body.password || generateEasyPassword();

        // Auto-check over credit if currentDebt > creditLimit
        if (req.body.currentDebt && req.body.creditLimit) {
            if (Number(req.body.currentDebt) > Number(req.body.creditLimit)) {
                req.body.paymentStatus = "over_credit";
            }
        }

        // 1. Create User account for client
        const user = await User.create({
            name: req.body.name || req.body.organizeName,
            code: clientCode,
            phone: req.body.phone,
            email: req.body.email || `${clientCode.toLowerCase()}@petrokema.local`,
            password: easyPassword,
            role: "client",
        });

        // 2. Create Client profile linked to user
        const client = await Client.create({
            ...req.body,
            clientCode,
            user: user._id,
        });

        // 3. Link back user.clientProfile
        user.clientProfile = client._id;
        await user.save();

        const populated = await Client.findById(client._id).populate("seller", "name phone code");

        res.status(201).json({
            status: "success",
            message: "تم إضافة العميل وإنشاء حسابه بنجاح",
            data: populated,
            credentials: {
                code: clientCode,
                password: easyPassword,
                role: "client",
            },
        });
    } catch (err) {
        next(err);
    }
};

// 2. Update Client
const updateClient = async (req, res, next) => {
    try {
        const client = await Client.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        }).populate("seller", "name phone code");

        if (!client) {
            return next(new ApiError(`العميل غير موجود: ${req.params.id}`, 404));
        }
        res.status(200).json({ status: "success", message: "تم تحديث بيانات العميل بنجاح", data: client });
    } catch (err) {
        next(err);
    }
};

// 3. Delete Client
const deleteClient = async (req, res, next) => {
    try {
        const client = await Client.findByIdAndDelete(req.params.id);
        if (!client) {
            return next(new ApiError(`العميل غير موجود: ${req.params.id}`, 404));
        }
        if (client.user) {
            await User.findByIdAndDelete(client.user);
        }
        res.status(200).json({ status: "success", message: "تم حذف العميل وحسابه بنجاح", data: null });
    } catch (err) {
        next(err);
    }
};

// 4. Get All Clients (مع فلترة المندوب والمحافظة وحالة السداد)
const getAllClients = async (req, res, next) => {
    try {
        const filterObj = {};
        if (req.query.seller) {
            filterObj.seller = req.query.seller;
        }
        if (req.query.governorate) {
            filterObj.governorate = req.query.governorate;
        }
        if (req.query.paymentStatus) {
            filterObj.paymentStatus = req.query.paymentStatus;
        }

        const count = await Client.countDocuments(filterObj);
        const features = new ApiFeatures(Client.find(filterObj), req.query)
            .filter()
            .search("client")
            .build()
            .sort()
            .pagination(count)
            .limitation();

        const clients = await features.mongooseQuery.populate("seller", "name phone code sector");

        res.status(200).json({
            status: "success",
            results: clients.length,
            totalCount: count,
            pagination: features.pagination,
            data: clients,
        });
    } catch (err) {
        next(err);
    }
};

// 5. Get Clients For Specific Seller (محفظة عملاء المندوب - 36 عميل)
const getClientsForSeller = async (req, res, next) => {
    try {
        const filter = { seller: req.params.sellerId };

        if (req.query.paymentStatus) {
            filter.paymentStatus = req.query.paymentStatus;
        }

        if (req.query.search) {
            const keyword = req.query.search.trim();
            filter.$or = [
                { name: { $regex: keyword, $options: "i" } },
                { organizeName: { $regex: keyword, $options: "i" } },
                { contactPerson: { $regex: keyword, $options: "i" } },
                { phone: { $regex: keyword, $options: "i" } },
            ];
        }

        const clients = await Client.find(filter).sort({ currentDebt: -1 });

        // Calculate portfolio summary
        const totalDebt = clients.reduce((acc, c) => acc + (c.currentDebt || 0), 0);
        const overCreditCount = clients.filter((c) => (c.currentDebt || 0) > (c.creditLimit || 0)).length;

        res.status(200).json({
            status: "success",
            results: clients.length,
            summary: {
                totalDebt,
                overCreditCount,
            },
            data: clients,
        });
    } catch (err) {
        next(err);
    }
};

// 6. Update Client Credit & Debt (تعديل الائتمان والمديونية)
const updateClientCreditDebt = async (req, res, next) => {
    try {
        const { creditLimit, currentDebt, paymentStatus } = req.body;
        const updateFields = {};

        if (creditLimit !== undefined) updateFields.creditLimit = creditLimit;
        if (currentDebt !== undefined) updateFields.currentDebt = currentDebt;
        if (paymentStatus !== undefined) updateFields.paymentStatus = paymentStatus;

        if (updateFields.currentDebt !== undefined && updateFields.creditLimit !== undefined) {
            if (updateFields.currentDebt > updateFields.creditLimit) {
                updateFields.paymentStatus = "over_credit";
            }
        }

        const client = await Client.findByIdAndUpdate(req.params.id, updateFields, {
            new: true,
            runValidators: true,
        }).populate("seller", "name phone code");

        if (!client) {
            return next(new ApiError(`العميل غير موجود: ${req.params.id}`, 404));
        }

        res.status(200).json({
            status: "success",
            message: "تم تحديث البيانات المالية للعميل بنجاح",
            data: client,
        });
    } catch (err) {
        next(err);
    }
};

// 7. Get Client By ID
const getClientById = async (req, res, next) => {
    try {
        const client = await Client.findById(req.params.id).populate("seller", "name phone code sector");
        if (!client) {
            return next(new ApiError(`العميل غير موجود: ${req.params.id}`, 404));
        }
        res.status(200).json({ status: "success", data: client });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createClient,
    updateClient,
    deleteClient,
    getAllClients,
    getClientsForSeller,
    updateClientCreditDebt,
    getClientById,
};