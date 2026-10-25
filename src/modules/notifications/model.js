const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            index: true,
            default: null,
        },
        recipientRole: {
            type: String,
            enum: ["admin", "manager", "seller", "client", "management", "all"],
            default: null,
            index: true,
        },
        title: {
            type: String,
            required: [true, "عنوان الإشعار مطلوب"],
            trim: true,
        },
        message: {
            type: String,
            required: [true, "نص الإشعار مطلوب"],
            trim: true,
        },
        type: {
            type: String,
            enum: ["invoice", "stock", "client", "payment", "system"],
            default: "system",
        },
        relatedId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        link: {
            type: String,
            default: "",
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        readBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Indexes for fast lookup
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipientRole: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
