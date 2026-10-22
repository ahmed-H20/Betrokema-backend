const { cloudinary, isCloudinaryConfigured } = require("../../config/cloudinary");
const ApiError = require("../../utils/ApiError");

/**
 * Upload buffer directly to Cloudinary using upload_stream
 * Works in serverless environments (e.g. Vercel) without writing to disk
 */
const uploadBufferToCloudinary = (buffer, originalName, folder = "general", resourceType = "auto") => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `petrokema/${folder}`,
                resource_type: resourceType,
                public_id: `${folder}-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        stream.end(buffer);
    });
};

/**
 * Fallback to base64 Data URL if Cloudinary is not configured or encounters permission issues
 */
const fallbackBufferToDataUrl = (file) => {
    const base64 = file.buffer.toString("base64");
    const dataUrl = `data:${file.mimetype};base64,${base64}`;
    const filename = `data-${Date.now()}`;
    return {
        secure_url: dataUrl,
        public_id: filename,
    };
};

// Helper to format consistent file response
const formatUploadResult = (file, uploadedResult) => {
    return {
        filename: uploadedResult.public_id || file.originalname,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: uploadedResult.secure_url,
        url: uploadedResult.secure_url,
    };
};

// 1. Single File Upload
const uploadSingleFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return next(new ApiError("لم يتم إرسال أي ملف للرفع", 400));
        }

        let type = req.query.type || req.body?.type || "general";
        type = String(type).replace(/[^a-zA-Z0-9_-]/g, "") || "general";

        let result;
        if (isCloudinaryConfigured()) {
            try {
                const resourceType = req.file.mimetype === "application/pdf" ? "raw" : "image";
                result = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname, type, resourceType);
            } catch (cloudErr) {
                console.error("Cloudinary upload failed, using fallback:", cloudErr.message || cloudErr);
                result = fallbackBufferToDataUrl(req.file);
            }
        } else {
            result = fallbackBufferToDataUrl(req.file);
        }

        const fileData = formatUploadResult(req.file, result);

        res.status(201).json({
            status: "success",
            message: "تم رفع الملف بنجاح",
            file: fileData,
            url: fileData.url,
            path: fileData.path,
        });
    } catch (err) {
        next(new ApiError(`فشل في معالجة الملف: ${err.message || err}`, 500));
    }
};

// 2. Multiple Files Upload
const uploadMultipleFiles = async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return next(new ApiError("لم يتم إرسال أي ملفات للرفع", 400));
        }

        let type = req.query.type || req.body?.type || "general";
        type = String(type).replace(/[^a-zA-Z0-9_-]/g, "") || "general";

        const uploadPromises = req.files.map(async (file) => {
            let result;
            if (isCloudinaryConfigured()) {
                try {
                    const resourceType = file.mimetype === "application/pdf" ? "raw" : "image";
                    result = await uploadBufferToCloudinary(file.buffer, file.originalname, type, resourceType);
                } catch (cloudErr) {
                    console.error("Cloudinary upload failed for file, using fallback:", cloudErr.message || cloudErr);
                    result = fallbackBufferToDataUrl(file);
                }
            } else {
                result = fallbackBufferToDataUrl(file);
            }
            return formatUploadResult(file, result);
        });

        const filesData = await Promise.all(uploadPromises);

        res.status(201).json({
            status: "success",
            message: `تم رفع ${filesData.length} ملفات بنجاح`,
            results: filesData.length,
            files: filesData,
            urls: filesData.map((f) => f.url),
            paths: filesData.map((f) => f.path),
        });
    } catch (err) {
        next(new ApiError(`فشل في معالجة الملفات: ${err.message || err}`, 500));
    }
};

module.exports = {
    uploadSingleFile,
    uploadMultipleFiles,
};
