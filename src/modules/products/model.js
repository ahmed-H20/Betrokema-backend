const mongoose = require("mongoose");

const colorSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        code: {
            type: String,
            default: "",
            trim: true,
        },
        hex: {
            type: String,
            default: "#000000",
            trim: true,
        },
        price: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { _id: false }
);

const packageSchema = new mongoose.Schema(
    {
        unitName: {
            type: String,
            required: true,
            trim: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        oldPrice: {
            type: Number,
            default: 0,
        },
        discountPercent: {
            type: Number,
            default: 0,
        },
        weight: {
            type: String,
            default: "",
        },
        note: {
            type: String,
            default: "",
        },
        colors: {
            type: [colorSchema],
            default: [],
        },
    },
    { _id: false }
);


const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "اسم المنتج مطلوب"],
            trim: true,
        },
        code: {
            type: String,
            trim: true,
            unique: true,
            sparse: true,
        },
        description: {
            type: String,
            default: "",
            trim: true,
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: [true, "التصنيف مطلوب"],
        },
        image: {
            type: String,
            default: "",
        },
        images: {
            type: [String],
            default: [],
        },
        warehouse: {
            type: String,
            trim: true,
            default: "مستودع العاشر",
        },
        quantity: {
            type: Number,
            required: true,
            default: 0,
            min: [0, "الكمية لا يمكن أن تكون سالبة"],
        },
        minStockThreshold: {
            type: Number,
            default: 20,
        },
        isFeatured: {
            type: Boolean,
            default: false,
        },
        isBestSeller: {
            type: Boolean,
            default: false,
        },
        statusBadge: {
            type: String,
            default: "مطابق للمواصفات",
        },
        sortOrder: {
            type: Number,
            default: 0,
        },
        fetures: [
            {
                name: String,
            },
        ],
        packages: {
            type: [packageSchema],
            default: [],
        },
        colors: {
            type: [colorSchema],
            default: [],
        },
        gift: {
            name: { type: String, default: "", trim: true },
            description: { type: String, default: "", trim: true },
            image: { type: String, default: "", trim: true },
            weight: { type: String, default: "", trim: true },
        },
        giftProduct: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            default: null,
        },
        giftTitle: {
            type: String,
            default: "",
            trim: true,
        },
        // Backward-compatible fields
        price: {
            galon: { type: Number, default: 0 },
            bestela: { type: Number, default: 0 },
        },
        discount: {
            galon: { type: Number, default: 0 },
            bestela: { type: Number, default: 0 },
        },
        priceAfterDiscount: {
            galon: { type: Number, default: 0 },
            bestela: { type: Number, default: 0 },
        },
        weight: {
            galon: { type: Number, default: 0 },
            bestela: { type: Number, default: 0 },
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual: Check if stock is low
productSchema.virtual("isLowStock").get(function () {
    return (this.quantity || 0) <= (this.minStockThreshold || 20);
});

// Auto-generate product code if not provided
productSchema.pre("save", function () {
    if (!this.code) {
        this.code = `PK-${Math.floor(10000 + Math.random() * 90000)}`;
    }
});

module.exports = mongoose.model("Product", productSchema);