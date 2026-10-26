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

const state = {
    createError: null,
    deleteError: null,
    document: null,
    findManyArgs: null,
    student: { id: 1 },
};

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
        findFirst: async () => state.document,
        findUnique: async () => state.document,
        findMany: async (args) => {
            state.findManyArgs = args;
            return [];
        },
        count: async () => 0,
        delete: async () => {
            if (state.deleteError) throw state.deleteError;
            state.document = null;
            return null;
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

let server;
let baseUrl;

const makeToken = (role, id = 10) =>
    jwt.sign({ id, role }, process.env.JWT_SECRET);

const authorization = (role, id) => ({
    Authorization: `Bearer ${makeToken(role, id)}`,
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
    assert.deepEqual(
        (await currentFiles()).filter((name) => name.startsWith(".pending-delete-")),
        []
    );
});

test("retries cleanup of files queued by a previous failed cleanup", async () => {
    const pendingPath = path.join(
        uploadDirectory,
        ".pending-delete-recovery-test"
    );
    await fs.writeFile(pendingPath, "%PDF-pending cleanup");
    state.document = {
        id: 7,
        studentId: 1,
        fileName: "missing.pdf",
        fileUrl: "/uploads/documents/missing.pdf",
    };

    const response = await fetch(`${baseUrl}/documents/student/7`, {
        method: "DELETE",
        headers: authorization("STUDENT"),
    });

    assert.equal(response.status, 200);
    await assert.rejects(fs.access(pendingPath), { code: "ENOENT" });
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
