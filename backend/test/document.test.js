
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { after, before, beforeEach, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "document-route-test-secret";
const uploadDirectory = require("node:fs").mkdtempSync(
    path.join(os.tmpdir(), "document-routes-")
);
process.env.DOCUMENT_UPLOAD_DIR = uploadDirectory;
const { recoverStagedDocumentFiles } = require("../src/utils/documentFiles");
const { listenAfterRecovery } = require("../src/utils/serverStartup");

const state = {
    createError: null,
    deleteError: null,
    document: null,
    findUniqueError: null,
    keepRecordOnDelete: false,
    findManyArgs: null,
    student: { id: 1 },
    documents: null,
    activeDeleteCount: 0,
    maxActiveDeleteCount: 0,
    deleteDelay: 0,
    studentFindManyArgs: null,
};

const getDocument = (id) =>
    state.documents ? state.documents.get(id) : state.document;

const prisma = {
    student: {
        findUnique: async () => state.student,
    },
    studentDocument: {
        create: async ({ data }) => {
            if (state.createError) throw state.createError;
            state.document = { id: 7, ...data, studentId: 1 };
            return state.document;
        },
        findFirst: async ({ where }) => {
            const document = getDocument(where.id);
            return where.studentId && document?.studentId !== where.studentId
                ? null
                : document;
        },
        findUnique: async ({ where }) => {
            if (state.findUniqueError) throw state.findUniqueError;
            return getDocument(where.id);
        },
        findMany: async (args) => {
            if (args.where?.studentId) {
                state.studentFindManyArgs = args;
            } else {
                state.findManyArgs = args;
            }
            return [];
        },
        count: async () => 0,
        delete: async ({ where }) => {
            state.activeDeleteCount++;
            state.maxActiveDeleteCount = Math.max(
                state.maxActiveDeleteCount,
                state.activeDeleteCount
            );
            try {
                if (state.deleteDelay) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, state.deleteDelay)
                    );
                }
                if (state.deleteError) throw state.deleteError;
                if (state.documents) {
                    state.documents.delete(where.id);
                } else if (!state.keepRecordOnDelete) {
                    state.document = null;
                }
                return null;
            } finally {
                state.activeDeleteCount--;
            }
        },
    },
};

const prismaModulePath = require.resolve("../src/prismaClient");
const prismaModule = new Module(prismaModulePath);
prismaModule.filename = prismaModulePath;
prismaModule.loaded = true;
prismaModule.exports = prisma;
require.cache[prismaModulePath] = prismaModule;

const documentRouter = require("../src/routes/document.routes");
const app = express();
app.use("/documents", documentRouter);
app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) return next(error);
    return res.status(500).json({
        success: false,
        message: "Internal server error",
    });
});

let server;
let baseUrl;

const makeToken = (role, id = 10) =>
    jwt.sign({ id, role }, process.env.JWT_SECRET);

const authorization = (role, id) => ({
    Authorization: `Bearer ${makeToken(role, id)}`,
});

test("does not begin listening before recovery completes", async () => {
    let recoveryComplete = false;
    let listenCalled = false;

    const startup = listenAfterRecovery(
        async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            recoveryComplete = true;
        },
        () => {
            assert.equal(recoveryComplete, true);
            listenCalled = true;
            return "server";
        }
    );

    assert.equal(listenCalled, false);
    assert.equal(await startup, "server");
    assert.equal(listenCalled, true);
});

test("does not listen when initial recovery fails", async () => {
    let listenCalled = false;

    await assert.rejects(
        listenAfterRecovery(
            async () => {
                throw new Error("recovery failed");
            },
            () => {
                listenCalled = true;
            }
        ),
        /recovery failed/
    );
    assert.equal(listenCalled, false);
});

const uploadDocument = async ({
    role = "STUDENT",
    type = "RESUME",
    filename = "resume.pdf",
    content = Buffer.from("%PDF-1.7 test document"),
} = {}) => {
    const form = new FormData();
    form.append("documentType", type);
    form.append("file", new Blob([content]), filename);
    return fetch(`${baseUrl}/documents/student`, {
        method: "POST",
        headers: authorization(role),
        body: form,
    });
};

const currentFiles = async () => fs.readdir(uploadDirectory);

before(async () => {
    await new Promise((resolve) => {
        server = app.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
    state.createError = null;
    state.deleteError = null;
    state.document = null;
    state.findUniqueError = null;
    state.keepRecordOnDelete = false;
    state.documents = null;
    state.activeDeleteCount = 0;
    state.maxActiveDeleteCount = 0;
    state.deleteDelay = 0;
    state.studentFindManyArgs = null;
    state.findManyArgs = null;
    state.student = { id: 1 };
});

after(async () => {
    await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
    await fs.rm(uploadDirectory, { recursive: true, force: true });
});

test("rejects file content that does not match its extension and removes it", async () => {
    const beforeFiles = await currentFiles();
    const response = await uploadDocument({
        content: Buffer.from("not a PDF"),
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /content does not match/i);
    assert.deepEqual(await currentFiles(), beforeFiles);
});

test("rejects unsupported extensions explicitly", async () => {
    const response = await uploadDocument({ filename: "resume.exe" });

    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /only PDF, JPG, JPEG and PNG/i);
    assert.deepEqual(await currentFiles(), []);
});

test("returns an explicit size-limit error", async () => {
    const response = await uploadDocument({
        content: Buffer.alloc(5 * 1024 * 1024 + 1, 0x41),
    });

    assert.equal(response.status, 413);
    assert.match((await response.json()).message, /maximum size is 5 MB/i);
    assert.deepEqual(await currentFiles(), []);
});

test("does not expose filesystem details from upload storage errors", async () => {
    const originalMkdir = fs.mkdir;
    fs.mkdir = async () => {
        throw new Error("storage failed at /private/uploads/documents");
    };

    let response;
    try {
        response = await uploadDocument();
    } finally {
        fs.mkdir = originalMkdir;
    }

    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(body.message, "Internal server error");
    assert.doesNotMatch(JSON.stringify(body), /private|uploads|storage failed/i);
});

test("rejects unsupported document types and removes the uploaded file", async () => {
    const response = await uploadDocument({ type: "PASSPORT" });

    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /document type must be/i);
    assert.deepEqual(await currentFiles(), []);
});

test("removes the uploaded file when document creation fails", async () => {
    state.createError = new Error("database unavailable");
    const beforeFiles = await currentFiles();

    const response = await uploadDocument();

    assert.equal(response.status, 500);
    assert.deepEqual(await currentFiles(), beforeFiles);
});

test("stores an uploaded document under a generated server-side filename", async () => {
    const response = await uploadDocument({
        filename: "my-resume.pdf",
        type: "resume",
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.document.fileName, "my-resume.pdf");
    assert.match(
        body.document.fileUrl,
        /^\/uploads\/documents\/[0-9a-f-]{36}\.pdf$/
    );
    assert.equal(
        await fs.readFile(path.join(uploadDirectory, path.basename(body.document.fileUrl)), "utf8"),
        "%PDF-1.7 test document"
    );
});

test("allows only students to use student document routes and TPO/students to download", async () => {
    const unauthenticated = await fetch(`${baseUrl}/documents/student`);
    assert.equal(unauthenticated.status, 401);

    const tpoStudentList = await fetch(`${baseUrl}/documents/student`, {
        headers: authorization("TPO"),
    });
    assert.equal(tpoStudentList.status, 403);

    const studentTpoList = await fetch(`${baseUrl}/documents/tpo`, {
        headers: authorization("STUDENT"),
    });
    assert.equal(studentTpoList.status, 403);

    state.document = {
        id: 7,
        studentId: 1,
        fileName: "test.pdf",
        fileUrl: "/uploads/documents/test.pdf",
    };
    await fs.writeFile(path.join(uploadDirectory, "test.pdf"), "%PDF-test");

    const otherRoleDownload = await fetch(
        `${baseUrl}/documents/7/download`,
        { headers: authorization("COMPANY") }
    );
    assert.equal(otherRoleDownload.status, 403);

    const tpoDownload = await fetch(`${baseUrl}/documents/7/download`, {
        headers: authorization("TPO"),
    });
    assert.equal(tpoDownload.status, 200);
    assert.equal(await tpoDownload.text(), "%PDF-test");

    const studentDownload = await fetch(`${baseUrl}/documents/7/download`, {
        headers: authorization("STUDENT"),
    });
    assert.equal(studentDownload.status, 200);
    await studentDownload.arrayBuffer();
});

test("lists only the signed-in student's documents", async () => {
    const response = await fetch(`${baseUrl}/documents/student`, {
        headers: authorization("STUDENT"),
    });

    assert.equal(response.status, 200);
    assert.equal(state.studentFindManyArgs.where.studentId, state.student.id);
});

test("prevents students from downloading another student's document", async () => {
    state.document = {
        id: 7,
        studentId: 2,
        fileName: "test.pdf",
        fileUrl: "/uploads/documents/test.pdf",
    };

    const response = await fetch(`${baseUrl}/documents/7/download`, {
        headers: authorization("STUDENT"),
    });

    assert.equal(response.status, 403);
});

test("prevents students from deleting another student's document", async () => {
    const fileName = "another-students-file.pdf";
    const filePath = path.join(uploadDirectory, fileName);
    const content = "%PDF-not owned";
    await fs.writeFile(filePath, content);
    state.document = {
        id: 7,
        studentId: 2,
        fileName,
        fileUrl: `/uploads/documents/${fileName}`,
    };

    const response = await fetch(`${baseUrl}/documents/student/7`, {
        method: "DELETE",
        headers: authorization("STUDENT"),
    });

    assert.equal(response.status, 404);
    assert.equal(state.document.studentId, 2);
    assert.equal(await fs.readFile(filePath, "utf8"), content);
});

test("returns 404 when a document's file is missing", async () => {
    state.document = {
        id: 7,
        studentId: 1,
        fileName: "missing.pdf",
        fileUrl: "/uploads/documents/missing.pdf",
    };

    const response = await fetch(`${baseUrl}/documents/7/download`, {
        headers: authorization("STUDENT"),
    });

    assert.equal(response.status, 404);
});

test("restores the document file when database deletion fails", async () => {
    const fileName = "delete-failure.pdf";
    const filePath = path.join(uploadDirectory, fileName);
    const content = "%PDF-file to retain";
    await fs.writeFile(filePath, content);
    state.document = {
        id: 7,
        studentId: 1,
        fileName,
        fileUrl: `/uploads/documents/${fileName}`,
    };
    state.deleteError = new Error("database unavailable");

    const response = await fetch(`${baseUrl}/documents/student/7`, {
        method: "DELETE",
        headers: authorization("STUDENT"),
    });

    assert.equal(response.status, 500);
    assert.equal(state.document.id, 7);
    assert.equal(await fs.readFile(filePath, "utf8"), content);
});

test("preserves and later restores the staged file when deletion outcome cannot be checked", async () => {
    const fileName = "unverified-delete.pdf";
    const filePath = path.join(uploadDirectory, fileName);
    const content = "%PDF-do not discard";
    await fs.writeFile(filePath, content);
    state.document = {
        id: 7,
        studentId: 1,
        fileName,
        fileUrl: `/uploads/documents/${fileName}`,
    };
    state.deleteError = new Error("database delete failed");
    state.findUniqueError = new Error("database unavailable");

    const response = await fetch(`${baseUrl}/documents/student/7`, {
        method: "DELETE",
        headers: authorization("STUDENT"),
    });

    assert.equal(response.status, 500);
    assert.equal(state.document.id, 7);
    await assert.rejects(fs.access(filePath), { code: "ENOENT" });
    const stagedFileName = (await currentFiles()).find((name) =>
        name.startsWith(".staged-delete-7-")
    );
    assert.ok(stagedFileName);
    assert.equal(
        await fs.readFile(path.join(uploadDirectory, stagedFileName), "utf8"),
        content
    );

    state.findUniqueError = null;
    state.deleteError = null;
    await recoverStagedDocumentFiles(prisma);

    assert.equal(await fs.readFile(filePath, "utf8"), content);
    assert.equal(
        (await currentFiles()).some((name) => name.startsWith(".staged-delete-7-")),
        false
    );
    assert.equal(state.document.id, 7);
});

test("does not delete a staged file if a successful delete leaves its record", async () => {
    const fileName = "record-still-exists.pdf";
    const filePath = path.join(uploadDirectory, fileName);
    const content = "%PDF-record still present";
    await fs.writeFile(filePath, content);
    state.document = {
        id: 7,
        studentId: 1,
        fileName,
        fileUrl: `/uploads/documents/${fileName}`,
    };
    state.keepRecordOnDelete = true;

    const response = await fetch(`${baseUrl}/documents/student/7`, {
        method: "DELETE",
        headers: authorization("STUDENT"),
    });

    assert.equal(response.status, 500);
    assert.equal(state.document.id, 7);
    assert.equal(await fs.readFile(filePath, "utf8"), content);
    assert.equal(
        (await currentFiles()).some((name) => name.startsWith(".staged-delete-7-")),
        false
    );
});

test("recovers a tracked staged file when database deletion and restoration fail", async () => {
    const fileName = "restore-failure.pdf";
    const filePath = path.join(uploadDirectory, fileName);
    const content = "%PDF-preserve for recovery";
    await fs.writeFile(filePath, content);
    state.document = {
        id: 7,
        studentId: 1,
        fileName,
        fileUrl: `/uploads/documents/${fileName}`,
    };
    state.deleteError = new Error("database unavailable");
    const originalRename = fs.rename;
    fs.rename = async (source, destination) => {
        if (
            path.basename(source).startsWith(".staged-delete-") &&
            destination === filePath
        ) {
            const error = new Error("restore blocked");
            error.code = "EACCES";
            throw error;
        }
        return originalRename(source, destination);
    };

    let response;
    try {
        response = await fetch(`${baseUrl}/documents/student/7`, {
            method: "DELETE",
            headers: authorization("STUDENT"),
        });
    } finally {
        fs.rename = originalRename;
    }

    assert.equal(response.status, 500);
    assert.equal(state.document.id, 7);
    await assert.rejects(fs.access(filePath), { code: "ENOENT" });
    const stagedFiles = (await currentFiles()).filter((name) =>
        name.startsWith(".staged-delete-7-")
    );
    assert.equal(stagedFiles.length, 1);

    state.deleteError = null;
    await recoverStagedDocumentFiles(prisma);

    assert.equal(await fs.readFile(filePath, "utf8"), content);
    assert.equal(
        (await currentFiles()).some((name) => name.startsWith(".staged-delete-7-")),
        false
    );
    assert.equal(state.document.id, 7);
});

test("retains staged files when cleanup fails and retries them later", async () => {
    const fileName = "cleanup-failure.pdf";
    const filePath = path.join(uploadDirectory, fileName);
    await fs.writeFile(filePath, "%PDF-cleanup retry");
    state.document = {
        id: 7,
        studentId: 1,
        fileName,
        fileUrl: `/uploads/documents/${fileName}`,
    };
    const originalUnlink = fs.unlink;
    let unlinkFailed = false;
    fs.unlink = async (target) => {
        if (
            !unlinkFailed &&
            path.basename(target).startsWith(".staged-delete-7-")
        ) {
            unlinkFailed = true;
            const error = new Error("cleanup blocked");
            error.code = "EACCES";
            throw error;
        }
        return originalUnlink(target);
    };

    let response;
    try {
        response = await fetch(`${baseUrl}/documents/student/7`, {
            method: "DELETE",
            headers: authorization("STUDENT"),
        });
    } finally {
        fs.unlink = originalUnlink;
    }

    assert.equal(response.status, 200);
    assert.equal(state.document, null);
    const stagedFiles = (await currentFiles()).filter((name) =>
        name.startsWith(".staged-delete-7-")
    );
    assert.equal(stagedFiles.length, 1);
    assert.equal(
        await fs.readFile(path.join(uploadDirectory, stagedFiles[0]), "utf8"),
        "%PDF-cleanup retry"
    );

    await recoverStagedDocumentFiles(prisma);

    assert.equal(
        (await currentFiles()).some((name) => name.startsWith(".staged-delete-7-")),
        false
    );
    await assert.rejects(fs.access(filePath), { code: "ENOENT" });
    assert.equal(state.document, null);
});

test("serializes concurrent document deletions", async () => {
    state.documents = new Map([
        [
            7,
            {
                id: 7,
                studentId: 1,
                fileName: "concurrent-7.pdf",
                fileUrl: "/uploads/documents/concurrent-7.pdf",
            },
        ],
        [
            8,
            {
                id: 8,
                studentId: 1,
                fileName: "concurrent-8.pdf",
                fileUrl: "/uploads/documents/concurrent-8.pdf",
            },
        ],
    ]);
    state.deleteDelay = 20;
    await Promise.all([
        fs.writeFile(
            path.join(uploadDirectory, "concurrent-7.pdf"),
            "%PDF-7"
        ),
        fs.writeFile(
            path.join(uploadDirectory, "concurrent-8.pdf"),
            "%PDF-8"
        ),
    ]);

    const responses = await Promise.all(
        [7, 8].map((id) =>
            fetch(`${baseUrl}/documents/student/${id}`, {
                method: "DELETE",
                headers: authorization("STUDENT"),
            })
        )
    );

    assert.deepEqual(
        responses.map((response) => response.status),
        [200, 200]
    );
    assert.equal(state.maxActiveDeleteCount, 1);
    assert.equal(state.documents.size, 0);
    await assert.rejects(fs.access(path.join(uploadDirectory, "concurrent-7.pdf")), {
        code: "ENOENT",
    });
    await assert.rejects(fs.access(path.join(uploadDirectory, "concurrent-8.pdf")), {
        code: "ENOENT",
    });
});

test("preserves staged files when database state cannot be checked", async () => {
    const stagedPath = path.join(
        uploadDirectory,
        ".staged-delete-7-12345678-1234-1234-1234-123456789abc"
    );
    const content = "%PDF-database state unavailable";
    await fs.writeFile(stagedPath, content);
    state.document = {
        id: 7,
        studentId: 1,
        fileName: "database-check.pdf",
        fileUrl: "/uploads/documents/database-check.pdf",
    };
    state.findUniqueError = new Error("database unavailable");

    await assert.rejects(
        recoverStagedDocumentFiles(prisma),
        /could not be fully recovered/i
    );

    assert.equal(await fs.readFile(stagedPath, "utf8"), content);
    assert.equal(state.document.id, 7);
    state.findUniqueError = null;
    await recoverStagedDocumentFiles(prisma);
    assert.equal(
        await fs.readFile(
            path.join(uploadDirectory, "database-check.pdf"),
            "utf8"
        ),
        content
    );
});

test("validates document IDs as positive integers", async () => {
    for (const invalidId of ["0", "-1", "1.5", "1e2", "abc"]) {
        const response = await fetch(
            `${baseUrl}/documents/${invalidId}/download`,
            { headers: authorization("STUDENT") }
        );
        assert.equal(response.status, 400, `ID ${invalidId} should be rejected`);
    }
});

test("rejects unsafe paths when downloading or deleting documents", async () => {
    state.document = {
        id: 7,
        studentId: 1,
        fileName: "outside.pdf",
        fileUrl: "/uploads/documents/../../README.md",
    };

    const downloadResponse = await fetch(`${baseUrl}/documents/7/download`, {
        headers: authorization("STUDENT"),
    });
    assert.equal(downloadResponse.status, 500);

    const deleteResponse = await fetch(`${baseUrl}/documents/student/7`, {
        method: "DELETE",
        headers: authorization("STUDENT"),
    });
    assert.equal(deleteResponse.status, 500);
});

test("rejects symlinks that resolve outside the upload directory", async () => {
    const linkedFile = path.join(uploadDirectory, "linked.pdf");
    await fs.symlink(path.resolve(__dirname, "../README.md"), linkedFile);
    state.document = {
        id: 7,
        studentId: 1,
        fileName: "linked.pdf",
        fileUrl: "/uploads/documents/linked.pdf",
    };

    const downloadResponse = await fetch(`${baseUrl}/documents/7/download`, {
        headers: authorization("STUDENT"),
    });
    assert.equal(downloadResponse.status, 500);

    const deleteResponse = await fetch(`${baseUrl}/documents/student/7`, {
        method: "DELETE",
        headers: authorization("STUDENT"),
    });
    assert.equal(deleteResponse.status, 500);
    assert.equal((await fs.lstat(linkedFile)).isSymbolicLink(), true);
});

test("paginates the TPO document list", async () => {
    const response = await fetch(`${baseUrl}/documents/tpo?page=2&limit=10`, {
        headers: authorization("TPO"),
    });

    assert.equal(response.status, 200);
    assert.equal(state.findManyArgs.skip, 10);
    assert.equal(state.findManyArgs.take, 10);
    assert.deepEqual((await response.json()).pagination, {
        page: 2,
        limit: 10,
        total: 0,
        totalPages: 0,
    });
});
