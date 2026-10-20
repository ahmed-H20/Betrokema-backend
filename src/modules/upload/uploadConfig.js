const multer = require("multer");
const path = require("path");
const fs = require("fs");
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

// Base storage directory: <ServerRoot>/uploads
const UPLOADS_BASE_DIR = path.join(__dirname, "../../../uploads");

// Multer Disk Storage with automatic subfolder creation
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let subfolder = req.query.type || req.body?.type || "general";
        subfolder = String(subfolder).replace(/[^a-zA-Z0-9_-]/g, "");
        if (!subfolder) subfolder = "general";

        const targetDir = path.join(UPLOADS_BASE_DIR, subfolder);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        let prefix = req.query.type || req.body?.type || "file";
        prefix = String(prefix).replace(/[^a-zA-Z0-9_-]/g, "");
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${prefix}-${uniqueSuffix}${ext}`);
    },
});

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
    UPLOADS_BASE_DIR,
};
