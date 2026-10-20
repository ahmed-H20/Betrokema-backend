const express = require("express");
const { protect, allowedTo } = require("../../middlewares/auth");
const {
    getProductsDashboardStats,
    getFeaturedProduct,
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    updateProductStockAndPrice,
    quickSupplyRequest,
    deleteProduct,
    getProductsByCategory,
} = require("./services");

const router = express.Router();

// 1. Dashboard Inventory Stats & KPIs (Admin / Staff)
router.get("/stats", protect, allowedTo("admin", "manager"), getProductsDashboardStats);

// 2. Featured / Best Seller Product for Hero Banner (Public)
router.get("/featured", getFeaturedProduct);

// 3. Products by Category (Public)
router.get("/category/:category", getProductsByCategory);

// 4. Quick Actions (Admin / Manager only)
router.patch("/:id/stock-price", protect, allowedTo("admin", "manager"), updateProductStockAndPrice);
router.post("/:id/supply-order", protect, allowedTo("admin", "manager"), quickSupplyRequest);

// 5. Standard CRUD
router.route("/")
    .get(getAllProducts)
    .post(protect, allowedTo("admin", "manager"), createProduct);

router.route("/:id")
    .get(getProductById)
    .put(protect, allowedTo("admin", "manager"), updateProduct)
    .delete(protect, allowedTo("admin", "manager"), deleteProduct);

module.exports = router;
