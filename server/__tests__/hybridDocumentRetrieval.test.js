const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const { HybridSearch } = require("../utils/retrieval/hybridSearch");
const { Workspace } = require("../models/workspace");
const { Document } = require("../models/documents");
const { resolveProviderConnector } = require("../utils/helpers");

describe("SIH PS 26117 — Hybrid Document Retrieval & Content RAG Suite", () => {
  let workspace;
  let LLMConnector;

  before(async () => {
    workspace = await Workspace.get({ slug: "my-workspace" });
    if (!workspace) {
      const { workspace: newWs } = await Workspace.new("my-workspace");
      workspace = newWs;
    }
    assert.ok(workspace, "Workspace 'my-workspace' must exist");

    const docs = await Document.where({ workspaceId: workspace.id });
    if (docs.length === 0) {
      const files = [
        "custom-documents/01_PUBLIC_Company_Overview.txt-8cd52631-07df-4fb6-82d7-57deccfcbe7d.json",
        "custom-documents/02_INTERNAL_Maintenance_Schedule.txt-c2104e77-9002-4b2a-a912-32e56cf91022.json",
        "custom-documents/03_CONFIDENTIAL_Inspection_Report.pdf-d9aaa1c0-445e-4f73-9bbf-567913f751be.json",
        "custom-documents/04_CONFIDENTIAL_Maintenance_SOP.docx-1d249a93-c8c6-4caf-9a91-deaa15bd5be1.json",
        "custom-documents/05_RESTRICTED_Engineering_Change_Note.pdf-dbc701a2-a2b0-4cca-afc6-296862784d41.json",
        "custom-documents/06_CONFIDENTIAL_Equipment_Readings.csv-69d3289d-0d2b-4fa5-bb38-b544a7545776.json",
        "custom-documents/07_INTERNAL_Safety_Checklist.csv-df0ebacf-2370-4979-9053-207ebe1ca017.json",
        "custom-documents/08_CONFIDENTIAL_Scanned_Inspection_Note.pdf-c1545777-e832-4e08-8f5d-d79ce5657a17.json",
        "custom-documents/09_CONFIDENTIAL_P_and_ID_Test_Diagram.pdf-d7cd639d-84ae-4efd-be67-78aa544d91bb.json",
      ];
      await Document.addDocuments(workspace, files);
    }

    const resolved = await resolveProviderConnector({
      workspace,
      prompt: "test",
    });
    LLMConnector = resolved.connector;
  });

  // =========================================================================
  // 1. QUERY UNDERSTANDING & ENTITY EXTRACTION
  // =========================================================================
  describe("Query Understanding & Entity Extraction", () => {
    it("should extract equipment tags, measurements, and document concepts without guessing filename", () => {
      const query =
        "Analyze the C-204 inspection report and summarize all observed findings, recorded measurements, and requested follow-up actions. Use only the uploaded documents.";

      const analysis = HybridSearch.analyzeQuery(query);

      assert.equal(analysis.isExplicitFilename, false);
      assert.equal(analysis.targetFilename, null);
      assert.ok(analysis.entities.includes("C-204"), "Must identify C-204 tag");
      assert.ok(
        analysis.keywords.includes("inspection") &&
          analysis.keywords.includes("findings") &&
          analysis.keywords.includes("measurements"),
        "Must extract domain concepts"
      );
    });

    it("should extract numeric measurements with units", () => {
      const query = "Which document contains the C-204 vibration reading of 7.8 mm/s?";
      const analysis = HybridSearch.analyzeQuery(query);

      assert.ok(analysis.entities.includes("C-204"));
      assert.ok(
        analysis.measurements.some((m) => m.includes("7.8 mm/s")),
        "Must identify 7.8 mm/s measurement"
      );
    });

    it("should detect explicit filename requests only when explicitly named", () => {
      const explicitQuery = "Open 03_CONFIDENTIAL_Inspection_Report.pdf";
      const analysis = HybridSearch.analyzeQuery(explicitQuery);

      assert.equal(analysis.isExplicitFilename, true);
      assert.equal(analysis.targetFilename, "03_CONFIDENTIAL_Inspection_Report.pdf");
    });
  });

  // =========================================================================
  // 2. REQUIRED RETRIEVAL TESTS (TESTS 1 - 8)
  // =========================================================================
  describe("Required Retrieval Test Suite", () => {
    it("TEST 1: Analyze C-204 inspection report findings and measurements (by content)", async () => {
      const query =
        "Analyze the C-204 inspection report and summarize all observed findings, recorded measurements, and requested follow-up actions. Use only the uploaded documents.";

      const result = await HybridSearch.searchWorkspace({
        workspace,
        query,
        LLMConnector,
        topN: 4,
      });

      assert.ok(result.sources.length > 0, "Must retrieve relevant sources");
      const inspectionReportSource = result.sources.find((s) =>
        s.title.includes("Inspection_Report")
      );
      assert.ok(
        inspectionReportSource,
        "Must retrieve 03_CONFIDENTIAL_Inspection_Report.pdf based on content"
      );
      assert.ok(
        inspectionReportSource.text.includes("C-204") &&
          inspectionReportSource.text.includes("7.8 mm/s") &&
          inspectionReportSource.text.includes("Observed Findings"),
        "Retrieved content must contain findings and measurements"
      );
    });

    it("TEST 2: Vibration reading for C-204 and trend over time (Equipment Readings CSV)", async () => {
      const query =
        "What was the vibration reading for C-204 and how did it change over the recorded readings?";

      const result = await HybridSearch.searchWorkspace({
        workspace,
        query,
        LLMConnector,
        topN: 4,
      });

      const csvSource = result.sources.find((s) =>
        s.title.includes("Equipment_Readings")
      );
      assert.ok(
        csvSource,
        "Must retrieve 06_CONFIDENTIAL_Equipment_Readings.csv based on content"
      );
      assert.ok(
        csvSource.text.includes("C-204") &&
          csvSource.text.includes("Rising vibration"),
        "Must contain C-204 vibration trend rows"
      );
    });

    it("TEST 3: Maintenance SOP vibration threshold > 7.0 mm/s", async () => {
      const query =
        "What does the maintenance SOP say about vibration above 7.0 mm/s?";

      const result = await HybridSearch.searchWorkspace({
        workspace,
        query,
        LLMConnector,
        topN: 4,
      });

      const sopSource = result.sources.find((s) =>
        s.title.includes("Maintenance_SOP")
      );
      assert.ok(
        sopSource,
        "Must retrieve 04_CONFIDENTIAL_Maintenance_SOP.docx based on content"
      );
      assert.ok(
        sopSource.text.includes("7.0 mm/s") || sopSource.text.includes("High"),
        "Must contain SOP vibration criteria"
      );
    });

    it("TEST 4: Compare C-204 inspection findings with maintenance SOP (Multi-document)", async () => {
      const query = "Compare the C-204 inspection findings with the maintenance SOP.";

      const result = await HybridSearch.searchWorkspace({
        workspace,
        query,
        LLMConnector,
        topN: 6,
      });

      const foundInspection = result.sources.some((s) =>
        s.title.includes("Inspection_Report")
      );
      const foundSop = result.sources.some((s) =>
        s.title.includes("Maintenance_SOP")
      );

      assert.ok(
        foundInspection && foundSop,
        "Must retrieve BOTH Inspection Report and Maintenance SOP for comparison"
      );
    });

    it("TEST 5: Scanned inspection note content about C-204 (OCR)", async () => {
      const query = "What is written in the scanned inspection note about C-204?";

      const result = await HybridSearch.searchWorkspace({
        workspace,
        query,
        LLMConnector,
        topN: 4,
      });

      const scannedSource = result.sources.find((s) =>
        s.title.includes("Scanned_Inspection_Note")
      );
      assert.ok(
        scannedSource,
        "Must retrieve 08_CONFIDENTIAL_Scanned_Inspection_Note.pdf"
      );
      assert.ok(
        scannedSource.text.includes("7.8 mm/s") &&
          scannedSource.text.includes("seepage"),
        "Must contain OCR extracted content"
      );
    });

    it("TEST 6: Which uploaded document contains the 7.8 mm/s vibration reading?", async () => {
      const query = "Which uploaded document contains the 7.8 mm/s vibration reading?";

      const result = await HybridSearch.searchWorkspace({
        workspace,
        query,
        LLMConnector,
        topN: 4,
      });

      assert.ok(result.sources.length > 0);
      const matches = result.sources.filter(
        (s) =>
          s.title.includes("Inspection_Report") ||
          s.title.includes("Equipment_Readings") ||
          s.title.includes("Scanned_Inspection_Note")
      );
      assert.ok(
        matches.length > 0,
        "Must find at least one document containing 7.8 mm/s"
      );
      assert.ok(
        result.sources[0].text.includes("7.8 mm/s"),
        "Top hit must contain exact 7.8 mm/s measurement"
      );
    });

    it("TEST 7: Multimodal / Vision P&ID equipment and valve tags", async () => {
      const query = "What equipment and valve tags are shown in the uploaded P&ID?";

      const result = await HybridSearch.searchWorkspace({
        workspace,
        query,
        LLMConnector,
        topN: 4,
      });

      const pidSource = result.sources.find((s) =>
        s.title.includes("P_and_ID")
      );
      assert.ok(
        pidSource,
        "Must retrieve 09_CONFIDENTIAL_P_and_ID_Test_Diagram.pdf"
      );
      assert.ok(
        pidSource.text.includes("P-204") ||
          pidSource.text.includes("XV-101") ||
          pidSource.text.includes("TK-01"),
        "Must contain P&ID tag content"
      );
    });

    it("TEST 8: Internal maintenance schedule for the utilities area", async () => {
      const query =
        "Tell me the internal maintenance schedule for the utilities area.";

      const result = await HybridSearch.searchWorkspace({
        workspace,
        query,
        LLMConnector,
        topN: 4,
      });

      const schedSource = result.sources.find((s) =>
        s.title.includes("Maintenance_Schedule")
      );
      assert.ok(
        schedSource,
        "Must retrieve 02_INTERNAL_Maintenance_Schedule.txt based on content"
      );
      assert.ok(
        schedSource.text.includes("Utilities Area") ||
          schedSource.text.includes("Routine Maintenance"),
        "Must contain utilities area schedule"
      );
    });
  });

  // =========================================================================
  // 3. EXACT FILENAME AND SUMMARIZER CONCEPT RESOLUTION
  // =========================================================================
  describe("Filename Resolution & Document Summarizer Integration", () => {
    it("TEST 24: Explicit filename query opens exact file", async () => {
      const result = await HybridSearch.findBestMatchingDocument({
        workspace,
        filenameOrQuery: "03_CONFIDENTIAL_Inspection_Report.pdf",
        LLMConnector,
      });

      assert.equal(result.error, null);
      assert.equal(result.matchMethod, "exact_filename");
      assert.equal(result.filename, "03_CONFIDENTIAL_Inspection_Report.pdf");
      assert.ok(result.content.includes("SYN-IR-204-0919"));
    });

    it("should resolve a guessed filename (e.g. C-204_inspection_report.pdf) via content search without error", async () => {
      const result = await HybridSearch.findBestMatchingDocument({
        workspace,
        filenameOrQuery: "C-204_inspection_report.pdf",
        LLMConnector,
      });

      assert.equal(result.error, null);
      assert.ok(
        result.matchMethod === "content_search" || result.matchMethod === "fuzzy_filename",
        "Must resolve via content search or fuzzy matching"
      );
      assert.equal(result.filename, "03_CONFIDENTIAL_Inspection_Report.pdf");
      assert.ok(result.content.includes("Air Compressor C-204"));
    });

    it("should return honest missing document message when query genuinely has no matches", async () => {
      const result = await HybridSearch.findBestMatchingDocument({
        workspace,
        filenameOrQuery: "completely_fictional_unrelated_file_12345.xyz",
        LLMConnector,
      });

      assert.equal(result.document, null);
      assert.equal(
        result.error,
        "No relevant document was found in the current workspace."
      );
    });
  });

  // =========================================================================
  // 4. DATA CLASSIFICATION & POLICY SECURITY CONTROLS
  // =========================================================================
  describe("Security Clearance & Data Classification Controls", () => {
    it("should enforce PolicyEngine clearance on retrieved chunks", async () => {
      // 05_RESTRICTED_Engineering_Change_Note is RESTRICTED
      // When a model without RESTRICTED clearance queries it, it must be filtered out
      const restrictedQuery = "What is written in the engineering change note SYN-ECN-77?";

      // Mock an unauthorized cloud model connector
      const unauthorizedCloudConnector = {
        model: "gpt-4-cloud",
        embedTextInput: async (text) => LLMConnector.embedTextInput(text),
        promptWindowLimit: () => 4096,
      };

      const result = await HybridSearch.searchWorkspace({
        workspace,
        query: restrictedQuery,
        LLMConnector: unauthorizedCloudConnector,
        topN: 4,
      });

      // Restricted document must NOT be in authorized sources for unauthorized cloud model
      const restrictedHit = result.sources.find((s) =>
        s.title.includes("Engineering_Change_Note")
      );
      assert.equal(
        restrictedHit,
        undefined,
        "RESTRICTED document chunks must be blocked from unauthorized model"
      );
    });
  });
});
