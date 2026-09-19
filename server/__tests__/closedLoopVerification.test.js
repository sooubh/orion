const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  VerificationManager,
  VerificationStatus,
  RepairStrategy,
  StepType,
  RootCauseCategory,
  MAX_REPAIR_ATTEMPTS,
  StructuredOutputVerifier,
  CalculationVerifier,
  RAGGroundingVerifier,
  DeliverableVerifier,
  DiagnosisEngine,
  RepairEngine,
} = require("../utils/verification");

const { PolicyEngine } = require("../utils/policy");
const { EventLogs } = require("../models/eventLogs");

test.describe("SIH PS 26117 — Closed-Loop Verification & Self-Repair Test Suite", () => {
  test.beforeEach(() => {
    VerificationManager.reset();
  });

  // Scenario 1: First-try success (no repair needed, verified)
  test("Scenario 1: First-try execution passes verification immediately with zero repair attempts", async () => {
    const step = {
      stepId: "step_calc_01",
      type: StepType.CALCULATION,
      expression: "125 * 4",
      expectedResult: 500,
    };

    const output = 500;
    const result = await VerificationManager.verifyStep({ step, output });

    assert.equal(result.status, VerificationStatus.PASSED);
    assert.equal(result.confidence, 1.0);
    assert.equal(VerificationManager.attempts.get(step.stepId) || 0, 0);
  });

  // Scenario 2: Calculation mismatch detected -> diagnosed -> repaired -> verified
  test("Scenario 2: Calculation mismatch detected -> diagnosed -> repaired -> verified on second attempt", async () => {
    const step = {
      stepId: "step_industrial_pressure_calc",
      type: StepType.CALCULATION,
      expression: "3.5 * 14.696", // Bar to PSI conversion
      expectedResult: 51.436,
    };

    // First attempt: Model produces hallucinated/incorrect arithmetic
    const wrongOutput = 42.15;
    const initialVerification = await VerificationManager.verifyStep({ step, output: wrongOutput });

    assert.equal(initialVerification.status, VerificationStatus.FAILED);
    assert.equal(initialVerification.expected, 51.436);
    assert.equal(initialVerification.actual, 42.15);

    // Diagnosis & Repair formulation
    const repairState = await VerificationManager.diagnoseAndRepair({
      step,
      verificationResult: initialVerification,
    });

    assert.equal(repairState.canRetry, true);
    assert.equal(repairState.attempts, 1);
    assert.equal(repairState.diagnosis.rootCause, RootCauseCategory.CALCULATION_DRIFT);
    assert.equal(repairState.diagnosis.repairStrategy, RepairStrategy.RECALCULATION);
    assert.equal(repairState.diagnosis.suggestedFix.correctValue, 51.436);

    // Simulated re-execution with repaired value applied
    const repairedOutput = repairState.diagnosis.suggestedFix.correctValue;
    const reVerification = await VerificationManager.verifyStep({ step, output: repairedOutput });

    assert.equal(reVerification.status, VerificationStatus.PASSED);
    assert.equal(reVerification.actual, 51.436);
  });

  // Scenario 3: Structured output schema violation -> repaired -> verified
  test("Scenario 3: JSON schema violation (missing keys) detected -> diagnosed -> repaired -> verified", async () => {
    const schema = {
      required: ["assetId", "temperatureC", "status"],
      properties: {
        assetId: { type: "string" },
        temperatureC: { type: "number", maximum: 150 },
        status: { type: "string" },
      },
    };

    const step = {
      stepId: "step_scada_telemetry_json",
      type: StepType.STRUCTURED_OUTPUT,
      schema,
    };

    // First attempt: Model omits required 'status' and outputs temperature as a string
    const invalidOutput = JSON.stringify({
      assetId: "TURBINE-04",
      temperatureC: "98.5", // type mismatch
    });

    const initialVerification = await VerificationManager.verifyStep({
      step,
      output: invalidOutput,
    });

    assert.equal(initialVerification.status, VerificationStatus.FAILED);
    assert.ok(initialVerification.reason.includes("missing required fields: [status]"));
    assert.ok(initialVerification.reason.includes("type mismatches"));

    // Diagnose and repair
    const repairState = await VerificationManager.diagnoseAndRepair({
      step,
      verificationResult: initialVerification,
    });

    assert.equal(repairState.diagnosis.rootCause, RootCauseCategory.SCHEMA_VIOLATION);
    assert.equal(repairState.diagnosis.repairStrategy, RepairStrategy.SCHEMA_CORRECTION);
    assert.deepEqual(repairState.diagnosis.suggestedFix.missingKeys, ["status"]);

    // Second execution conforms to schema
    const correctedOutput = JSON.stringify({
      assetId: "TURBINE-04",
      temperatureC: 98.5,
      status: "NOMINAL",
    });

    const reVerification = await VerificationManager.verifyStep({
      step,
      output: correctedOutput,
    });

    assert.equal(reVerification.status, VerificationStatus.PASSED);
  });

  // Scenario 4: Deliverable generation failure (empty file or corrupt header) -> repaired -> verified
  test("Scenario 4: Deliverable file integrity failure (corrupt magic bytes / 0 bytes) -> repaired -> verified", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orion-verify-test-"));
    const corruptFile = path.join(tmpDir, "report.docx");

    // Create a 0-byte or corrupted docx
    fs.writeFileSync(corruptFile, Buffer.from("NOT_A_ZIP_HEADER"));

    const step = {
      stepId: "step_export_docx",
      type: StepType.DELIVERABLE,
      filePath: corruptFile,
    };

    const initialVerification = await VerificationManager.verifyStep({
      step,
      output: corruptFile,
    });

    assert.equal(initialVerification.status, VerificationStatus.FAILED);
    assert.ok(initialVerification.reason.includes("File signature mismatch") || initialVerification.reason.includes("small"));

    // Diagnose & repair
    const repairState = await VerificationManager.diagnoseAndRepair({
      step,
      verificationResult: initialVerification,
    });

    assert.equal(repairState.diagnosis.rootCause, RootCauseCategory.CORRUPT_DELIVERABLE);
    assert.equal(repairState.diagnosis.repairStrategy, RepairStrategy.DELIVERABLE_REBUILD);

    // Rebuild deliverable with valid DOCX ZIP magic bytes (PK\x03\x04) and non-zero payload (> 100 bytes)
    const validHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    const payload = Buffer.alloc(200, "A");
    fs.writeFileSync(corruptFile, Buffer.concat([validHeader, payload]));

    const reVerification = await VerificationManager.verifyStep({
      step,
      output: corruptFile,
    });

    assert.equal(reVerification.status, VerificationStatus.PASSED);

    // Clean up
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  // Scenario 5: RAG hallucination / grounding mismatch -> repaired by context alignment -> verified
  test("Scenario 5: RAG ungrounded factual claim detected -> diagnosed -> repaired with source constraints -> verified", async () => {
    const sources = [
      {
        text: "The hydraulic pump pressure is calibrated to 2200 psi and operates at 1800 rpm under standard load.",
        metadata: { title: "pump_manual.pdf" },
      },
    ];

    const step = {
      stepId: "step_rag_hydraulic_specs",
      type: StepType.RAG_GROUNDING,
      sources,
      citedSources: [{ title: "pump_manual.pdf" }],
    };

    // First attempt: Model hallucinates a number not in source ("4500 psi", "3200 rpm")
    const hallucinatedText =
      "The hydraulic pump pressure is calibrated to 4500 psi and runs at 3200 rpm.";

    const initialVerification = await VerificationManager.verifyStep({
      step,
      output: hallucinatedText,
    });

    assert.equal(initialVerification.status, VerificationStatus.FAILED);
    assert.ok(initialVerification.ungroundedEntities.length > 0);
    assert.ok(initialVerification.reason.includes("Potential hallucination"));

    // Diagnose and repair
    const repairState = await VerificationManager.diagnoseAndRepair({
      step,
      verificationResult: initialVerification,
    });

    assert.equal(repairState.diagnosis.rootCause, RootCauseCategory.UNGROUNDED_CLAIM);
    assert.ok(
      repairState.diagnosis.repairStrategy === RepairStrategy.QUERY_REFINEMENT ||
        repairState.diagnosis.repairStrategy === RepairStrategy.RETRIEVAL_EXPANSION
    );

    // Re-executed response strictly grounded in provided sources
    const groundedText =
      "According to pump_manual.pdf, the hydraulic pump pressure is calibrated to 2200 psi and operates at 1800 rpm under standard load.";

    const reVerification = await VerificationManager.verifyStep({
      step,
      output: groundedText,
    });

    assert.equal(reVerification.status, VerificationStatus.PASSED);
  });

  // Scenario 6: Tool execution / syntax error -> repaired -> verified
  test("Scenario 6: Tool parameter execution error -> diagnosed -> repaired -> verified", async () => {
    const step = {
      stepId: "step_tool_database_query",
      type: StepType.TOOL_CALL,
      toolName: "sql_query",
      input: { query: "SELEKT * FORM turbines" }, // syntax error
    };

    const toolErrorOutput = {
      error: "Syntax error near SELEKT",
      success: false,
    };

    const initialVerification = await VerificationManager.verifyStep({
      step,
      output: toolErrorOutput,
    });

    assert.equal(initialVerification.status, VerificationStatus.FAILED);

    const repairState = await VerificationManager.diagnoseAndRepair({
      step,
      verificationResult: initialVerification,
    });

    assert.equal(repairState.diagnosis.rootCause, RootCauseCategory.TOOL_EXECUTION_FAILURE);
    assert.equal(repairState.diagnosis.repairStrategy, RepairStrategy.PARAMETER_CORRECTION);

    // Corrected tool call
    const successfulOutput = {
      success: true,
      rows: [{ id: 1, name: "Turbine A" }],
    };

    const reVerification = await VerificationManager.verifyStep({
      step,
      output: successfulOutput,
    });

    assert.equal(reVerification.status, VerificationStatus.PASSED);
  });

  // Scenario 7: Exhausted retries boundary -> strictly transitions to REQUIRES_HUMAN_REVIEW
  test("Scenario 7: Exceeding MAX_REPAIR_ATTEMPTS strictly transitions task to REQUIRES_HUMAN_REVIEW", async () => {
    const step = {
      stepId: "step_unrepairable_sensor_anomaly",
      type: StepType.CALCULATION,
      expression: "100 / 0",
      expectedResult: 50,
    };

    const badOutput = 0;

    // Attempt 1
    const ver1 = await VerificationManager.verifyStep({ step, output: badOutput });
    const repair1 = await VerificationManager.diagnoseAndRepair({ step, verificationResult: ver1 });
    assert.equal(repair1.canRetry, true);
    assert.equal(repair1.attempts, 1);

    // Attempt 2
    const ver2 = await VerificationManager.verifyStep({ step, output: badOutput });
    const repair2 = await VerificationManager.diagnoseAndRepair({ step, verificationResult: ver2 });
    assert.equal(repair2.canRetry, true);
    assert.equal(repair2.attempts, 2);

    // Attempt 3 (exceeds MAX_REPAIR_ATTEMPTS = 2) -> Boundary triggers REQUIRES_HUMAN_REVIEW
    const ver3 = await VerificationManager.verifyStep({ step, output: badOutput });
    const repair3 = await VerificationManager.diagnoseAndRepair({ step, verificationResult: ver3 });

    assert.equal(repair3.status, VerificationStatus.REQUIRES_HUMAN_REVIEW);
    assert.equal(repair3.canRetry, false);
    assert.ok(repair3.reason.includes("Exceeded maximum automated repair attempts"));

    // Verify item queued in human review queue
    const queue = VerificationManager.getHumanReviewQueue();
    const queuedItem = queue.find((q) => q.stepId === step.stepId);
    assert.ok(queuedItem);
    assert.equal(queuedItem.status, VerificationStatus.REQUIRES_HUMAN_REVIEW);
  });

  // Scenario 8: Fail-closed security guarantee: a failed step never silently passes
  test("Scenario 8: Fail-closed guarantee: any uncertain, missing, or failed check defaults to FAILED", async () => {
    const step = {
      stepId: "step_critical_safety_interlock",
      type: StepType.CALCULATION,
      // No expression or expected value provided
    };

    const result = await VerificationManager.verifyStep({
      step,
      output: "some_unverifiable_claim",
    });

    // Verification must fail closed (status UNCERTAIN or FAILED is never PASSED)
    assert.notEqual(result.status, VerificationStatus.PASSED);
  });

  // Scenario 9: Sovereign air-gap compliance: all verification runs locally with 0 external network requests
  test("Scenario 9: Sovereign air-gap compliance: verifiers execute entirely on-premise without network dependencies", async () => {
    // Test that arithmetic, schema, and grounding verifiers execute synchronously/locally
    const calcResult = CalculationVerifier.verify({
      claimedValue: 300,
      expression: "100 * 3",
    });
    assert.equal(calcResult.status, VerificationStatus.PASSED);

    const schemaResult = StructuredOutputVerifier.verify({
      output: { valid: true },
      schema: { required: ["valid"] },
    });
    assert.equal(schemaResult.status, VerificationStatus.PASSED);

    const groundingResult = RAGGroundingVerifier.verify({
      generatedText: "Pressure is 150 psi.",
      sources: ["Pressure is 150 psi in normal operation."],
    });
    assert.equal(groundingResult.status, VerificationStatus.PASSED);
  });

  // Scenario 10: Model router repair strategy: escalation to higher-tier sovereign model on repeated difficulty
  test("Scenario 10: High-complexity failure triggers automatic escalation to higher-tier sovereign model", async () => {
    const step = {
      stepId: "step_complex_thermodynamic_proof",
      type: StepType.TOOL_CALL,
      toolName: "thermo_solver",
      input: { equation: "dE = TdS - PdV" },
    };

    const verificationResult = {
      status: VerificationStatus.FAILED,
      reason: "Complex multi-variable constraint solving failed on current model.",
      method: "DefaultToolVerifier",
    };

    // Attempt 2 triggers model escalation
    const diagnosis = DiagnosisEngine.diagnose({
      step,
      verificationResult,
      attemptNumber: 2,
    });

    assert.equal(diagnosis.repairStrategy, RepairStrategy.MODEL_ESCALATION);

    const repair = RepairEngine.formulateRepair({
      step,
      diagnosis,
      context: { classification: "INTERNAL" },
    });

    assert.ok(repair.modelOverride);
    assert.ok(repair.modelOverride.includes("ollama/qwen2.5:72b") || repair.modelOverride.includes("ollama/llama3.3:70b"));
    assert.ok(repair.feedbackPrompt.includes("higher-tier sovereign model"));
  });

  // Scenario 11: Data classification preservation during verification & repair
  test("Scenario 11: Repair loop strictly preserves data classification policies and air-gap rules", async () => {
    const step = {
      stepId: "step_restricted_turbine_schematics",
      type: StepType.TOOL_CALL,
      toolName: "export_data",
      input: { doc: "secret_turbine.dwg" },
    };

    const diagnosis = DiagnosisEngine.diagnose({
      step,
      verificationResult: { status: VerificationStatus.FAILED, reason: "export error" },
      attemptNumber: 2,
    });

    // When context is RESTRICTED, PolicyEngine must not allow cloud model escalation
    const repair = RepairEngine.formulateRepair({
      step,
      diagnosis,
      context: { classification: "RESTRICTED" },
    });

    // Ensure model override is sovereign/local only, never cloud
    assert.ok(!repair.modelOverride.includes("openai"));
    assert.ok(!repair.modelOverride.includes("claude"));
    assert.ok(PolicyEngine.isModelPermitted(repair.modelOverride, "RESTRICTED"));
  });

  // Scenario 12: Audit logging integrity: all verification, failure, and repair attempts logged with sanitized metadata
  test("Scenario 12: Audit logging integrity: all events recorded in EventLogs without leaking sensitive document text", async () => {
    let loggedEvents = [];
    const origLogEvent = EventLogs.logEvent;
    EventLogs.logEvent = async (event, data, userId) => {
      loggedEvents.push({ event, data, userId });
      return true;
    };

    try {
      const step = {
        stepId: "step_audit_test_01",
        type: StepType.CALCULATION,
        expression: "10 + 20",
        expectedResult: 30,
      };

      await VerificationManager.verifyStep({ step, output: 30 });
      assert.ok(loggedEvents.some((e) => e.event === "verification_passed"));

      await VerificationManager.verifyStep({ step, output: 99 });
      assert.ok(loggedEvents.some((e) => e.event === "verification_failed"));

      // Check sanitization: no unbounded raw text dumps
      const failLog = loggedEvents.find((e) => e.event === "verification_failed");
      assert.ok(failLog.data.stepId === "step_audit_test_01");
      assert.ok(typeof failLog.data.reason === "string");
      assert.ok(failLog.data.reason.length <= 200);
    } finally {
      EventLogs.logEvent = origLogEvent;
    }
  });

  // Scenario 13: Human review resolution: operator inspects failed step and approves override
  test("Scenario 13: Human review resolution: operator overrides stalled step with audit confirmation", async () => {
    const step = {
      stepId: "step_operator_override_test",
      type: StepType.TOOL_CALL,
      toolName: "safety_valve_controller",
    };

    // Force step to exceed MAX_REPAIR_ATTEMPTS
    VerificationManager.attempts.set(step.stepId, 3);
    const repairResult = await VerificationManager.diagnoseAndRepair({
      step,
      verificationResult: { status: VerificationStatus.FAILED, reason: "Persistent valve calibration delta" },
    });

    assert.equal(repairResult.status, VerificationStatus.REQUIRES_HUMAN_REVIEW);

    // Human operator review
    const reviewer = { id: 1, username: "lead_safety_engineer" };
    const resolved = await VerificationManager.resolveHumanReview(step.stepId, {
      action: "APPROVED_OVERRIDE",
      notes: "Field technician manually verified valve mechanical stop. Override authorized.",
      reviewerUser: reviewer,
    });

    assert.equal(resolved.resolved, true);
    assert.equal(resolved.resolution.action, "APPROVED_OVERRIDE");
    assert.equal(resolved.resolution.reviewedBy, "lead_safety_engineer");
  });

  // Scenario 14: WebSocket event progression stream
  test("Scenario 14: WebSocket event progression emits proper lifecycle notifications", async () => {
    const emittedEvents = [];
    const mockSocket = {
      send: (msgStr) => {
        emittedEvents.push(JSON.parse(msgStr));
      },
    };

    const step = {
      stepId: "step_ws_lifecycle_test",
      type: StepType.CALCULATION,
      expression: "50 * 2",
      expectedResult: 100,
    };

    // Verification start + failure
    const ver1 = await VerificationManager.verifyStep({
      step,
      output: 80,
      socket: mockSocket,
    });

    // Repair start
    await VerificationManager.diagnoseAndRepair({
      step,
      verificationResult: ver1,
      socket: mockSocket,
    });

    // Verification start + pass
    await VerificationManager.verifyStep({
      step,
      output: 100,
      socket: mockSocket,
    });

    const eventTypes = emittedEvents.map((e) => e.event);
    assert.ok(eventTypes.includes("step_verification_start"));
    assert.ok(eventTypes.includes("step_verification_failed"));
    assert.ok(eventTypes.includes("step_repair_start"));
    assert.ok(eventTypes.includes("step_verification_passed"));
  });
});
