const jwt = require("jsonwebtoken");
const User = require("../users/model");
const Seller = require("../sellers/model");
require("../clients/model");
const ApiError = require("../../utils/ApiError");

// Generate JWT token helper
const generateToken = (payload) => {
    const secret = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRE_TIME || "7d";
    return jwt.sign(payload, secret, { expiresIn });
};

// 1. Login by Code (or Email/Phone) + Password
const login = async (req, res, next) => {
    try {
        const identifier = (
            req.body.code ||
            req.body.email ||
            req.body.phone ||
            req.body.identifier ||
            ""
        ).trim();

        const { password } = req.body;

        if (!identifier || !password) {
            return next(
                new ApiError("يرجى إدخال كود الحساب أو البريد وكلمة المرور", 400)
            );
        }

        // Find user by code, email, or phone
        const user = await User.findOne({
            $or: [
                { code: identifier },
                { email: identifier.toLowerCase() },
                { phone: identifier },
            ],
        })
            .select("+password")
            .populate("sellerProfile")
            .populate({
                path: "clientProfile",
                populate: { path: "seller", select: "name phone code title" },
            });

        if (!user) {
            return next(new ApiError("كود الحساب أو كلمة المرور غير صحيحة", 401));
        }

        // Verify password
        const isCorrectPassword = await user.comparePassword(password);
        if (!isCorrectPassword) {
            return next(new ApiError("كود الحساب أو كلمة المرور غير صحيحة", 401));
        }

        // Check active status
        if (user.isActive === false) {
            return next(
                new ApiError("تم تعطيل هذا الحساب. يرجى مراجعة إدارة النظام", 403)
            );
        }

        // Check seller status if role is seller
        if (user.role === "seller") {
            const seller = user.sellerProfile || (await Seller.findOne({ user: user._id }));
            if (seller) {
                if (seller.status === "SUSPENDED") {
                    return next(
                        new ApiError(
                            seller.statusNote
                                ? `تم تعليق حساب المندوب (${seller.statusNote}). يرجى مراجعة إدارة الشركة`
                                : "تم تعليق حساب هذا المندوب. يرجى مراجعة إدارة الشركة",
                            403
                        )
                    );
                }
                if (seller.status === "VACATION") {
                    return next(
                        new ApiError(
                            seller.statusNote
                                ? `المندوب في فترة إجازة حالياً (${seller.statusNote}). الحساب متوقف مؤقتاً`
                                : "المندوب في فترة إجازة حالياً. الحساب متوقف مؤقتاً حتى العودة للعمل",
                            403
                        )
                    );
                }
            }
        }

        // Generate Token
        const token = generateToken({
            id: user._id,
            role: user.role,
            code: user.code,
            sellerId: user.sellerProfile ? user.sellerProfile._id : null,
            clientId: user.clientProfile ? user.clientProfile._id : null,
        });

        // User object without password
        const userData = {
            id: user._id,
            name: user.name,
            code: user.code,
            role: user.role,
            email: user.email,
            phone: user.phone,
            sellerProfile: user.sellerProfile,
            clientProfile: user.clientProfile,
        };

        res.status(200).json({
            status: "success",
            message: "تم تسجيل الدخول بنجاح",
            token,
            data: userData,
        });
    } catch (err) {
        next(err);
    }
};

// 2. Get Current Authenticated User (Profile)
const getMe = async (req, res, next) => {
    try {
        res.status(200).json({
            status: "success",
            data: req.user,
        });
    } catch (err) {
        next(err);
    }
};

// 3. Change Password
const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return next(
                new ApiError(
                    "يرجى إدخال كلمة المرور الحالية وكلمة المرور الجديدة",
                    400
                )
            );
        }

        if (newPassword.length < 6) {
            return next(
                new ApiError("كلمة المرور الجديدة يجب أن لا تقل عن 6 خانات", 400)
            );
        }

        const user = await User.findById(req.user._id).select("+password");

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return next(new ApiError("كلمة المرور الحالية غير صحيحة", 401));
        }

        user.password = newPassword;
        await user.save();

        const token = generateToken({
            id: user._id,
            role: user.role,
            code: user.code,
            sellerId: user.sellerProfile,
            clientId: user.clientProfile,
        });

        res.status(200).json({
            status: "success",
            message: "تم تحديث كلمة المرور بنجاح",
            token,
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    login,
    getMe,
    changePassword,
};
