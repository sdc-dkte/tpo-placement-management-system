const express = require("express");

const allowRoles = require("../middleware/role.middleware");
const handleDocumentUpload = require("../middleware/upload.middleware");

const {
    getMyDocument,
    uploadDocument,
    deleteDocument,
    downloadDocument,
    getAllDocumentsForTPO,
} = require("../controllers/document.controller");

const authenticateToken = require("../middleware/auth.middleware");

const router = express.Router();

router.get(
    "/student",
    authenticateToken,
    allowRoles("STUDENT"),
    getMyDocument
);

router.post(
    "/student",
    authenticateToken,
    allowRoles("STUDENT"),
    handleDocumentUpload,
    uploadDocument
);

router.delete(
    "/student/:id",
    authenticateToken,
    allowRoles("STUDENT"),
    deleteDocument
);

router.get(
    "/:id/download",
    authenticateToken,
    allowRoles("TPO", "STUDENT"),
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