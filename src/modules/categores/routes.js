const express = require("express");
const { protect, allowedTo } = require("../../middlewares/auth");
const {
    createCategory,
    updateCategory,
    deleteCategory,
    getAllCategories,
    getCategoryById,
} = require("./services");

const router = express.Router();

router.get("/", getAllCategories);
router.get("/:id", getCategoryById);

router.post("/", protect, allowedTo("admin", "manager"), createCategory);
router.put("/:id", protect, allowedTo("admin", "manager"), updateCategory);
router.delete("/:id", protect, allowedTo("admin", "manager"), deleteCategory);

module.exports = router;