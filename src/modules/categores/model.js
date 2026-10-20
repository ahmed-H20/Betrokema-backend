const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "اسم التصنيف بالعربية مطلوب"],
            trim: true,
        },
        nameEn: {
            type: String,
            trim: true,
            default: "",
        },
        code: {
            type: String,
            trim: true,
        },
        description: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }
);

// Auto-generate code if not provided
categorySchema.pre("save", function () {
    if (!this.code) {
        if (this.nameEn) {
            this.code = this.nameEn.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
        } else {
            this.code = `CAT-${Math.floor(1000 + Math.random() * 9000)}`;
        }
    }
});

module.exports = mongoose.model("Category", categorySchema);
