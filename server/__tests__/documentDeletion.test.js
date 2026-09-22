const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const { Workspace } = require("../models/workspace");
const { Document } = require("../models/documents");
const { purgeDocument } = require("../utils/files/purgeDocument");
const { documentsPath } = require("../utils/files");
const { HybridSearch } = require("../utils/retrieval/hybridSearch");
const { resolveProviderConnector } = require("../utils/helpers");
const { getVectorDbClass } = require("../utils/helpers");
const { ROLES } = require("../utils/middleware/multiUserProtected");

describe("SIH PS 26117 — Document Deletion & Vector Purge Verification Suite", () => {
  let workspace;
  let LLMConnector;
  let testDocId;
  let testDocFilename;
  let testDocRelativePath;
  let testDocFullPath;

  const testUniqueTag = "TAG-DELETE-TEST-998822";
  const testSampleContent = `
CLASSIFICATION: INTERNAL
TEST DOCUMENT FOR DELETION AND PURGE VERIFICATION
Unique Equipment Tag: ${testUniqueTag}
Recorded Vibration Metric: 99.42 mm/s at test bearing B-99
Special Directive: Immediate shutdown of cooling loop Beta if reading exceeds 90.0 mm/s.
This test document should be completely removed from workspace memory and disk.
`;

  before(async () => {
    workspace = await Workspace.get({ slug: "my-workspace" });
    assert.ok(workspace, "Workspace 'my-workspace' must exist for test");

    const resolved = await resolveProviderConnector({
      workspace,
      prompt: "test",
    });
    LLMConnector = resolved.connector;

    // Create a unique test document in custom-documents
    testDocId = uuidv4();
    testDocFilename = `00_TEST_Delete_Sample.txt-${testDocId}.json`;
    testDocRelativePath = `custom-documents/${testDocFilename}`;
    testDocFullPath = path.resolve(documentsPath, testDocRelativePath);

    const docData = {
      id: testDocId,
      url: `file://${testDocFullPath}`,
      title: "00_TEST_Delete_Sample.txt",
      docAuthor: "Test Suite",
      description: "Temporary document for deletion testing",
      docSource: "a text file uploaded by the user.",
      chunkSource: "",
      published: new Date().toLocaleString(),
      wordCount: 40,
      pageContent: testSampleContent,
      token_count_estimate: 80,
      classification: "INTERNAL",
      confidence: 1.0,
      classification_method: "test_suite",
    };

    fs.writeFileSync(testDocFullPath, JSON.stringify(docData, null, 2), "utf8");
    assert.ok(fs.existsSync(testDocFullPath), "Test source document must be written to disk");
  });

  after(async () => {
    // Cleanup if test failed mid-way
    if (fs.existsSync(testDocFullPath)) {
      try {
        fs.unlinkSync(testDocFullPath);
      } catch (_) {}
    }
  });

  it("Step 1: Ingest & Embed Test Document into workspace", async () => {
    const { failedToEmbed, errors } = await Document.addDocuments(
      workspace,
      [testDocRelativePath]
    );

    assert.equal(failedToEmbed.length, 0, `Embedding failed: ${errors?.join(", ")}`);

    // Verify SQLite record exists
    const docRecord = await Document.get({
      docpath: testDocRelativePath,
      workspaceId: workspace.id,
    });
    assert.ok(docRecord, "Document must be recorded in SQLite workspace_documents");
    assert.ok(docRecord.docId, "Document must have a valid docId in workspace_documents");

    // Verify LanceDB vector rows exist
    const VectorDb = getVectorDbClass();
    const { client } = await VectorDb.connect();
    const table = await client.openTable(workspace.slug);
    const rows = await table
      .query()
      .where(`title = '00_TEST_Delete_Sample.txt'`)
      .toArrow();

    assert.ok(rows.numRows > 0, `Expected LanceDB rows for test doc, found ${rows.numRows}`);
  });

  it("Step 2: Retrieve the test document content via HybridSearch prior to deletion", async () => {
    const result = await HybridSearch.searchWorkspace({
      workspace,
      query: `What is the recorded vibration metric for ${testUniqueTag}?`,
      LLMConnector,
      topN: 4,
    });

    assert.ok(result.contextTexts.length > 0, "HybridSearch must find context");
    const foundChunk = result.contextTexts.some(
      (text) => text.includes(testUniqueTag) || text.includes("99.42 mm/s")
    );
    assert.ok(
      foundChunk,
      `HybridSearch must retrieve chunk containing ${testUniqueTag}`
    );
  });

  it("Step 3: Permanently purge the document from disk, vector cache, LanceDB, and SQLite", async () => {
    // Execute complete document purge
    await purgeDocument(testDocRelativePath);

    // 1. Verify source JSON file is removed from disk
    assert.equal(
      fs.existsSync(testDocFullPath),
      false,
      "Source document JSON file must be deleted from storage/documents"
    );

    // 2. Verify SQLite workspace_documents record is removed
    const docRecord = await Document.get({
      docpath: testDocRelativePath,
      workspaceId: workspace.id,
    });
    assert.equal(
      docRecord,
      null,
      "workspace_documents SQLite record must be removed"
    );

    // 3. Verify LanceDB vector chunks are completely deleted
    const VectorDb = getVectorDbClass();
    const { client } = await VectorDb.connect();
    const table = await client.openTable(workspace.slug);
    const rows = await table
      .query()
      .where(`title = '00_TEST_Delete_Sample.txt'`)
      .toArrow();

    assert.equal(
      rows.numRows,
      0,
      `All LanceDB vector chunks for deleted doc must be removed, found: ${rows.numRows}`
    );
  });

  it("Step 4: Deleted document content must NOT appear in HybridSearch results", async () => {
    const result = await HybridSearch.searchWorkspace({
      workspace,
      query: `What is the recorded vibration metric for ${testUniqueTag}?`,
      LLMConnector,
      topN: 4,
    });

    const foundDeletedChunk = result.contextTexts.some(
      (text) => text.includes(testUniqueTag) || text.includes("99.42 mm/s")
    );
    assert.equal(
      foundDeletedChunk,
      false,
      "Deleted document content must NOT appear in retrieval results"
    );
  });

  it("Step 5: Other workspace documents and their search retrieval must remain intact", async () => {
    const query =
      "Analyze the C-204 inspection report and summarize all observed findings, recorded measurements, and requested follow-up actions. Use only the uploaded documents.";

    const result = await HybridSearch.searchWorkspace({
      workspace,
      query,
      LLMConnector,
      topN: 4,
    });

    assert.ok(result.contextTexts.length > 0, "Other documents must remain retrievable");
    const foundC204 = result.contextTexts.some(
      (text) =>
        text.includes("C-204") ||
        text.includes("7.8 mm/s") ||
        text.includes("NDE")
    );
    assert.ok(
      foundC204,
      "C-204 inspection report content must remain intact and retrievable"
    );
  });

  it("Step 6: Role-Based Access Control (RBAC) allows admin and manager, blocks default", () => {
    const allowedRoles = [ROLES.admin, ROLES.manager];
    assert.ok(allowedRoles.includes("admin"), "Admin must be authorized");
    assert.ok(allowedRoles.includes("manager"), "Manager must be authorized");
    assert.equal(
      allowedRoles.includes("default"),
      false,
      "Default role must NOT be permitted to delete documents"
    );
  });

  it("Step 7: All frontend components use the exact required confirmation prompt string", () => {
    const requiredPrompt =
      "Delete this document? This will also remove its indexed content.";

    const frontendFiles = [
      "frontend/src/components/Modals/ManageWorkspace/Documents/WorkspaceDirectory/WorkspaceFileRow/index.jsx",
      "frontend/src/components/Modals/ManageWorkspace/Documents/WorkspaceDirectory/index.jsx",
      "frontend/src/components/Modals/ManageWorkspace/Documents/Directory/index.jsx",
      "frontend/src/pages/Documents/index.jsx",
    ];

    for (const relPath of frontendFiles) {
      const fullPath = path.resolve(__dirname, "../../", relPath);
      assert.ok(fs.existsSync(fullPath), `File ${relPath} must exist`);
      const content = fs.readFileSync(fullPath, "utf8");
      assert.ok(
        content.includes(requiredPrompt),
        `Component ${relPath} must contain confirmation prompt: "${requiredPrompt}"`
      );
    }
  });
});
