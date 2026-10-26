const prisma = require("../prismaClient");
const fs = require("fs/promises");
const {
    isRealPathInsideUploadDirectory,
    removeUploadedFile,
    resolveDocumentPath,
} = require("../utils/documentFiles");

const SUPPORTED_DOCUMENT_TYPES = new Set([
    "RESUME",
    "TRANSCRIPT",
    "CERTIFICATE",
    "OTHER",
]);

const parseDocumentId = (value) => {
    if (typeof value !== "string" || !/^\d+$/.test(value)) return null;

    const documentId = Number(value);
    return Number.isSafeInteger(documentId) && documentId > 0
        ? documentId
        : null;
};

const getDocumentFilePath = (document) => {
    const filePath = resolveDocumentPath(document.fileUrl);

    if (!filePath) {
        console.error(`Invalid upload path for document ${document.id}.`);
    }

    return filePath;
};

const getMyDocument = async (req, res) => {
    try {
        const student = await prisma.student.findUnique({
            where: {
                userId: req.user.id,
            },
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student profile not found.",
            });
        }

        const documents = await prisma.studentDocument.findMany({
            where: {
                studentId: student.id,
            },
            orderBy: {
                uploadedAt: "desc",
            },
        });

        return res.status(200).json({
            success: true,
            documents,
        });
    } catch (error) {
        console.error("Error fetching student documents:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch documents.",
        });
    }
};

const uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload a document.",
            });
        }

        const documentType = String(req.body.documentType || "")
            .trim()
            .toUpperCase();

        if (!SUPPORTED_DOCUMENT_TYPES.has(documentType)) {
            await removeUploadedFile(req.file);
            return res.status(400).json({
                success: false,
                message:
                    "Document type must be RESUME, TRANSCRIPT, CERTIFICATE or OTHER.",
            });
        }

        const student = await prisma.student.findUnique({
            where: {
                userId: req.user.id,
            },
        });

        if (!student) {
            await removeUploadedFile(req.file);
            return res.status(404).json({
                success: false,
                message: "Student profile not found.",
            });
        }

        const document = await prisma.studentDocument.create({
            data: {
                studentId: student.id,
                uploadedByUserId: req.user.id,
                documentType,
                fileName: req.file.originalname,
                fileUrl: `/uploads/documents/${req.file.filename}`,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Document uploaded successfully.",
            document,
        });
    } catch (error) {
        console.error("Error uploading document:", error);
        await removeUploadedFile(req.file);

        return res.status(500).json({
            success: false,
            message: "Failed to upload document.",
        });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const student = await prisma.student.findUnique({
            where: {
                userId: req.user.id,
            },
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student profile not found.",
            });
        }

        const documentId = parseDocumentId(req.params.id);

        if (!documentId) {
            return res.status(400).json({
                success: false,
                message: "Invalid document ID.",
            });
        }

        const document = await prisma.studentDocument.findFirst({
            where: {
                id: documentId,
                studentId: student.id,
            },
        });

        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found.",
            });
        }

        const filePath = getDocumentFilePath(document);

        if (!filePath) {
            return res.status(500).json({
                success: false,
                message: "Document file path is invalid on server.",
            });
        }

        try {
            const actualPath = await fs.realpath(filePath);
            if (!(await isRealPathInsideUploadDirectory(actualPath))) {
                return res.status(500).json({
                    success: false,
                    message: "Document file path is invalid on server.",
                });
            }
            await fs.unlink(filePath);
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
        }

        await prisma.studentDocument.delete({
            where: {
                id: document.id,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Document deleted successfully.",
        });
    } catch (error) {
        console.error("Error deleting document:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete document.",
        });
    }
};

const downloadDocument = async (req, res) => {
    try {
        const documentId = parseDocumentId(req.params.id);

        if (!documentId) {
            return res.status(400).json({
                success: false,
                message: "Invalid document ID.",
            });
        }

        const document = await prisma.studentDocument.findUnique({
            where: {
                id: documentId,
            },
        });

        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found.",
            });
        }

        // TPO can access any student document.
        if (req.user.role !== "TPO") {
            const student = await prisma.student.findUnique({
                where: {
                    userId: req.user.id,
                },
            });

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: "Student profile not found.",
                });
            }

            // Students can access only their own documents.
            if (document.studentId !== student.id) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to access this document.",
                });
            }
        }

        const filePath = getDocumentFilePath(document);

        if (!filePath) {
            return res.status(500).json({
                success: false,
                message: "Document file path is invalid on server.",
            });
        }

        let actualPath;
        try {
            actualPath = await fs.realpath(filePath);
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
            return res.status(404).json({
                success: false,
                message: "Document file not found on server.",
            });
        }

        if (!(await isRealPathInsideUploadDirectory(actualPath))) {
            return res.status(500).json({
                success: false,
                message: "Document file path is invalid on server.",
            });
        }

        return res.download(
            actualPath,
            document.fileName,
            (error) => {
                if (error) {
                    console.error("Error downloading document:", error);
                    if (!res.headersSent) {
                        res.status(500).json({
                            success: false,
                            message: "Failed to download document.",
                        });
                    }
                }
            }
        );
    } catch (error) {
        console.error("Error downloading document:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to download document.",
        });
    }
};

const getAllDocumentsForTPO = async (req, res) => {
    try {
        const page = req.query.page === undefined
            ? 1
            : parseDocumentId(req.query.page);
        const limit = req.query.limit === undefined
            ? 20
            : parseDocumentId(req.query.limit);
        const skip = page && limit ? (page - 1) * limit : null;

        if (
            !page ||
            !limit ||
            limit > 100 ||
            !Number.isSafeInteger(skip)
        ) {
            return res.status(400).json({
                success: false,
                message: "Page must be positive and limit must be between 1 and 100.",
            });
        }

        const documents = await prisma.studentDocument.findMany({
            skip,
            take: limit,
            orderBy: {
                uploadedAt: "desc",
            },
            include: {
                student: {
                    select: {
                        id: true,
                        PRN: true,
                        graduationYear: true,
                        department: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                            },
                        },
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });
        const total = await prisma.studentDocument.count();

        return res.status(200).json({
            success: true,
            documents,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching TPO documents:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch student documents.",
        });
    }
};

module.exports = {
    getMyDocument,
    uploadDocument,
    deleteDocument,
    downloadDocument,
    getAllDocumentsForTPO,
};
