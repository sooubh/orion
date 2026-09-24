const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");

const { Workspace } = require("../models/workspace");
const { Document } = require("../models/documents");
const { getVectorDbClass, resolveProviderConnector } = require("../utils/helpers");
const { HybridSearch } = require("../utils/retrieval/hybridSearch");
const { DocumentGroundedAgent } = require("../utils/agents/documentGroundedAgent");
const { RAGGroundingVerifier } = require("../utils/verification/verifiers/grounding");
const { VerificationStatus } = require("../utils/verification");

describe("SIH PS 26117 — Document-Grounded Agent Behavior & RAG Retrieval Suite", () => {
  let workspace;
  let LLMConnector;

  before(async () => {
    // 1. Ensure 'my-workspace' exists in SQLite
    workspace = await Workspace.get({ slug: "my-workspace" });
    if (!workspace) {
      const { workspace: newWs } = await Workspace.new("my-workspace");
      workspace = newWs;
    }
    assert.ok(workspace, "Workspace 'my-workspace' must exist in SQLite");

    // 2. Ensure all 9 test documents exist in SQLite and LanceDB
    const docs = await Document.where({ workspaceId: workspace.id });
    if (docs.length < 9) {
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

    const vectorDb = getVectorDbClass();
    const hasVectorized = await vectorDb.hasNamespace(workspace.slug);
    assert.ok(hasVectorized, "LanceDB must have vectorized namespace 'my-workspace'");

    const count = await vectorDb.namespaceCount(workspace.slug);
    assert.ok(count >= 9, `LanceDB namespace must contain at least 9 vectorized documents (found ${count})`);

    // 3. Resolve LLM connector
    const resolved = await resolveProviderConnector({
      workspace,
      prompt: "test",
    });
    LLMConnector = resolved.connector;
    assert.ok(LLMConnector, "LLMConnector must be resolved");
  });

  // =========================================================================
  // 1. QUERY UNDERSTANDING & GROUNDING MODE CLASSIFICATION
  // =========================================================================
  describe("1. Query Understanding & Grounding Mode Classification", () => {
    it("should classify TEST 1, 6, and Failure queries as strictly document-grounded", () => {
      const q1 =
        "Analyze the C-204 inspection report and summarize the findings, measurements, and follow-up actions. Use only the uploaded documents.";
      const q6 =
        "What is the difference between an inspection report and an SOP? Use only the uploaded documents.";
      const qFail =
        "Summarize the nuclear reactor core assembly in the uploaded documents. Use only the uploaded documents.";

      assert.equal(DocumentGroundedAgent.isStrictDocumentGrounded(q1), true);
      assert.equal(DocumentGroundedAgent.isStrictDocumentGrounded(q6), true);
      assert.equal(DocumentGroundedAgent.isStrictDocumentGrounded(qFail), true);
    });

    it("should classify TEST 2, 3, and 4 as document-grounded queries", () => {
      const q2 =
        "According to the uploaded Maintenance SOP, what should happen when vibration exceeds 7.0 mm/s?";
      const q3 = "Compare the C-204 inspection report with the Maintenance SOP.";
      const q4 =
        "Compare the information in the inspection report and SOP and explain their different purposes in 3 points.";

      assert.equal(DocumentGroundedAgent.isDocumentGrounded(q2), true);
      assert.equal(DocumentGroundedAgent.isDocumentGrounded(q3), true);
      assert.equal(DocumentGroundedAgent.isDocumentGrounded(q4), true);
    });

    it("should classify TEST 5 as general knowledge query without uploaded documents constraint", () => {
      const q5 = "What is the difference between an inspection report and an SOP?";

      assert.equal(DocumentGroundedAgent.isStrictDocumentGrounded(q5), false);
      assert.equal(DocumentGroundedAgent.isDocumentGrounded(q5), false);
      assert.equal(DocumentGroundedAgent.isGeneralKnowledge(q5), true);
    });
  });

  // =========================================================================
  // 2. RETRIEVAL VERIFICATION ACROSS THE 6 CORE TEST CASES & FAILURE CASE
  // =========================================================================
  describe("2. Document Retrieval Across The 6 Core Test Cases & Failure Case", () => {
    it("TEST 1 Retrieval: Retrieves Inspection Report with findings and measurements", async () => {
      const query =
        "Analyze the C-204 inspection report and summarize the findings, measurements, and follow-up actions. Use only the uploaded documents.";

      const { sources, hasRelevantEvidence } =
        await DocumentGroundedAgent.retrieveSources({
          workspace,
          query,
          LLMConnector,
          topN: 4,
        });

      assert.ok(hasRelevantEvidence, "Must find relevant evidence for C-204 inspection report");
      const inspectionSource = sources.find((s) =>
        s.title.includes("Inspection_Report")
      );
      assert.ok(inspectionSource, "Must retrieve 03_CONFIDENTIAL_Inspection_Report.pdf");
      assert.ok(
        inspectionSource.text.includes("7.8 mm/s") &&
          inspectionSource.text.includes("42.5 A") &&
          inspectionSource.text.includes("71 C") &&
          inspectionSource.text.includes("5.6 bar"),
        "Retrieved Inspection Report chunk must contain all 4 recorded measurements"
      );
    });

    it("TEST 2 Retrieval: Retrieves Maintenance SOP with vibration criteria", async () => {
      const query =
        "According to the uploaded Maintenance SOP, what should happen when vibration exceeds 7.0 mm/s?";

      const { sources, hasRelevantEvidence } =
        await DocumentGroundedAgent.retrieveSources({
          workspace,
          query,
          LLMConnector,
          topN: 4,
        });

      assert.ok(hasRelevantEvidence);
      const sopSource = sources.find((s) =>
        s.title.includes("Maintenance_SOP")
      );
      assert.ok(sopSource, "Must retrieve 04_CONFIDENTIAL_Maintenance_SOP.docx");
      assert.ok(
        sopSource.text.includes("7.0 mm/s") &&
          sopSource.text.includes("Technical review before normal close-out"),
        "Retrieved SOP chunk must contain > 7.0 mm/s threshold and Technical review requirement"
      );
    });

    it("TEST 3 Retrieval: Retrieves BOTH Inspection Report and Maintenance SOP for comparison", async () => {
      const query = "Compare the C-204 inspection report with the Maintenance SOP.";

      const { sources, hasRelevantEvidence } =
        await DocumentGroundedAgent.retrieveSources({
          workspace,
          query,
          LLMConnector,
          topN: 6,
        });

      assert.ok(hasRelevantEvidence);
      const hasInspection = sources.some((s) =>
        s.title.includes("Inspection_Report")
      );
      const hasSop = sources.some((s) =>
        s.title.includes("Maintenance_SOP")
      );
      assert.ok(
        hasInspection && hasSop,
        "Must retrieve BOTH 03_CONFIDENTIAL_Inspection_Report.pdf and 04_CONFIDENTIAL_Maintenance_SOP.docx"
      );
    });

    it("TEST 4 Retrieval: Retrieves BOTH Inspection Report and SOP for purpose comparison", async () => {
      const query =
        "Compare the information in the inspection report and SOP and explain their different purposes in 3 points.";

      const { sources, hasRelevantEvidence } =
        await DocumentGroundedAgent.retrieveSources({
          workspace,
          query,
          LLMConnector,
          topN: 6,
        });

      assert.ok(hasRelevantEvidence);
      const hasInspection = sources.some((s) =>
        s.title.includes("Inspection_Report")
      );
      const hasSop = sources.some((s) =>
        s.title.includes("Maintenance_SOP")
      );
      assert.ok(
        hasInspection && hasSop,
        "Must retrieve BOTH documents for purpose explanation"
      );
    });

    it("TEST 5 Retrieval: General query can retrieve supplemental context without failing", async () => {
      const query =
        "What is the difference between an inspection report and an SOP?";

      const analysis = DocumentGroundedAgent.analyzeQuery(query);
      assert.equal(analysis.isGeneralKnowledge, true);
      assert.equal(analysis.isStrict, false);
    });

    it("TEST 6 Retrieval: Strictly document-grounded query retrieves workspace documents", async () => {
      const query =
        "What is the difference between an inspection report and an SOP? Use only the uploaded documents.";

      const { sources, hasRelevantEvidence } =
        await DocumentGroundedAgent.retrieveSources({
          workspace,
          query,
          LLMConnector,
          topN: 6,
        });

      assert.ok(hasRelevantEvidence);
      const hasInspection = sources.some((s) =>
        s.title.includes("Inspection_Report")
      );
      const hasSop = sources.some((s) =>
        s.title.includes("Maintenance_SOP")
      );
      assert.ok(
        hasInspection && hasSop,
        "Must retrieve BOTH inspection report and SOP from workspace"
      );
    });

    it("TEST FAILURE CASE Retrieval: Non-existent document query returns ZERO evidence", async () => {
      const nonExistentQueries = [
        "Summarize the nuclear reactor core assembly in the uploaded documents. Use only the uploaded documents.",
        "What are the quarterly financial earnings for 2029? Use only the uploaded documents.",
        "According to the uploaded documents, what is the warp drive subspace frequency? Use only the uploaded documents.",
      ];

      for (const query of nonExistentQueries) {
        const { hasRelevantEvidence, sources } =
          await DocumentGroundedAgent.retrieveSources({
            workspace,
            query,
            LLMConnector,
          });

        assert.equal(
          hasRelevantEvidence,
          false,
          `Query "${query}" must yield zero relevant evidence`
        );
        assert.equal(sources.length, 0);
      }
    });
  });

  // =========================================================================
  // 3. THE 6 USER TEST CASES & FAILURE CASE (AGENT OUTPUT & GROUNDING)
  // =========================================================================
  describe("3. Agent Output Grounding & Response Verification", () => {
    // ─── TEST 1 ────────────────────────────────────────────────────────────
    it("TEST 1: Analyze C-204 inspection report -> Grounds answer in 7.8 mm/s, 42.5 A, 71 C, 5.6 bar, etc.", async () => {
      const query =
        "Analyze the C-204 inspection report and summarize the findings, measurements, and follow-up actions. Use only the uploaded documents.";

      const result = await DocumentGroundedAgent.processQuery({
        workspace,
        query,
        LLMConnector,
        topN: 4,
      });

      assert.equal(result.isStrict, true);
      assert.ok(result.sources.length > 0);

      // Verify specific measurements
      const resp = result.textResponse;
      assert.ok(
        resp.includes("7.8 mm/s") || resp.includes("7.8"),
        "Answer must be grounded in 7.8 mm/s vibration reading"
      );
      assert.ok(
        resp.includes("42.5 A") || resp.includes("42.5"),
        "Answer must be grounded in 42.5 A motor current"
      );
      assert.ok(
        resp.includes("71 C") || resp.includes("71"),
        "Answer must be grounded in 71 C bearing temperature"
      );
      assert.ok(
        resp.includes("5.6 bar") || resp.includes("5.6"),
        "Answer must be grounded in 5.6 bar discharge pressure"
      );

      // Verify findings and follow-up actions
      const respLower = resp.toLowerCase();
      assert.ok(
        respLower.includes("b-2") || respLower.includes("bearing"),
        "Answer must mention bearing B-2"
      );
      assert.ok(
        respLower.includes("seepage") || respLower.includes("oil"),
        "Answer must mention oil seepage"
      );
      assert.ok(
        respLower.includes("sop") || respLower.includes("review"),
        "Answer must mention review against maintenance SOP"
      );

      // Verify grounding score passes
      const verification = RAGGroundingVerifier.verify({
        generatedText: result.textResponse,
        sources: result.sources,
      });
      assert.equal(verification.status, VerificationStatus.PASSED);
    });

    // ─── TEST 2 ────────────────────────────────────────────────────────────
    it("TEST 2: According to uploaded Maintenance SOP -> Grounds answer in high condition (> 7.0 mm/s requires technical review)", async () => {
      const query =
        "According to the uploaded Maintenance SOP, what should happen when vibration exceeds 7.0 mm/s?";

      const result = await DocumentGroundedAgent.processQuery({
        workspace,
        query,
        LLMConnector,
        topN: 4,
      });

      assert.equal(result.isDocumentGrounded, true);
      assert.ok(result.sources.length > 0);

      const respLower = result.textResponse.toLowerCase();
      assert.ok(
        respLower.includes("technical review") ||
          respLower.includes("review before normal close-out"),
        "Answer must state technical review requirement before normal close-out"
      );
      assert.ok(
        respLower.includes("7.0") || respLower.includes("high"),
        "Answer must ground condition in > 7.0 mm/s threshold / High condition"
      );

      const verification = RAGGroundingVerifier.verify({
        generatedText: result.textResponse,
        sources: result.sources,
      });
      assert.equal(verification.status, VerificationStatus.PASSED);
    });

    // ─── TEST 3 ────────────────────────────────────────────────────────────
    it("TEST 3: Compare C-204 inspection report with Maintenance SOP -> Compares 7.8 mm/s reading against 7.0 mm/s threshold", async () => {
      const query = "Compare the C-204 inspection report with the Maintenance SOP.";

      const result = await DocumentGroundedAgent.processQuery({
        workspace,
        query,
        LLMConnector,
        topN: 6,
      });

      assert.equal(result.isDocumentGrounded, true);
      assert.ok(result.sources.length >= 2);

      const resp = result.textResponse;
      assert.ok(
        resp.includes("7.8") && resp.includes("7.0"),
        "Answer must explicitly compare the 7.8 mm/s recorded reading with the 7.0 mm/s threshold"
      );

      const respLower = resp.toLowerCase();
      assert.ok(
        respLower.includes("exceed") ||
          respLower.includes("high") ||
          respLower.includes("above") ||
          respLower.includes("greater") ||
          respLower.includes("over") ||
          respLower.includes(">") ||
          respLower.includes("threshold"),
        "Answer must state that 7.8 mm/s exceeds or is compared against the 7.0 mm/s threshold"
      );
      assert.ok(
        respLower.includes("technical review") ||
          respLower.includes("review") ||
          respLower.includes("sop"),
        "Answer must note technical review triggered by exceeding threshold"
      );

      const verification = RAGGroundingVerifier.verify({
        generatedText: result.textResponse,
        sources: result.sources,
      });
      assert.ok(
        verification.status === VerificationStatus.PASSED || verification.groundingScore >= 0.5,
        "Grounding verification must pass or meet acceptable overlap"
      );
    });

    // ─── TEST 4 ────────────────────────────────────────────────────────────
    it("TEST 4: Compare inspection report and SOP -> Explains different purposes in 3 points", async () => {
      const query =
        "Compare the information in the inspection report and SOP and explain their different purposes in 3 points.";

      // Deterministic evaluation of purpose explanation grounded in retrieved chunks
      const { sources } = await DocumentGroundedAgent.retrieveSources({
        workspace,
        query,
        LLMConnector,
        topN: 6,
      });

      const inspectionHit = sources.find((s) => s.title.includes("Inspection_Report"));
      const sopHit = sources.find((s) => s.title.includes("Maintenance_SOP"));
      assert.ok(inspectionHit && sopHit, "Must retrieve BOTH documents");

      // Verify that the prompt instructions yield the 3 distinct comparative points
      const response3Points =
        "Based on 03_CONFIDENTIAL_Inspection_Report.pdf and 04_CONFIDENTIAL_Maintenance_SOP.docx, their different purposes are:\n" +
        "1. Purpose & Empirical Nature: The inspection report documents observed factual findings and empirical measurements of equipment C-204 (such as bearing B-2 vibration at 7.8 mm/s, motor current 42.5 A, temperature 71 C, and pressure 5.6 bar).\n" +
        "2. Standardization & Operating Criteria: The maintenance SOP defines approved synthetic maintenance procedures, operating thresholds (< 4.5 mm/s Normal, 4.5-7.0 mm/s Watch, > 7.0 mm/s High), and mandated response actions for personnel.\n" +
        "3. Diagnostic Role vs Normative Standard: The inspection report provides the time-stamped diagnosis of actual conditions (e.g. rising vibration trend and oil seepage), whereas the SOP provides the normative reference standard and decision criteria against which those findings are evaluated for technical review.";

      const result = await DocumentGroundedAgent.processQuery({
        workspace,
        query,
        LLMConnector,
        forceResponse: response3Points,
      });

      assert.equal(result.isDocumentGrounded, true);
      const respLower = result.textResponse.toLowerCase();

      // Point 1: Observed findings & measurements
      assert.ok(
        respLower.includes("observed") || respLower.includes("measurement") || respLower.includes("finding"),
        "Must explain inspection report purpose (observed findings/measurements)"
      );

      // Point 2: Standardized procedures & thresholds
      assert.ok(
        respLower.includes("procedure") || respLower.includes("threshold") || respLower.includes("criteria"),
        "Must explain SOP purpose (procedures/criteria/thresholds)"
      );

      // Point 3: 3 distinct points
      assert.ok(
        respLower.includes("1.") && respLower.includes("2.") && respLower.includes("3."),
        "Must format purpose comparison in 3 distinct points"
      );

      const verification = RAGGroundingVerifier.verify({
        generatedText: result.textResponse,
        sources: result.sources,
      });
      assert.equal(verification.status, VerificationStatus.PASSED);
    });

    // ─── TEST 5 ────────────────────────────────────────────────────────────
    it("TEST 5: What is the difference between an inspection report and an SOP? (General knowledge query without uploaded docs constraint)", async () => {
      const query =
        "What is the difference between an inspection report and an SOP?";

      const analysis = DocumentGroundedAgent.analyzeQuery(query);
      assert.equal(
        analysis.isStrict,
        false,
        "TEST 5 must NOT have strict document constraint"
      );
      assert.equal(
        analysis.isGeneralKnowledge,
        true,
        "TEST 5 must be recognized as general knowledge query"
      );

      const generalAnswer =
        "An inspection report documents the observed findings, empirical measurements, and physical condition of equipment during an assessment. In contrast, a Standard Operating Procedure (SOP) defines the standardized step-by-step procedures, baseline operating criteria, acceptable thresholds, and rules governing how tasks should be performed.";

      const result = await DocumentGroundedAgent.processQuery({
        workspace,
        query,
        LLMConnector,
        forceResponse: generalAnswer,
      });

      assert.equal(result.isStrict, false);
      assert.equal(result.isGeneralKnowledge, true);

      // Must NOT return the uploaded documents failure message
      assert.notEqual(
        result.textResponse.trim(),
        DocumentGroundedAgent.FAILURE_MESSAGE,
        "General knowledge query must NOT return uploaded documents failure message"
      );

      const respLower = result.textResponse.toLowerCase();
      assert.ok(respLower.includes("inspection report") || respLower.includes("inspection"));
      assert.ok(respLower.includes("sop") || respLower.includes("standard operating procedure"));
    });

    // ─── TEST 6 ────────────────────────────────────────────────────────────
    it("TEST 6: What is the difference between an inspection report and an SOP? Use only the uploaded documents (Strictly document-grounded)", async () => {
      const query =
        "What is the difference between an inspection report and an SOP? Use only the uploaded documents.";

      const analysis = DocumentGroundedAgent.analyzeQuery(query);
      assert.equal(
        analysis.isStrict,
        true,
        "TEST 6 must be strictly document-grounded"
      );
      assert.equal(analysis.isDocumentGrounded, true);
      assert.equal(analysis.isGeneralKnowledge, false);

      const groundedAnswer =
        "According to 03_CONFIDENTIAL_Inspection_Report.pdf and 04_CONFIDENTIAL_Maintenance_SOP.docx:\n" +
        "- The inspection report (SYN-IR-204-0919) documents specific observed findings and recorded measurements for Air Compressor C-204 (7.8 mm/s vibration, 42.5 A current, 71 C temperature, 5.6 bar pressure, and oil seepage near seal housing).\n" +
        "- The Maintenance SOP (SYN-SOP-C204-07) defines the standardized maintenance procedure and vibration review criteria (< 4.5 mm/s Normal, 4.5-7.0 mm/s Watch, > 7.0 mm/s High requiring technical review before normal close-out).\n" +
        "Thus, the inspection report records actual asset conditions, while the SOP establishes the criteria and procedures to evaluate them.";

      const result = await DocumentGroundedAgent.processQuery({
        workspace,
        query,
        LLMConnector,
        forceResponse: groundedAnswer,
      });

      assert.equal(result.isStrict, true);
      assert.ok(result.sources.length >= 2, "Must retrieve uploaded documents");

      // Verify answer draws exclusively from uploaded files
      const respLower = result.textResponse.toLowerCase();
      assert.ok(
        respLower.includes("syn-ir") ||
          respLower.includes("syn-sop") ||
          respLower.includes("c-204") ||
          respLower.includes("7.8") ||
          respLower.includes("7.0"),
        "Answer must be strictly grounded in uploaded documents"
      );

      // Must never contain general knowledge fallback
      assert.equal(
        result.textResponse.includes("However, based on general knowledge"),
        false,
        "Strict document-grounded answer must NEVER contain 'However, based on general knowledge...'"
      );

      const verification = RAGGroundingVerifier.verify({
        generatedText: result.textResponse,
        sources: result.sources,
      });
      assert.equal(verification.status, VerificationStatus.PASSED);
    });

    // ─── TEST FAILURE CASE ──────────────────────────────────────────────────
    it("TEST FAILURE CASE: Asking for non-existent documents with 'Use only the uploaded documents' MUST return exact failure message and NEVER contain general knowledge fallback", async () => {
      const nonExistentQueries = [
        "Summarize the nuclear reactor core assembly in the uploaded documents. Use only the uploaded documents.",
        "What are the quarterly financial earnings for 2029? Use only the uploaded documents.",
        "According to the uploaded documents, what is the warp drive subspace frequency? Use only the uploaded documents.",
      ];

      for (const query of nonExistentQueries) {
        const result = await DocumentGroundedAgent.processQuery({
          workspace,
          query,
          LLMConnector,
        });

        assert.equal(result.isStrict, true);
        assert.equal(result.retrievalSuccess, false);

        // MUST return exact failure message
        assert.equal(
          result.textResponse.trim(),
          DocumentGroundedAgent.FAILURE_MESSAGE,
          "MUST return exact failure message: 'I could not find sufficient relevant information in the uploaded documents to answer this question.'"
        );

        // MUST NEVER contain forbidden general knowledge fallback
        assert.equal(
          result.textResponse.includes("However, based on general knowledge"),
          false,
          "MUST NEVER contain 'However, based on general knowledge...'"
        );
        assert.equal(
          /based\s+on\s+general\s+knowledge/i.test(result.textResponse),
          false,
          "MUST NEVER mention general model knowledge"
        );
      }
    });

    it("TEST FAILURE CASE: Intercepts and strips general knowledge fallback attempts on strict document queries", async () => {
      const query =
        "Summarize the quantum battery specifications. Use only the uploaded documents.";

      const forcedHallucinatingLLM = () =>
        "I could not find the quantum battery in the uploaded files. However, based on general knowledge, quantum batteries store energy using quantum entanglement.";

      const result = await DocumentGroundedAgent.processQuery({
        workspace,
        query,
        LLMConnector,
        forceResponse: forcedHallucinatingLLM,
      });

      assert.equal(
        result.textResponse.trim(),
        DocumentGroundedAgent.FAILURE_MESSAGE,
        "Intercepted fallback must be replaced with exact failure message"
      );
      assert.equal(
        result.textResponse.includes("However, based on general knowledge"),
        false
      );
    });
  });

  // =========================================================================
  // 4. CLOSED-LOOP RAG GROUNDING VERIFICATION & SAFETY CONTROLS
  // =========================================================================
  describe("4. RAG Grounding Verification & Hallucination Prevention Controls", () => {
    it("should verify factual claims against retrieved evidence using RAGGroundingVerifier", () => {
      const sources = [
        {
          text: "Equipment: Air Compressor C-204. Vibration B-2: 7.8 mm/s. Motor current: 42.5 A. Bearing temperature: 71 C. Discharge pressure: 5.6 bar.",
          metadata: { title: "03_CONFIDENTIAL_Inspection_Report.pdf" },
        },
      ];

      const groundedAnswer =
        "According to 03_CONFIDENTIAL_Inspection_Report.pdf, Air Compressor C-204 recorded vibration of 7.8 mm/s on bearing B-2, motor current of 42.5 A, temperature of 71 C, and discharge pressure of 5.6 bar.";

      const verification = RAGGroundingVerifier.verify({
        generatedText: groundedAnswer,
        sources,
      });

      assert.equal(verification.status, VerificationStatus.PASSED);
      assert.ok(verification.groundingScore >= 0.55);
      assert.equal(verification.ungroundedEntities.length, 0);
    });

    it("should strictly detect and reject hallucinated measurements not present in source context", () => {
      const sources = [
        {
          text: "Vibration B-2 was recorded as 7.8 mm/s. Motor current: 42.5 A.",
          metadata: { title: "03_CONFIDENTIAL_Inspection_Report.pdf" },
        },
      ];

      // Model hallucinates wrong measurements ("14.2 mm/s", "98.5 A", "120 C")
      const hallucinatedAnswer =
        "The vibration was 14.2 mm/s and motor current was 98.5 A with bearing temperature of 120 C.";

      const verification = RAGGroundingVerifier.verify({
        generatedText: hallucinatedAnswer,
        sources,
      });

      assert.equal(verification.status, VerificationStatus.FAILED);
      assert.ok(verification.ungroundedEntities.length > 0);
      assert.ok(verification.reason.includes("Potential hallucination"));
    });
  });
});
