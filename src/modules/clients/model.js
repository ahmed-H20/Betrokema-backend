const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "اسم العميل / المنشأة مطلوب"],
            trim: true,
        },
        organizeName: {
            type: String,
            required: [true, "اسم المؤسسة أو الشركة مطلوب"],
            trim: true,
        },
        contactPerson: {
            type: String,
            trim: true,
            default: "",
        },
        phone: {
            type: String,
            required: [true, "رقم الهاتف مطلوب"],
            trim: true,
        },
        clientCode: {
            type: String,
            trim: true,
            default: "",
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seller",
            default: null,
        },
        governorate: {
            type: String,
            trim: true,
            default: "القاهرة",
        },
        city: {
            type: String,
            trim: true,
            default: "القاهرة",
        },
        address: {
            type: String,
            trim: true,
            default: "",
        },
        gpsLocation: {
            lat: {
                type: Number,
                default: null,
            },
            lng: {
                type: Number,
                default: null,
            },
        },
        deliveryNotes: {
            type: String,
            trim: true,
            default: "",
        },
        commercialReg: {
            type: String,
            trim: true,
            default: "",
        },
        taxNumber: {
            type: String,
            trim: true,
            default: "",
        },
        tier: {
            type: String,
            default: "عميل عام",
        },
        creditLimit: {
            type: Number,
            default: 100000,
            min: [0, "حد الائتمان لا يمكن أن يكون سالباً"],
        },
        currentDebt: {
            type: Number,
            default: 0,
            min: [0, "المديونية لا يمكن أن تكون سالبة"],
        },
        paymentStatus: {
            type: String,
            enum: ["regular", "over_credit", "excellent", "settled"],
            default: "regular",
        },
        commercialType: {
            type: String,
            default: "معرض طلاء",
        },
        notes: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual: Check if client exceeds credit limit
clientSchema.virtual("isOverCredit").get(function () {
    return (this.currentDebt || 0) > (this.creditLimit || 0);
});

module.exports = mongoose.model("Client", clientSchema);
