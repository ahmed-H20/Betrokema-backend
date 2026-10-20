const Category = require("./model");
const Product = require("../products/model");
const ApiError = require("../../utils/ApiError");

// 1. Create Category (Quick Add: Arabic name, English name)
const createCategory = async (req, res, next) => {
    try {
        const { name, nameEn, code, description } = req.body;
        if (!name) {
            return next(new ApiError("اسم التصنيف بالعربية مطلوب", 400));
        }

        const category = await Category.create({
            name,
            nameEn: nameEn || "",
            code: code || "",
            description: description || "",
        });

        res.status(201).json({
            status: "success",
            message: "تم حفظ وتثبيت التصنيف بنجاح",
            data: category,
        });
    } catch (err) {
        next(err);
    }
};

// 2. Get All Categories (with product counts for filter pills)
const getAllCategories = async (req, res, next) => {
    try {
        const categories = await Category.find().sort({ createdAt: 1 });

        // Aggregate product counts per category
        const productCounts = await Product.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } },
        ]);

        const countsMap = {};
        productCounts.forEach((item) => {
            if (item._id) countsMap[item._id.toString()] = item.count;
        });

        const totalProducts = await Product.countDocuments();

        const enrichedCategories = categories.map((cat) => ({
            ...cat.toObject(),
            productsCount: countsMap[cat._id.toString()] || 0,
        }));

        res.status(200).json({
            status: "success",
            totalCategories: categories.length,
            totalProducts,
            data: enrichedCategories,
        });
    } catch (err) {
        next(err);
    }
};

// 3. Get Category By ID
const getCategoryById = async (req, res, next) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return next(new ApiError("التصنيف غير موجود", 404));
        }

        const productsCount = await Product.countDocuments({ category: category._id });

        res.status(200).json({
            status: "success",
            data: {
                ...category.toObject(),
                productsCount,
            },
        });
    } catch (err) {
        next(err);
    }
};

// 4. Update Category
const updateCategory = async (req, res, next) => {
    try {
        const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!category) {
            return next(new ApiError("التصنيف غير موجود", 404));
        }
        res.status(200).json({
            status: "success",
            message: "تم تحديث التصنيف بنجاح",
            data: category,
        });
    } catch (err) {
        next(err);
    }
};

// 5. Delete Category (With Orphan Prevention)
const deleteCategory = async (req, res, next) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return next(new ApiError("التصنيف غير موجود", 404));
        }

        const linkedProductsCount = await Product.countDocuments({ category: req.params.id });
        if (linkedProductsCount > 0) {
            return next(
                new ApiError(
                    `لا يمكن حذف التصنيف (${category.name}) لوجود ${linkedProductsCount} منتج مرتبط به في الكتالوج. يرجى نقل أو حذف المنتجات المرتبطة به أولاً`,
                    400
                )
            );
        }

        await Category.findByIdAndDelete(req.params.id);
        res.status(200).json({
            status: "success",
            message: "تم حذف التصنيف بنجاح",
            data: null,
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
};
