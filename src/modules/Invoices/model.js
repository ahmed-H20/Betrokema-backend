const mongoose = require("mongoose");

// Payment Schema
const paymentSchema = new mongoose.Schema(
    {
        amount: {
            type: Number,
            required: true,
            min: [0.01, "Payment amount must be greater than zero"],
        },

        paymentMethod: {
            type: String,
            enum: [
                "cash",
                "instapay",
                "wallet",
                "bank_transfer",
                "card",
                "cheque",
            ],
            required: true,
        },

        paymentDate: {
            type: Date,
            default: Date.now,
            required: true,
        },

        paymentType: {
            type: String,
            enum: [
                "deposit",
                "advance",
                "installment",
                "final_payment",
                "final_settlement",
            ],
            required: true,
        },

        referenceNumber: {
            type: String,
            trim: true,
            default: "",
        },

        chequeDueDate: {
            type: Date,
            default: null,
        },

        notes: {
            type: String,
            trim: true,
            default: "",
        },

        receivedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
        },

        receiverName: {
            type: String,
            trim: true,
            default: "الخزينة المركزية",
        },
    },
    {
        timestamps: true,
    }
);

// Order Product Schema
const orderProductSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },

        price: {
            type: Number,
            required: true,
            min: [0, "Price cannot be negative"],
        },

        quantity: {
            type: Number,
            required: true,
            min: [1, "Quantity must be at least 1"],
            validate: {
                validator: Number.isInteger,
                message: "Quantity must be an integer",
            },
        },

        unit: {
            type: String,
            trim: true,
            default: "وحدة",
        },

        totalPrice: {
            type: Number,
            required: true,
            min: [0, "Total price cannot be negative"],
        },
    },
    {
        _id: false,
    }
);

// Order Schema
const orderSchema = new mongoose.Schema(
    {
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
            required: true,
        },

        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seller",
            required: true,
        },

        invoiceCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        warehouse: {
            type: String,
            trim: true,
            default: "كافة المستودعات (المركزية)",
        },

        orderStatus: {
            type: String,
            enum: [
                "pending",      // قيد الطلب والمراجعة
                "processing",   // قيد التجهيز
                "completed",    // تم التسليم والفوترة
                "cancelled",    // ملغاة أو مرتجعة
            ],
            default: "pending",
            required: true,
        },

        paymentStatus: {
            type: String,
            enum: [
                "unpaid",
                "paid",
                "partially_paid",
                "overdue",
            ],
            default: "unpaid",
            required: true,
        },

        products: {
            type: [orderProductSchema],
            required: true,
            validate: {
                validator: (products) => products.length > 0,
                message: "Order must contain at least one product",
            },
        },

        totalPrice: {
            type: Number,
            required: true,
            min: [0.01, "Order total must be greater than zero"],
        },

        totalPaid: {
            type: Number,
            default: 0,
            min: [0, "Total paid cannot be negative"],
        },

        taxAmount: {
            type: Number,
            default: 0,
        },

        dueDate: {
            type: Date,
            default: null,
        },

        payments: {
            type: [paymentSchema],
            default: [],
        },

        notes: {
            type: String,
            trim: true,
            default: "",
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual for remaining unpaid amount
orderSchema.virtual("remainingAmount").get(function () {
    const total = this.totalPrice || 0;
    const paid = this.totalPaid || 0;
    return Math.max(0, total - paid);
});

// Virtual for payment percentage
orderSchema.virtual("paymentPercentage").get(function () {
    const total = this.totalPrice || 0;
    const paid = this.totalPaid || 0;
    if (total <= 0) return 0;
    return Math.min(100, Math.round((paid / total) * 100));
});

module.exports = mongoose.model("Order", orderSchema);
