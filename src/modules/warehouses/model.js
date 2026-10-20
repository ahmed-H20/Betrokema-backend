const mongoose = require("mongoose");

// Subdocument Schema for Product Inventory inside a Warehouse
const warehouseItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: [true, "معرف المنتج مطلوب"],
        },
        productName: {
            type: String,
            trim: true,
            default: "",
        },
        sku: {
            type: String,
            trim: true,
            default: "",
        },
        packagingUnit: {
            type: String,
            trim: true,
            default: "بستلة 14 لتر",
        },
        binLocation: {
            type: String,
            trim: true,
            default: "A-01-P01", // الممر والبالتة (مثال: A-12-P01)
        },
        currentStock: {
            type: Number,
            required: true,
            min: [0, "الرصيد الفعلي لا يمكن أن يكون سالباً"],
            default: 0,
        },
        reorderLevel: {
            type: Number,
            required: true,
            min: [0, "حد إعادة الطلب لا يمكن أن يكون سالباً"],
            default: 50,
        },
        stockStatus: {
            type: String,
            enum: ["متوفر بكثافة", "متوفر", "رصيد حرج (إعادة طلب)", "نفد الرصيد"],
            default: "متوفر",
        },
        notes: {
            type: String,
            trim: true,
            default: "",
        },
        lastAuditedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: true, timestamps: true }
);

// Auto-calculate stockStatus based on currentStock and reorderLevel
warehouseItemSchema.pre("validate", function () {
    if (this.currentStock === 0) {
        this.stockStatus = "نفد الرصيد";
    } else if (this.currentStock <= this.reorderLevel) {
        this.stockStatus = "رصيد حرج (إعادة طلب)";
    } else if (this.currentStock > this.reorderLevel * 3) {
        this.stockStatus = "متوفر بكثافة";
    } else {
        this.stockStatus = "متوفر";
    }
});

// Warehouse Schema
const warehouseSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "اسم المستودع / الفرع مطلوب"],
            trim: true,
        },
        code: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
        },
        governorate: {
            type: String,
            required: [true, "المحافظة الإقليمية مطلوبة"],
            trim: true,
        },
        address: {
            type: String,
            required: [true, "العنوان التفصيلي ومجمع المخازن مطلوب"],
            trim: true,
        },
        supervisorName: {
            type: String,
            trim: true,
            default: "",
        },
        supervisorPhone: {
            type: String,
            trim: true,
            default: "",
        },
        emergencyPhone: {
            type: String,
            trim: true,
            default: "",
        },
        capacityPallets: {
            type: Number,
            required: [true, "السعة الاستيعابية بالبالتات مطلوبة"],
            min: [1, "السعة يجب أن تكون على الأقل 1 بالتة"],
            default: 2000,
        },
        occupiedPallets: {
            type: Number,
            min: [0, "الطاقة المستغلة لا يمكن أن تكون سالبة"],
            default: 0,
        },
        operatingClassification: {
            type: String,
            trim: true,
            default: "مستودع رئيسي", // مستودع رئيسي، مستودع فرعي، مستودع مواد خام، مركز إقليمي
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        status: {
            type: String,
            enum: ["نشط", "جرد دوري", "معلق", "صيانة"],
            default: "نشط",
        },
        notes: {
            type: String,
            default: "",
        },
        inventory: {
            type: [warehouseItemSchema],
            default: [],
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual: Occupancy Rate Percentage
warehouseSchema.virtual("occupancyRate").get(function () {
    if (!this.capacityPallets || this.capacityPallets <= 0) return 0;
    return Math.min(100, Math.round(((this.occupiedPallets || 0) / this.capacityPallets) * 100));
});

// Virtual: Linked Products Count
warehouseSchema.virtual("linkedProductsCount").get(function () {
    return Array.isArray(this.inventory) ? this.inventory.length : 0;
});

// Virtual: Actual Total Stock Units in Warehouse
warehouseSchema.virtual("actualStockUnits").get(function () {
    if (!Array.isArray(this.inventory)) return 0;
    return this.inventory.reduce((acc, item) => acc + (item.currentStock || 0), 0);
});

// Auto-generate warehouse code if not provided
warehouseSchema.pre("save", function () {
    if (!this.code) {
        const rand = Math.floor(100 + Math.random() * 900);
        this.code = `WH-EGY-${rand}`;
    }
});

// Stock Transfer Schema (المناقلات بين المستودعات)
const stockTransferSchema = new mongoose.Schema(
    {
        transferCode: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
        },
        fromWarehouse: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Warehouse",
            required: [true, "المستودع المصدر مطلوب"],
        },
        toWarehouse: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Warehouse",
            required: [true, "المستودع الوجهة مطلوب"],
        },
        items: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true,
                },
                productName: {
                    type: String,
                    default: "",
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 1,
                },
                unit: {
                    type: String,
                    default: "بستلة",
                },
            },
        ],
        status: {
            type: String,
            enum: ["pending", "approved", "completed", "cancelled", "rejected"],
            default: "pending",
        },
        requestedBy: {
            type: String,
            default: "مسؤول اللوجستيات والتوزيع",
        },
        approvedBy: {
            type: String,
            default: "",
        },
        notes: {
            type: String,
            default: "",
        },
        requestedAt: {
            type: Date,
            default: Date.now,
        },
        completedAt: {
            type: Date,
        },
        isStockApplied: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

stockTransferSchema.pre("save", function () {
    if (!this.transferCode) {
        const rand = Math.floor(1000 + Math.random() * 9000);
        this.transferCode = `TR-${new Date().getFullYear()}-${rand}`;
    }
});

const Warehouse = mongoose.model("Warehouse", warehouseSchema);
const StockTransfer = mongoose.model("StockTransfer", stockTransferSchema);

module.exports = {
    Warehouse,
    StockTransfer,
};
