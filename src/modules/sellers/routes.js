const express = require("express");
const { protect, allowedTo } = require("../../middlewares/auth");
const {
    getSellersDashboardStats,
    getAllSellers,
    getSellerPerformance,
    getSellerById,
    createSeller,
    updateSeller,
    deleteSeller,
    resetSellerPassword,
} = require("./services");

const router = express.Router();

// 1. Reset Seller Password (Admin / Manager only)
router.post("/:id/reset-password", protect, allowedTo("admin", "manager"), resetSellerPassword);

// 2. Overall Team Stats (Admin / Manager only)
router.get("/stats", protect, allowedTo("admin", "manager"), getSellersDashboardStats);

// 3. Selected Seller Detailed Performance (Admin / Manager or the Seller themselves)
router.get("/:id/performance", protect, allowedTo("admin", "manager", "seller"), getSellerPerformance);

// 4. Standard List and CRUD
router.route("/")
    .get(protect, allowedTo("admin", "manager"), getAllSellers)
    .post(protect, allowedTo("admin", "manager"), createSeller);

router.route("/:id")
    .get(protect, allowedTo("admin", "manager", "seller"), getSellerById)
    .put(protect, allowedTo("admin", "manager"), updateSeller)
    .delete(protect, allowedTo("admin", "manager"), deleteSeller);

module.exports = router;
