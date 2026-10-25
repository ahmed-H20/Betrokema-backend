const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // Authentication middleware for WebSocket handshake
    io.use((socket, next) => {
        try {
            const token =
                socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.replace("Bearer ", "");

            if (!token) {
                // Allow guest connection with limited access, or reject if strict
                return next(new Error("Authentication token required"));
            }

            const secret = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET;
            if (!secret) {
                return next(new Error("JWT Secret missing on server"));
            }

            const decoded = jwt.verify(token, secret);
            socket.user = decoded;
            next();
        } catch (err) {
            return next(new Error("Invalid or expired authentication token"));
        }
    });

    io.on("connection", (socket) => {
        const user = socket.user;
        const userId = user?.id || user?.userId || user?._id;
        const role = user?.role;

        // Join individual user room
        if (userId) {
            socket.join(`user_${userId}`);
        }

        // Join role room (e.g. role_admin, role_seller, role_client)
        if (role) {
            socket.join(`role_${role}`);
            // Also admins and managers can listen to management notifications
            if (role === "admin" || role === "manager") {
                socket.join("role_management");
            }
        }

        socket.on("disconnect", (reason) => {
            // Clean disconnect
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error("Socket.io has not been initialized yet!");
    }
    return io;
};

module.exports = {
    initSocket,
    getIO,
};
