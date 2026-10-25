const express = require("express");
const { protect } = require("../../middlewares/auth");
const {
    getMyNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
} = require("./controller");

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get("/", getMyNotifications);
router.patch("/mark-all-read", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);
router.delete("/:id", deleteNotification);

module.exports = router;
