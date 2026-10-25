const express = require("express");
const multer = require("multer");
const path = require("path");

const allowRoles = require("../middleware/role.middleware");

const {
    getMyDocument,
    uploadDocument,
    deleteDocument,
    downloadDocument,
    getAllDocumentsForTPO,
} = require("../controllers/document.controller");

const authenticateToken = require("../middleware/auth.middleware");

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/documents");
    },

    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },

    fileFilter: (req, file, cb) => {
        const allowedExtensions = [
            ".pdf",
            ".jpg",
            ".jpeg",
            ".png",
        ];

        const extension = path
            .extname(file.originalname)
            .toLowerCase();

        if (!allowedExtensions.includes(extension)) {
            return cb(
                new Error(
                    "Only PDF, JPG, JPEG and PNG files are allowed."
                )
            );
        }

        cb(null, true);
    },
});

router.get(
    "/student",
    authenticateToken,
    getMyDocument
);

router.post(
    "/student",
    authenticateToken,
    upload.single("file"),
    uploadDocument
);

router.delete(
    "/student/:id",
    authenticateToken,
    deleteDocument
);

router.get(
    "/:id/download",
    authenticateToken,
    downloadDocument
);

// TPO: view all student documents
router.get(
    "/tpo",
    authenticateToken,
    allowRoles("TPO"),
    getAllDocumentsForTPO
);

module.exports = router;