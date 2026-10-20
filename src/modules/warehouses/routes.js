const express = require("express");
const { protect, allowedTo } = require("../../middlewares/auth");
const {
    getWarehousesStats,
    getAllWarehouses,
    getWarehouseById,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    getWarehouseInventory,
    assignProductToWarehouse,
    updateWarehouseInventoryItem,
    removeProductFromWarehouse,
    getStockTransfers,
    createStockTransfer,
    updateStockTransferStatus,
    exportInventoryReport,
} = require("./services");

const router = express.Router();

// All operations require authentication
router.use(protect);

// 1. Top 3 KPI Stats
router.get("/stats", allowedTo("admin", "manager", "seller"), getWarehousesStats);

// 2. Export Inventory Report (Excel / Table format)
router.get("/export", allowedTo("admin", "manager"), exportInventoryReport);

// 3. Stock Transfers (المناقلات المخزنية)
router.route("/transfers")
    .get(allowedTo("admin", "manager", "seller"), getStockTransfers)
    .post(allowedTo("admin", "manager"), createStockTransfer);

router.patch("/transfers/:transferId/status", allowedTo("admin", "manager"), updateStockTransferStatus);

// 4. Warehouse Specific Inventory Table & Assignment (جدول توزيع المنتجات والكميات)
router.route("/:id/inventory")
    .get(allowedTo("admin", "manager", "seller"), getWarehouseInventory)
    .post(allowedTo("admin", "manager"), assignProductToWarehouse);

router.route("/:id/inventory/:itemId")
    .put(allowedTo("admin", "manager"), updateWarehouseInventoryItem)
    .delete(allowedTo("admin", "manager"), removeProductFromWarehouse);

// 5. Standard Warehouses List & CRUD
router.route("/")
    .get(allowedTo("admin", "manager", "seller"), getAllWarehouses)
    .post(allowedTo("admin", "manager"), createWarehouse);

router.route("/:id")
    .get(allowedTo("admin", "manager", "seller"), getWarehouseById)
    .put(allowedTo("admin", "manager"), updateWarehouse)
    .delete(allowedTo("admin", "manager"), deleteWarehouse);

module.exports = router;
