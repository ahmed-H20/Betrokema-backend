const express = require("express");
const { login, getMe, changePassword } = require("./services");
const { protect } = require("../../middlewares/auth");

const router = express.Router();

router.post("/login", login);
router.get("/me", protect, getMe);
router.put("/change-password", protect, changePassword);

module.exports = router;
