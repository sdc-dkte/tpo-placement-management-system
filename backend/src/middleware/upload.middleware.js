const crypto = require("crypto");
const fs = require("fs/promises");
const multer = require("multer");
const path = require("path");
const {
    UPLOAD_DIRECTORY,
    removeUploadedFile,
} = require("../utils/documentFiles");

const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
const FILE_SIGNATURES = {
    ".pdf": Buffer.from("%PDF-"),
    ".jpg": Buffer.from([0xff, 0xd8, 0xff]),
    ".jpeg": Buffer.from([0xff, 0xd8, 0xff]),
    ".png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
};

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        fs.mkdir(UPLOAD_DIRECTORY, { recursive: true })
            .then(() => callback(null, UPLOAD_DIRECTORY))
            .catch(callback);
    },
    filename: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(null, `${crypto.randomUUID()}${extension}`);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();

        if (!ALLOWED_EXTENSIONS.has(extension)) {
            const error = new Error(
                "Only PDF, JPG, JPEG and PNG files are allowed."
            );
            error.code = "UNSUPPORTED_FILE_TYPE";
            error.statusCode = 400;
            return callback(error);
        }

        callback(null, true);
    },
});

const matchesFileSignature = async (file) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const signature = FILE_SIGNATURES[extension];
    const handle = await fs.open(file.path, "r");

    try {
        const buffer = Buffer.alloc(signature.length);
        const { bytesRead } = await handle.read(buffer, 0, signature.length, 0);

        return (
            bytesRead === signature.length &&
            buffer.equals(signature)
        );
    } finally {
        await handle.close();
    }
};

const handleDocumentUpload = (req, res, next) => {
    upload.single("file")(req, res, async (error) => {
        if (error) {
            if (error instanceof multer.MulterError) {
                const tooLarge = error.code === "LIMIT_FILE_SIZE";
                return res.status(tooLarge ? 413 : 400).json({
                    success: false,
                    message: tooLarge
                        ? "Document file is too large. Maximum size is 5 MB."
                        : error.message,
                });
            }

            return res.status(error.statusCode || 400).json({
                success: false,
                message: error.message,
            });
        }

        if (!req.file) return next();

        try {
            if (!(await matchesFileSignature(req.file))) {
                await removeUploadedFile(req.file);
                return res.status(400).json({
                    success: false,
                    message: "File content does not match its extension.",
                });
            }

            return next();
        } catch (validationError) {
            await removeUploadedFile(req.file);
            return next(validationError);
        }
    });
};

module.exports = handleDocumentUpload;