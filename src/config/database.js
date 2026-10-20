const mongoose = require("mongoose");

const dbConnecting = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log("db connected Successfully✅");
    } catch (err) {
        console.error(`error on connection with db💥: ${err.message || err}`);
        console.log("Retrying database connection in 3 seconds...");
        setTimeout(dbConnecting, 3000);
    }
};

module.exports = dbConnecting;
