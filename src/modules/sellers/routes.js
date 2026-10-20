const express = require("express");
const {
    getSellersDashboardStats,
    getAllSellers,
    getSellerPerformance,
    getSellerById,
    createSeller,
    updateSeller,
    deleteSeller,
} = require("./services");

const router = express.Router();

// 1. Overall Team Stats (Top 4 KPIs)
router.get("/stats", getSellersDashboardStats);

// 2. Selected Seller Detailed Performance (Banner Metrics)
router.get("/:id/performance", getSellerPerformance);

// 3. Standard List and CRUD
router.route("/")
    .get(getAllSellers)
    .post(createSeller);

router.route("/:id")
    .get(getSellerById)
    .put(updateSeller)
    .delete(deleteSeller);

module.exports = router;
