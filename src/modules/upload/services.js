const ApiError = require("../../utils/ApiError");

// Helper to format file response with both relative path and full URL
const formatFileResponse = (req, file) => {
    // Relative path normalized to POSIX slashes (e.g., /uploads/products/file-123.png)
    const relativePart = file.path.split(/uploads[\\/]/)[1];
    const relativePath = `/uploads/${relativePart}`.replace(/\\/g, "/");

    const protocol = req.protocol || "http";
    const host = req.get("host") || "localhost:8400";
    const fullUrl = `${protocol}://${host}${relativePath}`;

    return {
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: relativePath,
        url: fullUrl,
    };
};

// 1. Single File Upload
const uploadSingleFile = (req, res, next) => {
    try {
        if (!req.file) {
            return next(new ApiError("لم يتم إرسال أي ملف للرفع", 400));
        }

        const fileData = formatFileResponse(req, req.file);

        res.status(201).json({
            status: "success",
            message: "تم رفع الملف بنجاح",
            file: fileData,
            url: fileData.url,
            path: fileData.path,
        });
    } catch (err) {
        next(err);
    }
};

// 2. Multiple Files Upload
const uploadMultipleFiles = (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return next(new ApiError("لم يتم إرسال أي ملفات للرفع", 400));
        }

        const filesData = req.files.map((f) => formatFileResponse(req, f));

        res.status(201).json({
            status: "success",
            message: `تم رفع ${filesData.length} ملفات بنجاح`,
            results: filesData.length,
            files: filesData,
            urls: filesData.map((f) => f.url),
            paths: filesData.map((f) => f.path),
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    uploadSingleFile,
    uploadMultipleFiles,
};
