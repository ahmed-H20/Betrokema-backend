const express = require("express");
const { createCategory, updateCategory, deleteCategory, getAllCategories, getCategoryById } = require("./services");
const router = express.Router();

router.post("/", createCategory);
router.get("/", getAllCategories);
router.get("/:id", getCategoryById);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

module.exports = router;