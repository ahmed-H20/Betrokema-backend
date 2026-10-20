const User = require("./model");
const ApiError = require("../../utils/ApiError");

// 1. Create User
const createUser = async (req, res, next) => {
    try {
        const user = await User.create(req.body);
        res.status(201).json({ status: "success", data: user });
    } catch (err) {
        next(err);
    }
};

// 2. Get All Users
const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find();
        res.status(200).json({ status: "success", results: users.length, data: users });
    } catch (err) {
        next(err);
    }
};

// 3. Get User By ID
const getUserById = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return next(new ApiError(`المستخدم غير موجود: ${req.params.id}`, 404));
        }
        res.status(200).json({ status: "success", data: user });
    } catch (err) {
        next(err);
    }
};

// 4. Update User
const updateUser = async (req, res, next) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!user) {
            return next(new ApiError(`المستخدم غير موجود: ${req.params.id}`, 404));
        }
        res.status(200).json({ status: "success", data: user });
    } catch (err) {
        next(err);
    }
};

// 5. Delete User
const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return next(new ApiError(`المستخدم غير موجود: ${req.params.id}`, 404));
        }
        res.status(200).json({ status: "success", message: "تم حذف المستخدم بنجاح", data: null });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
};
