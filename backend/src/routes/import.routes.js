const express = require("express");
const multer = require("multer");

const { importStudents } = require("../controllers/import.controller");
const authenticateToken = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
    fileFilter: (req, file, cb) => {
        const isCsv =
            file.originalname.toLowerCase().endsWith(".csv") ||
            file.mimetype === "text/csv";

        if (!isCsv) {
            const error = new Error("Only .csv files are allowed.");
            error.statusCode = 400;
            return cb(error);
        }

        cb(null, true);
    },
});

// Converts multer errors (e.g. file too large) into clean 400 responses
const handleUpload = (req, res, next) => {
    upload.single("file")(req, res, (err) => {
        if (!err) return next();

        if (err instanceof multer.MulterError) {
            const message =
                err.code === "LIMIT_FILE_SIZE"
                    ? "CSV file is too large. Maximum size is 2 MB."
                    : err.message;

            return res.status(400).json({ success: false, message });
        }

        return res.status(err.statusCode || 400).json({
            success: false,
            message: err.message,
        });
    });
};

router.post(
    "/students",
    authenticateToken,
    allowRoles("TPO"),
    handleUpload,
    importStudents
);

module.exports = router;