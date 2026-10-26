const fs = require("fs/promises");
const path = require("path");

const UPLOAD_DIRECTORY = path.resolve(
    process.env.DOCUMENT_UPLOAD_DIR ||
        path.join(__dirname, "../../uploads/documents")
);
const DOCUMENT_URL_PREFIX = "/uploads/documents/";

const isPathInsideUploadDirectory = (filePath) => {
    const relativePath = path.relative(
        UPLOAD_DIRECTORY,
        path.resolve(filePath)
    );

    return isRelativePathInsideDirectory(relativePath);
};

const isRealPathInsideUploadDirectory = async (filePath) => {
    const uploadDirectory = await fs.realpath(UPLOAD_DIRECTORY);
    const relativePath = path.relative(
        uploadDirectory,
        path.resolve(filePath)
    );

    return isRelativePathInsideDirectory(relativePath);
};

const isRelativePathInsideDirectory = (relativePath) =>
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath);

const resolveDocumentPath = (fileUrl) => {
    if (
        typeof fileUrl !== "string" ||
        !fileUrl.startsWith(DOCUMENT_URL_PREFIX)
    ) {
        return null;
    }

    const resolvedPath = path.resolve(
        UPLOAD_DIRECTORY,
        fileUrl.slice(DOCUMENT_URL_PREFIX.length)
    );

    return isPathInsideUploadDirectory(resolvedPath) ? resolvedPath : null;
};

const removeUploadedFile = async (file) => {
    if (!file?.path) return;

    if (!isPathInsideUploadDirectory(file.path)) {
        console.error("Refusing to remove an uploaded file outside the upload directory.");
        return;
    }

    try {
        await fs.unlink(file.path);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("Failed to remove uploaded document:", error);
        }
    }
};

module.exports = {
    UPLOAD_DIRECTORY,
    isPathInsideUploadDirectory,
    isRealPathInsideUploadDirectory,
    removeUploadedFile,
    resolveDocumentPath,
};
