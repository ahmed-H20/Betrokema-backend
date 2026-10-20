const mongoose = require("mongoose");

const sellerSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "اسم المندوب مطلوب"],
            trim: true,
        },
        code: {
            type: String,
            trim: true,
            unique: true,
            sparse: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        phone: {
            type: String,
            required: [true, "رقم الهاتف مطلوب"],
            trim: true,
        },
        title: {
            type: String,
            trim: true,
            default: "مندوب مبيعات ميداني",
        },
        governorate: {
            type: String,
            trim: true,
            default: "القاهرة",
        },
        region: {
            type: String,
            trim: true,
            default: "",
        },
        sector: {
            type: String,
            trim: true,
            default: "قطاع عام",
        },
        city: {
            type: String,
            trim: true,
            default: "",
        },
        address: {
            type: String,
            trim: true,
            default: "",
        },
        photoUrl: {
            type: String,
            default: "",
        },
        monthlyTarget: {
            type: Number,
            default: 500000,
        },
        commissionRate: {
            type: Number,
            default: 6, // 6%
        },
        status: {
            type: String,
            enum: ["ACTIVE", "SUSPENDED", "VACATION"],
            default: "ACTIVE",
        },
        statusNote: {
            type: String,
            default: "",
        },
        certifiedSince: {
            type: Number,
            default: () => new Date().getFullYear(),
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

module.exports = mongoose.model("Seller", sellerSchema);