const express = require("express");
const router = express.Router();
const { upload } = require("./uploadConfig");
const { uploadSingleFile, uploadMultipleFiles } = require("./services");
const { protect } = require("../../middlewares/auth");

// Lock upload endpoints to authenticated users
router.use(protect);

// Accept 'file' or 'image' field for single file upload
router.post(
    "/single",
    (req, res, next) => {
        upload.single("file")(req, res, (err) => {
            if (err) return next(err);
            if (!req.file) {
                // Try fallback to 'image' field name if 'file' was not sent
                return upload.single("image")(req, res, next);
            }
            next();
        });
    },
    uploadSingleFile
);

// Convenient alias for POST / (single file)
router.post(
    "/",
    (req, res, next) => {
        upload.single("file")(req, res, (err) => {
            if (err) return next(err);
            if (!req.file) {
                return upload.single("image")(req, res, next);
            }
            next();
        });
    },
    uploadSingleFile
);

// Multiple files upload (field 'files' or 'images', max 10 files)
router.post(
    "/multiple",
    (req, res, next) => {
        upload.array("files", 10)(req, res, (err) => {
            if (err) return next(err);
            if (!req.files || req.files.length === 0) {
                return upload.array("images", 10)(req, res, next);
            }
            next();
        });
    },
    uploadMultipleFiles
);

module.exports = router;
