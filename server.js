const express = require("express");
const dbConnecting = require("./src/config/database");
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

const app = express();

// Connect db
dbConnecting();

// Middleware
app.use(morgan("development"));
app.use(express.json());

// Mount Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/invoices", invoiceRouter);
app.use("/api/v1/clients", clientRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/sellers", sellerRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/warehouses", warehouseRouter);

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

// Server Start
const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
});

// Global Error Handling Outside Express
process.on("unhandledRejection", (err) => {
    console.log(`RejectionHandled Error: ${err.name} | ${err.message}`);
    server.close(() => {
        console.log("shutting down.....");
        process.exit(1);
    });
});
