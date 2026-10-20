const express = require("express");
const { optionalAuth } = require("../../middlewares/auth");
const {
    createClient,
    updateClient,
    deleteClient,
    getAllClients,
    getClientsForSeller,
    updateClientCreditDebt,
    getClientById,
} = require("./services");

const router = express.Router();

// 1. Seller Clients Portfolio (محفظة عملاء المندوب)
router.get("/seller/:sellerId", getClientsForSeller);

// 2. Quick Action: Update Credit Limit and Debt
router.patch("/:id/credit-debt", updateClientCreditDebt);

// 3. Standard List and CRUD
router.route("/")
    .get(getAllClients)
    .post(optionalAuth, createClient);

router.route("/:id")
    .get(getClientById)
    .put(updateClient)
    .delete(deleteClient);

module.exports = router;
