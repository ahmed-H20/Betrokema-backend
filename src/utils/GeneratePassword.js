// Generate an easy-to-remember numeric PIN password (e.g. 6 digits: "582941")
const generateEasyPassword = (digits = 6) => {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
};

module.exports = generateEasyPassword;
