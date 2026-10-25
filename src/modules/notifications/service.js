const Notification = require("./model");
const { getIO } = require("../../config/socket");

/**
 * Send real-time notification & save to DB
 */
const sendNotification = async ({
    recipientId = null,
    role = null,
    title,
    message,
    type = "system",
    relatedId = null,
    link = "",
}) => {
    try {
        const doc = await Notification.create({
            recipient: recipientId || null,
            recipientRole: role || null,
            title,
            message,
            type,
            relatedId: relatedId || null,
            link: link || "",
        });

        // Broadcast via Socket.io
        try {
            const io = getIO();
            if (recipientId) {
                io.to(`user_${recipientId}`).emit("new_notification", doc);
            }
            if (role) {
                io.to(`role_${role}`).emit("new_notification", doc);
            }
            if (!recipientId && !role) {
                io.emit("new_notification", doc);
            }
        } catch (socketErr) {
            console.warn("Socket broadcast warning (clients may not be listening yet):", socketErr.message);
        }

        return doc;
    } catch (err) {
        console.error("sendNotification error:", err);
        return null;
    }
};

/**
 * Build Mongoose query for current user's visible notifications
 */
const getQueryForUser = (userId, role) => {
    const orConditions = [{ recipient: userId }];

    if (role) {
        orConditions.push({ recipientRole: role }, { recipientRole: "all" });
        if (role === "admin" || role === "manager") {
            orConditions.push({ recipientRole: "management" });
        }
    }

    return { $or: orConditions };
};

/**
 * Get user notifications with computed read status and unread count
 */
const getUserNotifications = async (userId, role, limit = 40) => {
    const baseQuery = getQueryForUser(userId, role);

    const notifications = await Notification.find(baseQuery)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

    // Map isRead flag based on user
    const formatted = notifications.map((n) => {
        const isRead = n.recipient
            ? Boolean(n.isRead)
            : Array.isArray(n.readBy) && n.readBy.some((id) => id.toString() === userId.toString());

        return {
            ...n,
            isRead,
        };
    });

    // Unread count
    const unreadCount = formatted.filter((n) => !n.isRead).length;

    return {
        notifications: formatted,
        unreadCount,
    };
};

/**
 * Mark a single notification as read
 */
const markAsRead = async (notificationId, userId) => {
    const notif = await Notification.findById(notificationId);
    if (!notif) return null;

    if (notif.recipient && notif.recipient.toString() === userId.toString()) {
        notif.isRead = true;
    } else {
        if (!Array.isArray(notif.readBy)) notif.readBy = [];
        if (!notif.readBy.some((id) => id.toString() === userId.toString())) {
            notif.readBy.push(userId);
        }
    }

    await notif.save();
    return notif;
};

/**
 * Mark all notifications for this user as read
 */
const markAllAsRead = async (userId, role) => {
    const baseQuery = getQueryForUser(userId, role);

    // 1. Mark direct user notifications
    await Notification.updateMany(
        { recipient: userId, isRead: false },
        { $set: { isRead: true } }
    );

    // 2. Add userId to readBy for role-based notifications
    if (role) {
        const roleQuery = {
            recipient: null,
            recipientRole: { $in: [role, "all", ...(role === "admin" || role === "manager" ? ["management"] : [])] },
            readBy: { $ne: userId },
        };
        await Notification.updateMany(roleQuery, {
            $addToSet: { readBy: userId },
        });
    }

    return true;
};

module.exports = {
    sendNotification,
    getUserNotifications,
    markAsRead,
    markAllAsRead,
};
