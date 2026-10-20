const express = require("express");
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

// 1. Dashboard Inventory Stats & KPIs
router.get("/stats", getProductsDashboardStats);

// 2. Featured / Best Seller Product for Hero Banner
router.get("/featured", getFeaturedProduct);

// 3. Products by Category
router.get("/category/:category", getProductsByCategory);

// 4. Quick Actions (Buttons in product cards)
router.patch("/:id/stock-price", updateProductStockAndPrice);
router.post("/:id/supply-order", quickSupplyRequest);

// 5. Standard CRUD
router.route("/")
    .get(getAllProducts)
    .post(createProduct);

router.route("/:id")
    .get(getProductById)
    .put(updateProduct)
    .delete(deleteProduct);

module.exports = router;
