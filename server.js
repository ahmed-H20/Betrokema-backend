const express = require("express");
const http = require("http");
const dbConnecting = require("./src/config/database");
const { initSocket } = require("./src/config/socket");
const GlobalError = require("./src/middlewares/error");
const ApiError = require("./src/utils/ApiError");
const morgan = require("morgan");
const dotenv = require("dotenv");
dotenv.config();

// Route Handlers
const authRouter = require("./src/modules/auth/routes");
const invoiceRouter = require("./src/modules/Invoices/routes");
const clientRouter = require("./src/modules/clients/routes");
const productRouter = require("./src/modules/products/routes");
const categoryRouter = require("./src/modules/categores/routes");
const sellerRouter = require("./src/modules/sellers/routes");
const userRouter = require("./src/modules/users/routes");
const warehouseRouter = require("./src/modules/warehouses/routes");
const uploadRouter = require("./src/modules/upload/routes");
const notificationRouter = require("./src/modules/notifications/routes");
const contactRouter = require("./src/modules/contact/routes");
const path = require("path");

const cors = require("cors");

const app = express();

// Connect db
dbConnecting();

// Middleware
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Mount Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/invoices", invoiceRouter);
app.use("/api/v1/clients", clientRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/sellers", sellerRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/warehouses", warehouseRouter);
app.use("/api/v1/upload", uploadRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/contact", contactRouter);

app.use("/test", (req, res) => {
    res.json({ message: "hello world" });
});

// Not found route
app.use((req, res, next) => {
    const message = `cant find this : ${req.originalUrl}`;
    next(new ApiError(message, 404));
});

// Global Error Handling in Express
app.use(GlobalError);

// Create HTTP Server & initialize Socket.io
const server = http.createServer(app);
initSocket(server);

// Server Start
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running with WebSockets on port ${PORT}`);
});

// Global Error Handling Outside Express
process.on("unhandledRejection", (err) => {
    console.log(`RejectionHandled Error: ${err.name} | ${err.message}`);
    server.close(() => {
        console.log("shutting down.....");
        process.exit(1);
    });
});

module.exports = app;


