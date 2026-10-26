const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const UPLOAD_DIRECTORY = path.resolve(
    process.env.DOCUMENT_UPLOAD_DIR ||
        path.join(__dirname, "../../uploads/documents")
);
const DOCUMENT_URL_PREFIX = "/uploads/documents/";
const PENDING_DELETE_PREFIX = ".pending-delete-";
const STAGED_DELETE_PREFIX = ".staged-delete-";

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

const stageDocumentFileForDeletion = async (filePath) => {
    if (!isPathInsideUploadDirectory(filePath)) {
        throw new Error("Refusing to stage a document outside the upload directory.");
    }

    let actualPath;
    try {
        actualPath = await fs.realpath(filePath);
    } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
    }

    if (!(await isRealPathInsideUploadDirectory(actualPath))) {
        throw new Error("Refusing to stage a document outside the upload directory.");
    }

    const stagedPath = path.join(
        UPLOAD_DIRECTORY,
        `${STAGED_DELETE_PREFIX}${crypto.randomUUID()}`
    );
    await fs.rename(filePath, stagedPath);

    return { originalPath: filePath, stagedPath };
};

const restoreStagedDocumentFile = async (stagedFile) => {
    if (stagedFile) {
        await fs.rename(stagedFile.stagedPath, stagedFile.originalPath);
    }
};

const removeStagedDocumentFile = async (stagedFile) => {
    if (!stagedFile) return true;

    try {
        await fs.unlink(stagedFile.stagedPath);
        return true;
    } catch (error) {
        if (error.code === "ENOENT") return true;

        const pendingPath = path.join(
            UPLOAD_DIRECTORY,
            `${PENDING_DELETE_PREFIX}${crypto.randomUUID()}`
        );
        try {
            await fs.rename(stagedFile.stagedPath, pendingPath);
            console.error(
                `Document file cleanup is pending at ${pendingPath}:`,
                error
            );
        } catch (queueError) {
            console.error(
                `Document file cleanup could not be queued at ${stagedFile.stagedPath}:`,
                queueError
            );
        }
        return false;
    }
};

const cleanupPendingDocumentFiles = async () => {
    let entries;
    try {
        entries = await fs.readdir(UPLOAD_DIRECTORY, {
            withFileTypes: true,
        });
    } catch (error) {
        if (error.code === "ENOENT") return;
        throw error;
    }

    for (const entry of entries) {
        if (
            !entry.name.startsWith(PENDING_DELETE_PREFIX) ||
            (!entry.isFile() && !entry.isSymbolicLink())
        ) {
            continue;
        }

        const stagedPath = path.join(UPLOAD_DIRECTORY, entry.name);
        try {
            await fs.unlink(stagedPath);
        } catch (error) {
            if (error.code !== "ENOENT") {
                console.error(
                    `Document file cleanup remains pending at ${stagedPath}:`,
                    error
                );
            }
        }
    }
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
    stageDocumentFileForDeletion,
    restoreStagedDocumentFile,
    removeStagedDocumentFile,
    cleanupPendingDocumentFiles,
};
