const ApiError = require("../../utils/ApiError");
const Notification = require("./model");
const {
    getUserNotifications,
    markAsRead,
    markAllAsRead,
} = require("./service");

/**
 * Get current user notifications
 */
const getMyNotifications = async (req, res, next) => {
    try {
        const userId = req.user._id || req.user.id;
        const role = req.user.role;
        const limit = Number(req.query.limit) || 30;

        const result = await getUserNotifications(userId, role, limit);

        res.status(200).json({
            status: "success",
            data: result.notifications,
            unreadCount: result.unreadCount,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Mark a single notification as read
 */
const markNotificationRead = async (req, res, next) => {
    try {
        const userId = req.user._id || req.user.id;
        const { id } = req.params;

        const updated = await markAsRead(id, userId);
        if (!updated) {
            return next(new ApiError("الإشعار غير موجود", 404));
        }

        res.status(200).json({
            status: "success",
            message: "تم تحديد الإشعار كمقروء",
            data: updated,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Mark all notifications as read
 */
const markAllNotificationsRead = async (req, res, next) => {
    try {
        const userId = req.user._id || req.user.id;
        const role = req.user.role;

        await markAllAsRead(userId, role);

        res.status(200).json({
            status: "success",
            message: "تم تحديد جميع الإشعارات كمقروءة",
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Delete a notification
 */
const deleteNotification = async (req, res, next) => {
    try {
        const { id } = req.params;
        const deleted = await Notification.findByIdAndDelete(id);

        if (!deleted) {
            return next(new ApiError("الإشعار غير موجود", 404));
        }

        res.status(200).json({
            status: "success",
            message: "تم حذف الإشعار بنجاح",
            data: null,
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getMyNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
};
