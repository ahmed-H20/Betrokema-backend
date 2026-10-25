const express = require("express");
const { sendNotification } = require("../notifications/service");
const Client = require("../clients/model");

const router = express.Router();

// Public endpoint for customer contact / quote requests from the paints website
router.post("/", async (req, res, next) => {
    try {
        const { name, phone, email, category, message, productName, productId } = req.body;

        if (!name || !phone) {
            return res.status(400).json({
                status: "fail",
                message: "الاسم ورقم الهاتف مطلوبان للتواصل",
            });
        }

        // Send real-time notification to admin and managers via WebSockets & DB
        await sendNotification({
            title: "طلب استشارة / عرض أسعار جديد من الموقع",
            message: `طلب من العميل: ${name} (هاتف: ${phone})${productName ? ` للمنتج: ${productName}` : ""}${category ? ` - قسم: ${category}` : ""}${message ? ` - تفاصيل: ${message}` : ""}`,
            type: "order",
            role: "management",
            link: "/admin/orders",
        });

        // Optionally create client record if not already present
        try {
            const existingClient = await Client.findOne({ phone: phone.trim() });
            if (!existingClient) {
                await Client.create({
                    name: name.trim(),
                    organizeName: `عميل موقع - ${name.trim()}`,
                    phone: phone.trim(),
                    contactPerson: name.trim(),
                    address: message ? message.slice(0, 100) : "طلب من موقع بتروكيما للدهانات",
                });
            }
        } catch (clientErr) {
            // Ignore client creation errors so request still succeeds
            console.warn("[Contact Route] Notice creating client lead:", clientErr.message);
        }

        res.status(200).json({
            status: "success",
            message: "تم استلام طلبك بنجاح! سيتواصل معك أحد مستشاري بتروكيما في أقرب وقت.",
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
