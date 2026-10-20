// Helper to generate unique code for any model (Order, Product, etc.)
const generateCode = async (model, prefix) => {
    let unique = false;
    let code = "";
    while (!unique) {
        const rand = Math.floor(100000 + Math.random() * 900000);
        code = `${prefix}-${rand}`;
        const existing = await model.findOne({
            $or: [
                { code: code },
                { invoiceCode: code },
            ],
        });
        if (!existing) {
            unique = true;
        }
    }
    return code;
};

module.exports = generateCode;
