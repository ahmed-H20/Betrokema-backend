const multer = require("multer");
const ApiError = require("../../utils/ApiError");

// Allowed mime types (Images & Documents)
const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "application/pdf",
];

// Memory storage for serverless environments (Vercel) & direct Cloudinary streaming
const storage = multer.memoryStorage();

// File Filter
const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new ApiError(
                "نوع الملف غير مدعوم. يسمح فقط بالصور بصيغ (JPEG, PNG, WebP, GIF, SVG) أو مستندات PDF",
                400
            ),
            false
        );
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
});

module.exports = {
    upload,
    ALLOWED_MIME_TYPES,
};
