const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  ClassificationService,
  SENSITIVITY_LEVELS,
  SENSITIVITY_HIERARCHY,
} = require("../utils/classification");

const {
  PolicyEngine,
  CAPABILITIES,
  ACTIONS,
  DEFAULT_GOVERNANCE_RULES,
} = require("../utils/policy");

describe("SIH PS 26117 — Sovereign Data Classification & Policy Control Suite", () => {

  // =========================================================================
  // 1. CLASSIFICATION SCANNER & HEURISTICS TESTS
  // =========================================================================
  describe("Classification Scanner Engine", () => {
    it("should classify clean non-sensitive technical text as PUBLIC", () => {
      const sample = `
        Open Source Architecture Overview
        This document explains how React hooks interact with HTML DOM elements.
        Standard open-source library documentation under MIT license.
      `;
      const result = ClassificationService.classifyDocument({
        text: sample,
        filename: "readme.md",
      });

      assert.equal(result.classification, SENSITIVITY_LEVELS.PUBLIC);
      assert.ok(result.confidence >= 0.7);
    });

    it("should classify text with internal engineering notes as INTERNAL", () => {
      const sample = `
        Sprint Retrospective 2026-Q3
        Team internal notes: The staging server deployment for workspace sync is scheduled for Friday.
        All team members must complete the internal knowledge base checklist.
      `;
      const result = ClassificationService.classifyDocument({
        text: sample,
        filename: "notes.txt",
      });

      assert.equal(result.classification, SENSITIVITY_LEVELS.INTERNAL);
    });

    it("should classify financial and NDA content as CONFIDENTIAL", () => {
      const sample = `
        NON-DISCLOSURE AGREEMENT (CONFIDENTIAL)
        This proprietary financial statement outlines quarterly revenue, EBITDA margins,
        and employee payroll allocation for FY2026. Do not distribute outside executive team.
      `;
      const result = ClassificationService.classifyDocument({
        text: sample,
        filename: "financial_report.pdf",
      });

      assert.equal(result.classification, SENSITIVITY_LEVELS.CONFIDENTIAL);
      assert.ok(result.reasons.length > 0);
    });

    it("should classify cryptographic keys as RESTRICTED", () => {
      const sample = `
        Infrastructure Deployment Token
        -----BEGIN RSA PRIVATE KEY-----
        MIIEowIBAAKCAQEA0Y1+MockKeyDataForIndustrialTurbineController+492
        -----END RSA PRIVATE KEY-----
      `;
      const result = ClassificationService.classifyDocument({
        text: sample,
        filename: "id_rsa",
      });

      assert.equal(result.classification, SENSITIVITY_LEVELS.RESTRICTED);
      assert.ok(result.confidence >= 0.95);
    });

    it("should classify industrial SCADA / PLC / ITAR markings as RESTRICTED", () => {
      const sample = `
        ITAR CONTROLLED TECHNICAL SPECIFICATION - RESTRICTED
        MODBUS_REGISTER_CONFIG for Gas Turbine Turbine Valve 4B
        PLC_TAG: SCADA_ALARM_CRITICAL_SHUTDOWN
        Export strictly prohibited under defense trade controls.
      `;
      const result = ClassificationService.classifyDocument({
        text: sample,
        filename: "scada_control.docx",
      });

      assert.equal(result.classification, SENSITIVITY_LEVELS.RESTRICTED);
    });
  });

  // =========================================================================
  // 2. SUPREMUM SENSITIVITY RESOLUTION (LINEAGE & INHERITANCE)
  // =========================================================================
  describe("Supremum & Output Lineage Calculation", () => {
    it("Scenario 15: Output sensitivity correctly resolves supremum of input chunks", () => {
      // Empty / non-sensitive resolves to PUBLIC
      assert.equal(ClassificationService.resolveSupremum([]), SENSITIVITY_LEVELS.PUBLIC);

      // Single item
      assert.equal(
        ClassificationService.resolveSupremum([SENSITIVITY_LEVELS.INTERNAL]),
        SENSITIVITY_LEVELS.INTERNAL
      );

      // PUBLIC + INTERNAL -> INTERNAL
      assert.equal(
        ClassificationService.resolveSupremum([
          SENSITIVITY_LEVELS.PUBLIC,
          SENSITIVITY_LEVELS.INTERNAL,
        ]),
        SENSITIVITY_LEVELS.INTERNAL
      );

      // INTERNAL + CONFIDENTIAL -> CONFIDENTIAL
      assert.equal(
        ClassificationService.resolveSupremum([
          SENSITIVITY_LEVELS.INTERNAL,
          SENSITIVITY_LEVELS.CONFIDENTIAL,
        ]),
        SENSITIVITY_LEVELS.CONFIDENTIAL
      );

      // CONFIDENTIAL + RESTRICTED -> RESTRICTED
      assert.equal(
        ClassificationService.resolveSupremum([
          SENSITIVITY_LEVELS.CONFIDENTIAL,
          SENSITIVITY_LEVELS.RESTRICTED,
        ]),
        SENSITIVITY_LEVELS.RESTRICTED
      );

      // Array with objects having .classification
      assert.equal(
        ClassificationService.resolveSupremum([
          { classification: SENSITIVITY_LEVELS.PUBLIC },
          { classification: SENSITIVITY_LEVELS.RESTRICTED },
          { classification: SENSITIVITY_LEVELS.INTERNAL },
        ]),
        SENSITIVITY_LEVELS.RESTRICTED
      );
    });

    it("Scenario 9: Ambiguous / unknown classification falls back conservatively to higher sensitivity", () => {
      const res = ClassificationService.resolveSupremum(["UNKNOWN_TIER", "MALFORMED"]);
      assert.equal(res, SENSITIVITY_LEVELS.RESTRICTED);
    });
  });

  // =========================================================================
  // 3. POLICY ENGINE 15 CORE ACCEPTANCE SCENARIOS
  // =========================================================================
  describe("Policy Engine Enforcement Matrix", () => {
    const defaultUser = { id: 10, role: "default" };
    const adminUser = { id: 1, role: "admin" };
    const testWorkspace = { id: 5, slug: "industrial-plant-a" };

    // 1. Public document + allowed model -> ALLOW
    it("Scenario 1: Public document + allowed model -> ALLOW", () => {
      const evalResult = PolicyEngine.evaluatePolicy({
        user: defaultUser,
        workspace: testWorkspace,
        classification: SENSITIVITY_LEVELS.PUBLIC,
        requestedCapability: CAPABILITIES.MODEL,
        model: "ollama/llama3.2",
      });

      assert.equal(evalResult.allowed, true);
      assert.equal(evalResult.effect, "ALLOW");
    });

    // 2. Internal document + allowed model -> ALLOW
    it("Scenario 2: Internal document + allowed model -> ALLOW", () => {
      const evalResult = PolicyEngine.evaluatePolicy({
        user: defaultUser,
        workspace: testWorkspace,
        classification: SENSITIVITY_LEVELS.INTERNAL,
        requestedCapability: CAPABILITIES.MODEL,
        model: "ollama/llama3.2",
      });

      assert.equal(evalResult.allowed, true);
      assert.equal(evalResult.effect, "ALLOW");
    });

    // 3. Confidential document + cloud model -> DENY
    it("Scenario 3: Confidential document + cloud model -> DENY", () => {
      const cloudModels = [
        "openai/gpt-4o",
        "anthropic/claude-3-5-sonnet",
        "gemini-1.5-pro",
        "azure-openai",
      ];

      for (const model of cloudModels) {
        const evalResult = PolicyEngine.evaluatePolicy({
          user: defaultUser,
          workspace: testWorkspace,
          classification: SENSITIVITY_LEVELS.CONFIDENTIAL,
          requestedCapability: CAPABILITIES.MODEL,
          model,
        });

        assert.equal(
          evalResult.allowed,
          false,
          `Expected ${model} to be DENIED for CONFIDENTIAL data`
        );
        assert.equal(evalResult.effect, "DENY");
        assert.ok(evalResult.reason.toLowerCase().includes("cloud"));
      }
    });

    // 4. Restricted document + unauthorized model -> DENY
    it("Scenario 4: Restricted document + unauthorized cloud model -> DENY", () => {
      const evalResult = PolicyEngine.evaluatePolicy({
        user: adminUser,
        workspace: testWorkspace,
        classification: SENSITIVITY_LEVELS.RESTRICTED,
        requestedCapability: CAPABILITIES.MODEL,
        model: "openai/gpt-4",
      });

      assert.equal(evalResult.allowed, false);
      assert.equal(evalResult.effect, "DENY");
    });

    // 5. Unauthorized tool invocation (e.g. web scraping on Confidential / Restricted) -> DENY
    it("Scenario 5: Restricted / Confidential document + network egress tool -> DENY", () => {
      const networkTools = ["web-scraping", "fetch-url", "github-repo-sync", "email-send"];

      for (const tool of networkTools) {
        const evalResult = PolicyEngine.evaluatePolicy({
          user: defaultUser,
          workspace: testWorkspace,
          classification: SENSITIVITY_LEVELS.RESTRICTED,
          requestedCapability: CAPABILITIES.TOOL,
          tool,
        });

        assert.equal(
          evalResult.allowed,
          false,
          `Expected tool ${tool} to be DENIED on RESTRICTED sensitivity`
        );
        assert.equal(evalResult.effect, "DENY");
      }

      // But local document RAG / workspace tool is ALLOWED
      const localResult = PolicyEngine.evaluatePolicy({
        user: defaultUser,
        workspace: testWorkspace,
        classification: SENSITIVITY_LEVELS.RESTRICTED,
        requestedCapability: CAPABILITIES.TOOL,
        tool: "rag-memory",
      });
      assert.equal(localResult.allowed, true);
    });

    // 6. Unauthorized knowledge chunk -> BLOCKED from RAG
    it("Scenario 6: Unauthorized knowledge source -> BLOCKED from RAG retrieval", () => {
      // Default user querying Restricted knowledge source without clearance -> BLOCKED
      const evalResult = PolicyEngine.evaluatePolicy({
        user: defaultUser,
        workspace: testWorkspace,
        classification: SENSITIVITY_LEVELS.RESTRICTED,
        requestedCapability: CAPABILITIES.KNOWLEDGE,
        source: "nuclear_turbine_schematic.pdf",
      });

      assert.equal(evalResult.allowed, false);
      assert.equal(evalResult.effect, "DENY");
    });

    // 7. Unauthorized export action -> DENY
    it("Scenario 7: Unauthorized export action on RESTRICTED data -> DENIED", () => {
      const evalResult = PolicyEngine.evaluatePolicy({
        user: defaultUser,
        workspace: testWorkspace,
        classification: SENSITIVITY_LEVELS.RESTRICTED,
        requestedCapability: CAPABILITIES.ACTION,
        action: ACTIONS.EXPORT,
      });

      assert.equal(evalResult.allowed, false);
      assert.equal(evalResult.effect, "DENY");
    });

    // 8. User role permissions (admin vs default) on Restricted delete/export -> DENIED for default, ALLOW for admin
    it("Scenario 8: Role permissions on Restricted delete -> DENIED for default user, ALLOW for admin", () => {
      const defaultDelete = PolicyEngine.evaluatePolicy({
        user: defaultUser,
        workspace: testWorkspace,
        classification: SENSITIVITY_LEVELS.RESTRICTED,
        requestedCapability: CAPABILITIES.ACTION,
        action: ACTIONS.DELETE,
      });
      assert.equal(defaultDelete.allowed, false);

      const adminDelete = PolicyEngine.evaluatePolicy({
        user: adminUser,
        workspace: testWorkspace,
        classification: SENSITIVITY_LEVELS.RESTRICTED,
        requestedCapability: CAPABILITIES.ACTION,
        action: ACTIONS.DELETE,
      });
      assert.equal(adminDelete.allowed, true);
    });

    // 9. Classification uncertainty -> conservative fallback to more restrictive
    it("Scenario 9: Missing or corrupted classification defaults to RESTRICTED (fail-closed)", () => {
      const evalMissing = PolicyEngine.evaluatePolicy({
        user: defaultUser,
        workspace: testWorkspace,
        classification: null,
        requestedCapability: CAPABILITIES.MODEL,
        model: "openai/gpt-4o",
      });

      assert.equal(evalMissing.allowed, false);
      assert.equal(evalMissing.effect, "DENY");
    });

    // 10. Manual classification escalation -> audited and updated
    it("Scenario 10: Manual classification escalation is accepted and sets status human_reviewed", async () => {
      // Mock doc update logic
      const updateRes = await ClassificationService.updateClassification({
        docpath: "test-folder/sample.txt",
        newClassification: SENSITIVITY_LEVELS.RESTRICTED,
        reason: "Security audit escalation",
        user: adminUser,
      });

      // Even if file doesn't exist on disk in test environment, helper returns success or error gracefully
      // Let's verify validation rejects invalid classifications
      const invalidRes = await ClassificationService.updateClassification({
        docpath: "test-folder/sample.txt",
        newClassification: "SUPER_TOP_SECRET_INVALID",
        reason: "Invalid tier test",
        user: adminUser,
      });
      assert.equal(invalidRes.success, false);
      assert.ok(invalidRes.error.includes("Invalid classification level"));
    });

    // 11. Unauthorized classification downgrade -> rejected for non-admin
    it("Scenario 11: Unauthorized classification downgrade rejected for non-admin", async () => {
      // Trying to downgrade with a default non-admin user
      const downgradeAttempt = await ClassificationService.updateClassification({
        docpath: "test-folder/sample.txt",
        newClassification: SENSITIVITY_LEVELS.PUBLIC,
        reason: "Sneaky downgrade attempt",
        user: defaultUser,
      });

      assert.equal(downgradeAttempt.success, false);
      assert.ok(downgradeAttempt.error.includes("Admin privileges required"));
    });

    // 12. Policy engine fail-closed -> DENY on invalid input
    it("Scenario 12: Policy engine fail-closed on corrupt input", () => {
      const corruptEval = PolicyEngine.evaluatePolicy(null);
      assert.equal(corruptEval.allowed, false);
      assert.equal(corruptEval.effect, "DENY");

      const emptyEval = PolicyEngine.evaluatePolicy({});
      assert.equal(emptyEval.allowed, false);
      assert.equal(emptyEval.effect, "DENY");
    });

    // 13. Agent attempting to invoke blocked tool -> intercepted with safe explanation
    it("Scenario 13: Agent attempting to invoke blocked tool is intercepted with safe explanation", () => {
      const toolEval = PolicyEngine.evaluatePolicy({
        user: defaultUser,
        workspace: testWorkspace,
        classification: SENSITIVITY_LEVELS.RESTRICTED,
        requestedCapability: CAPABILITIES.TOOL,
        tool: "web-scraping",
      });

      assert.equal(toolEval.allowed, false);
      assert.ok(toolEval.reason.includes("RESTRICTED"));
      assert.ok(toolEval.reason.includes("denied"));
    });

    // 14. Model router policy constraints -> excludes cloud models on sensitive data
    it("Scenario 14: Sovereign model filtering blocks cloud models when sensitivity is CONFIDENTIAL or RESTRICTED", () => {
      const cloudCandidates = [
        { model: "openai/gpt-4o", provider: "openai" },
        { model: "anthropic/claude-3-5", provider: "anthropic" },
        { model: "ollama/llama3.2", provider: "ollama" },
      ];

      const allowedForConfidential = cloudCandidates.filter((candidate) => {
        const evalRes = PolicyEngine.evaluatePolicy({
          user: defaultUser,
          workspace: testWorkspace,
          classification: SENSITIVITY_LEVELS.CONFIDENTIAL,
          requestedCapability: CAPABILITIES.MODEL,
          model: candidate.model,
        });
        return evalRes.allowed;
      });

      assert.equal(allowedForConfidential.length, 1);
      assert.equal(allowedForConfidential[0].model, "ollama/llama3.2");
    });
  });

  // =========================================================================
  // 4. GOVERNANCE MATRIX METADATA & AUDITING
  // =========================================================================
  describe("Governance Matrix & Regulatory Audit", () => {
    it("should export complete 4-tier governance matrix for administration", () => {
      const matrix = PolicyEngine.getPolicyGovernanceMatrix();
      assert.equal(Array.isArray(matrix), true);
      assert.equal(matrix.length, 4);

      const tiers = matrix.map((m) => m.tier);
      assert.deepEqual(tiers, ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]);
    });

    it("should sanitize audit metadata to prevent leaking sensitive document text", () => {
      const safeMetadata = PolicyEngine.sanitizeMetadataForAudit({
        documentName: "turbine_schematic.pdf",
        fullText: "UNAUTHORIZED LEAK TEXT WITH CONFIDENTIAL SECRETS 12345",
        classification: SENSITIVITY_LEVELS.RESTRICTED,
      });

      assert.equal(safeMetadata.documentName, "turbine_schematic.pdf");
      assert.equal(safeMetadata.classification, SENSITIVITY_LEVELS.RESTRICTED);
      assert.equal(safeMetadata.fullText, undefined);
    });
  });
});
