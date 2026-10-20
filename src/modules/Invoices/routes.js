const express = require("express");
const { optionalAuth } = require("../../middlewares/auth");
const {
    getAllOrders,
    getOrderById,
    createOrder,
    updateOrder,
    deleteOrder,
    updateOrderStatus,
    addPaymentToInvoice,
    getInvoicesDashboardStats,
    getOrdersForSeller,
    getTotalProfitforSeller,
    getOrdersForClient,
    getTotalProfitforClient,
} = require("./services");

const router = express.Router();

// 1. Dashboard KPIs & Metrics
router.get("/stats", getInvoicesDashboardStats);

// 2. Seller specific routes
router.get("/seller/:sellerId", getOrdersForSeller);
router.get("/seller/:sellerId/profit", getTotalProfitforSeller);

// 3. Client specific routes
router.get("/client/:clientId", getOrdersForClient);
router.get("/client/:clientId/profit", getTotalProfitforClient);

// 4. Status Action & Payment Sub-resources
router.patch("/:id/status", updateOrderStatus);
router.post("/:id/payments", addPaymentToInvoice);

// 4. Standard CRUD Endpoints
router.route("/")
    .get(optionalAuth, getAllOrders)
    .post(optionalAuth, createOrder);

router.route("/:id")
    .get(getOrderById)
    .put(updateOrder)
    .delete(deleteOrder);

module.exports = router;
