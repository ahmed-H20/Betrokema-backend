const express = require("express");
const { protect, allowedTo, optionalAuth } = require("../../middlewares/auth");
const {
    createClient,
    updateClient,
    deleteClient,
    getAllClients,
    getClientsForSeller,
    updateClientCreditDebt,
    getClientById,
    resetClientPassword,
} = require("./services");

const router = express.Router();

// 1. Reset Client Password (Admin, Manager, or Assigned Seller)
router.post("/:id/reset-password", protect, allowedTo("admin", "manager", "seller"), resetClientPassword);

// 2. Seller Clients Portfolio (Admin / Manager / Seller)
router.get("/seller/:sellerId", protect, allowedTo("admin", "manager", "seller"), getClientsForSeller);

// 3. Quick Action: Update Credit Limit and Debt
router.patch("/:id/credit-debt", protect, allowedTo("admin", "manager", "seller"), updateClientCreditDebt);

// 4. Standard List and CRUD
router.route("/")
    .get(protect, allowedTo("admin", "manager", "seller"), getAllClients)
    .post(optionalAuth, createClient);

router.route("/:id")
    .get(protect, allowedTo("admin", "manager", "seller", "client"), getClientById)
    .put(protect, allowedTo("admin", "manager", "seller", "client"), updateClient)
    .delete(protect, allowedTo("admin", "manager"), deleteClient);

module.exports = router;
