const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "اسم المستخدم مطلوب"],
            trim: true,
        },
        code: {
            type: String,
            trim: true,
            unique: true,
            sparse: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        password: {
            type: String,
            required: [true, "كلمة المرور مطلوبة"],
            minlength: [6, "كلمة المرور يجب أن لا تقل عن 6 أحرف أو أرقام"],
            select: false,
        },
        role: {
            type: String,
            enum: ["admin", "manager", "accountant", "seller", "client"],
            default: "seller",
        },
        sellerProfile: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seller",
        },
        clientProfile: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 12);
});

// Compare password helper
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);

