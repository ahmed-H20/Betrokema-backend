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

// All warehouse and inventory operations require admin or manager authorization
router.use(protect, allowedTo("admin", "manager"));

// 1. Top 3 KPI Stats
router.get("/stats", getWarehousesStats);

// 2. Export Inventory Report (Excel / Table format)
router.get("/export", exportInventoryReport);

// 3. Stock Transfers (المناقلات المخزنية)
router.route("/transfers")
    .get(getStockTransfers)
    .post(createStockTransfer);

router.patch("/transfers/:transferId/status", updateStockTransferStatus);

// 4. Warehouse Specific Inventory Table & Assignment (جدول توزيع المنتجات والكميات)
router.route("/:id/inventory")
    .get(getWarehouseInventory)
    .post(assignProductToWarehouse);

router.route("/:id/inventory/:itemId")
    .put(updateWarehouseInventoryItem)
    .delete(removeProductFromWarehouse);

// 5. Standard Warehouses List & CRUD
router.route("/")
    .get(getAllWarehouses)
    .post(createWarehouse);

router.route("/:id")
    .get(getWarehouseById)
    .put(updateWarehouse)
    .delete(deleteWarehouse);

module.exports = router;
