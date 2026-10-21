const express = require("express");
const { protect, allowedTo, optionalAuth } = require("../../middlewares/auth");
const {
    getAllOrders,
    getOrderById,
    createOrder,
    updateOrder,
    deleteOrder,
    updateOrderStatus,
    addPaymentToInvoice,
    getInvoicesDashboardStats,
    getExecutiveAnalytics,
    getOrdersForSeller,
    getTotalProfitforSeller,
    getOrdersForClient,
    getTotalProfitforClient,
} = require("./services");

const router = express.Router();

// 1. Dashboard KPIs & Executive Analytics (Admin / Manager)
router.get("/stats", protect, allowedTo("admin", "manager"), getInvoicesDashboardStats);
router.get("/analytics", optionalAuth, getExecutiveAnalytics);

// 2. Seller specific routes (Admin / Manager / Seller)
router.get("/seller/:sellerId", protect, allowedTo("admin", "manager", "seller"), getOrdersForSeller);
router.get("/seller/:sellerId/profit", protect, allowedTo("admin", "manager", "seller"), getTotalProfitforSeller);

// 3. Client specific routes (Admin / Manager / Seller / Client)
router.get("/client/:clientId", protect, allowedTo("admin", "manager", "seller", "client"), getOrdersForClient);
router.get("/client/:clientId/profit", protect, allowedTo("admin", "manager", "seller", "client"), getTotalProfitforClient);

// 4. Status Action & Payment Sub-resources
router.patch("/:id/status", protect, allowedTo("admin", "manager", "seller"), updateOrderStatus);
router.post("/:id/payments", protect, allowedTo("admin", "manager", "seller"), addPaymentToInvoice);

// 5. Standard CRUD Endpoints
router.route("/")
    .get(optionalAuth, getAllOrders)
    .post(optionalAuth, createOrder);

router.route("/:id")
    .get(optionalAuth, getOrderById)
    .put(protect, allowedTo("admin", "manager", "seller"), updateOrder)
    .delete(protect, allowedTo("admin", "manager"), deleteOrder);

module.exports = router;
