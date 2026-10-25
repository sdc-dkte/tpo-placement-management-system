const prisma = require("../prismaClient");
const fs = require("fs");
const path = require("path");

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

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload a document.",
            });
        }

        const documentType = req.body.documentType;

        if (!documentType) {
            return res.status(400).json({
                success: false,
                message: "Document type is required.",
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

        const documentId = Number(req.params.id);

        if (Number.isNaN(documentId)) {
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

        const filePath = path.join(
            __dirname,
            "../../",
            document.fileUrl
        );

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
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
        const documentId = Number(req.params.id);

        if (Number.isNaN(documentId)) {
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

        const filePath = path.join(
            __dirname,
            "../../",
            document.fileUrl
        );

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: "Document file not found on server.",
            });
        }

        return res.download(
            filePath,
            document.fileName,
            (error) => {
                if (error) {
                    console.error("Error downloading document:", error);
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
        const documents = await prisma.studentDocument.findMany({
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

        return res.status(200).json({
            success: true,
            documents,
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
