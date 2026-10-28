
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const UPLOAD_DIRECTORY = path.resolve(
    process.env.DOCUMENT_UPLOAD_DIR ||
        path.join(__dirname, "../../uploads/documents")
);
const DOCUMENT_URL_PREFIX = "/uploads/documents/";
const STAGED_DELETE_PREFIX = ".staged-delete-";
let documentFileOperation = Promise.resolve();

const isPathInsideUploadDirectory = (filePath) => {
    const relativePath = path.relative(
        UPLOAD_DIRECTORY,
        path.resolve(filePath)
    );

    return isRelativePathInsideDirectory(relativePath);
};

const isRealPathInsideUploadDirectory = async (filePath) => {
    const uploadDirectory = await fs.realpath(UPLOAD_DIRECTORY);
    const actualPath = await fs.realpath(filePath);
    const relativePath = path.relative(
        uploadDirectory,
        actualPath
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

const stageDocumentFileForDeletion = async (filePath, documentId) => {
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
        `${STAGED_DELETE_PREFIX}${documentId}-${crypto.randomUUID()}`
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

        console.error(
            `Document file cleanup remains tracked at ${stagedFile.stagedPath}:`,
            error
        );
        return false;
    }
};

const recoverStagedDocumentFiles = async (prisma) => {
    let entries;
    try {
        entries = await fs.readdir(UPLOAD_DIRECTORY, {
            withFileTypes: true,
        });
    } catch (error) {
        if (error.code === "ENOENT") return;
        throw error;
    }

    const stagedFilePattern = /^\.staged-delete-(\d+)-[0-9a-f-]{36}$/;

    for (const entry of entries) {
        if (!entry.name.startsWith(STAGED_DELETE_PREFIX)) continue;

        const stagedPath = path.join(UPLOAD_DIRECTORY, entry.name);
        const match = entry.name.match(stagedFilePattern);

        if (!match || (!entry.isFile() && !entry.isSymbolicLink())) {
            console.error(
                `Unrecognized staged document file requires manual recovery: ${stagedPath}`
            );
            continue;
        }

        const documentId = Number(match[1]);
        let document;
        try {
            document = await prisma.studentDocument.findUnique({
                where: { id: documentId },
            });
        } catch (error) {
            console.error(
                `Could not check document ${documentId}; staged file was preserved at ${stagedPath}:`,
                error
            );
            continue;
        }

        if (document) {
            const originalPath = resolveDocumentPath(document.fileUrl);
            if (!originalPath) {
                console.error(
                    `Document ${documentId} has an invalid file path; staged file was preserved at ${stagedPath}.`
                );
                continue;
            }

            try {
                if (!(await isRealPathInsideUploadDirectory(stagedPath))) {
                    console.error(
                        `Staged file for document ${documentId} resolves outside the upload directory; it was preserved at ${stagedPath}.`
                    );
                    continue;
                }
            } catch (error) {
                console.error(
                    `Could not verify staged file for document ${documentId}; it was preserved at ${stagedPath}:`,
                    error
                );
                continue;
            }

            try {
                await fs.access(originalPath);
                console.error(
                    `Both original and staged files exist for document ${documentId}; staged file was preserved at ${stagedPath}.`
                );
                continue;
            } catch (error) {
                if (error.code !== "ENOENT") {
                    console.error(
                        `Could not inspect document ${documentId}; staged file was preserved at ${stagedPath}:`,
                        error
                    );
                    continue;
                }
            }

            try {
                await fs.rename(stagedPath, originalPath);
            } catch (error) {
                console.error(
                    `Could not restore document ${documentId}; staged file remains at ${stagedPath}:`,
                    error
                );
            }
            continue;
        }

        try {
            await fs.unlink(stagedPath);
        } catch (error) {
            if (error.code !== "ENOENT") {
                console.error(
                    `Document ${documentId} was deleted but staged-file cleanup remains pending at ${stagedPath}:`,
                    error
                );
            }
        }
    }
};

const withDocumentFileOperation = (operation) => {
    const currentOperation = documentFileOperation.then(operation, operation);
    documentFileOperation = currentOperation.catch(() => {});
    return currentOperation;
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
    recoverStagedDocumentFiles,
    withDocumentFileOperation,
};
