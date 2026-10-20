const jwt = require("jsonwebtoken");
const User = require("../modules/users/model");
const ApiError = require("../utils/ApiError");

// 1. Verify Authentication Token (JWT)
const protect = async (req, res, next) => {
    try {
        let token;
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")
        ) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return next(
                new ApiError("يرجى تسجيل الدخول للوصول إلى هذه البيانات", 401)
            );
        }

        const secret = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET;
        const decoded = jwt.verify(token, secret);

        const currentUser = await User.findById(decoded.id || decoded.userId)
            .populate("sellerProfile")
            .populate("clientProfile");

        if (!currentUser) {
            return next(
                new ApiError("المستخدم المرتبط بهذا التوكن لم يعد موجوداً", 401)
            );
        }

        if (currentUser.isActive === false) {
            return next(
                new ApiError("تم تعطيل هذا الحساب. يرجى مراجعة الإدارة", 403)
            );
        }

        req.user = currentUser;
        next();
    } catch (err) {
        if (err.name === "JsonWebTokenError") {
            return next(new ApiError("توكن غير صالح. يرجى تسجيل الدخول مجدداً", 401));
        }
        if (err.name === "TokenExpiredError") {
            return next(new ApiError("انتهت صلاحية التوكن. يرجى تسجيل الدخول مجدداً", 401));
        }
        next(err);
    }
};

// 2. Authorize Roles (RBAC)
const allowedTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(
                new ApiError("غير مصرح لك بالوصول إلى هذا الإجراء", 403)
            );
        }
        next();
    };
};

// 3. Optional Authentication (Extracts user if token is present, does not block if missing)
const optionalAuth = async (req, res, next) => {
    try {
        let token;
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")
        ) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return next();
        }

        const secret = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET;
        const decoded = jwt.verify(token, secret);

        const currentUser = await User.findById(decoded.id || decoded.userId)
            .populate("sellerProfile")
            .populate("clientProfile");

        if (currentUser && currentUser.isActive !== false) {
            req.user = currentUser;
        }

        next();
    } catch (err) {
        next();
    }
};

module.exports = {
    protect,
    allowedTo,
    optionalAuth,
};

