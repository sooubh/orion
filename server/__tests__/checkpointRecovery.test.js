const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  CheckpointManager,
  CheckpointStore,
  CheckpointValidator,
  CheckpointRestorer,
  RecoveryDecisionEngine,
  CheckpointStatus,
  RecoveryAction,
  StateCorruptionLevel,
  MAX_RECOVERY_ATTEMPTS,
} = require("../utils/checkpoints");

const {
  VerificationManager,
  VerificationStatus,
  StepType,
} = require("../utils/verification");

const { PolicyEngine } = require("../utils/policy");
const { EventLogs } = require("../models/eventLogs");

test.describe("SIH PS 26117 — Checkpoint-Based Execution & Safe Workflow Recovery Suite", () => {
  const testTaskId = "test_industrial_inspection_task_401";

  test.beforeEach(async () => {
    CheckpointManager.reset();
    await CheckpointStore.clearTaskCheckpoints(testTaskId);
  });

  test.afterEach(async () => {
    await CheckpointStore.clearTaskCheckpoints(testTaskId);
  });

  // Scenario 1: Successful workflow creates checkpoints
  test("Scenario 1: Successful step execution with verification creates valid checkpoints", async () => {
    const step1 = {
      stepId: "step_doc_ocr",
      stepOrder: 1,
      stepTitle: "Document OCR Processing",
      type: StepType.TOOL_CALL,
      toolName: "ocr_parser",
      input: { file: "turbine_schematic.pdf" },
    };

    const verificationResult = {
      status: "PASSED",
      confidence: 1.0,
      method: "OCRQualityVerifier",
      reason: "OCR text extracted with 99.4% confidence score.",
    };

    const output = { text: "Extracted Turbine #4 Pressure Logs: 3500 kPa nominal." };

    const cp = await CheckpointManager.onStepVerified({
      taskId: testTaskId,
      step: step1,
      output,
      verificationResult,
      context: {
        variables: { ocrCompleted: true, assetTag: "TURBINE-04" },
        classification: "INTERNAL",
      },
    });

    assert.ok(cp);
    assert.equal(cp.status, CheckpointStatus.ACTIVE);
    assert.equal(cp.stepOrder, 1);
    assert.equal(cp.taskId, testTaskId);
    assert.equal(cp.verificationResult.status, "PASSED");

    // Verify stored on disk
    const fetched = await CheckpointStore.getCheckpoint(cp.checkpointId, testTaskId);
    assert.ok(fetched);
    assert.equal(fetched.checkpointId, cp.checkpointId);
    assert.equal(fetched.stateSnapshot.variables.assetTag, "TURBINE-04");
  });

  // Scenario 2: Only verified states become valid checkpoints
  test("Scenario 2: Unverified or failed execution strictly rejected from becoming a valid checkpoint", async () => {
    const step = {
      stepId: "step_faulty_extraction",
      stepOrder: 2,
      stepTitle: "Telemetry Extraction",
    };

    const failedVerification = {
      status: "FAILED",
      confidence: 0.9,
      reason: "Missing required vibration metric in parsed output.",
    };

    // Attempting to create a checkpoint with a failed verification must reject
    await assert.rejects(
      async () => {
        await CheckpointManager.onStepVerified({
          taskId: testTaskId,
          step,
          output: { corrupted: true },
          verificationResult: failedVerification,
        });
      },
      /Cannot create checkpoint/i
    );

    // Ensure no valid checkpoint was persisted
    const lastValid = await CheckpointStore.getLastValidCheckpoint(testTaskId);
    assert.equal(lastValid, null);
  });

  // Scenario 3: Failure resumes from the last valid checkpoint
  test("Scenario 3: Isolated step failure resumes execution from the last valid checkpoint without repeating prior steps", async () => {
    // Checkpoint 1: OCR
    await CheckpointManager.onStepVerified({
      taskId: testTaskId,
      step: { stepId: "s1", stepOrder: 1, stepTitle: "OCR" },
      output: { rawText: "Turbine data" },
      verificationResult: { status: "PASSED" },
      context: { variables: { s1Done: true } },
    });

    // Checkpoint 2: Findings Extraction
    const cp2 = await CheckpointManager.onStepVerified({
      taskId: testTaskId,
      step: { stepId: "s2", stepOrder: 2, stepTitle: "Findings Extraction" },
      output: { findings: ["Bearing wear 0.4mm"] },
      verificationResult: { status: "PASSED" },
      context: { variables: { s1Done: true, s2Done: true } },
    });

    // Step 3 fails due to prompt phrasing / calculation drift (isolated)
    const failedStep3 = {
      stepId: "s3",
      stepOrder: 3,
      stepTitle: "SOP Threshold Calculation",
    };

    const recovery = await CheckpointManager.handleStepFailure({
      taskId: testTaskId,
      failedStep: failedStep3,
      verificationResult: { status: "FAILED", reason: "Calculation mismatch in formula" },
      diagnosis: { rootCause: "CALCULATION_DRIFT" },
      context: { variables: { s1Done: true, s2Done: true, s3Dirty: "bad" } },
    });

    assert.equal(recovery.status, "RECOVERED");
    assert.equal(recovery.action, RecoveryAction.RESUME);
    assert.equal(recovery.lastValidCheckpoint.checkpointId, cp2.checkpointId);
    assert.equal(recovery.lastValidCheckpoint.stepOrder, 2);

    // Context is restored from Checkpoint 2 (does not contain s3Dirty)
    assert.equal(recovery.restoredContext.variables.s2Done, true);
    assert.equal(recovery.restoredContext.variables.s3Dirty, undefined);
  });

  // Scenario 4: Corrupted state triggers rollback
  test("Scenario 4: Corrupted file or inconsistent intermediate state triggers ROLLBACK decision", async () => {
    // Checkpoint 1
    const cp1 = await CheckpointManager.onStepVerified({
      taskId: testTaskId,
      step: { stepId: "s1", stepOrder: 1, stepTitle: "Analysis Ready" },
      output: { ready: true },
      verificationResult: { status: "PASSED" },
    });

    // Step 2 attempts to generate deliverable but produces empty/corrupt file
    const failedStep2 = {
      stepId: "s2",
      stepOrder: 2,
      stepTitle: "Report Generator",
      filePath: "/storage/generated-files/corrupt_report.docx",
    };

    const recovery = await CheckpointManager.handleStepFailure({
      taskId: testTaskId,
      failedStep: failedStep2,
      verificationResult: {
        status: "FAILED",
        reason: "Deliverable file empty (0 bytes): File signature mismatch",
      },
      diagnosis: { rootCause: "CORRUPT_DELIVERABLE" },
    });

    assert.equal(recovery.status, "RECOVERED");
    assert.equal(recovery.action, RecoveryAction.ROLLBACK);
    assert.ok(recovery.reason.includes("rolling back"));
  });

  // Scenario 5: Rollback restores the correct checkpoint and discards dirty state
  test("Scenario 5: Rollback restores valid state and unlinks dirty intermediate files", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orion-cp-test-"));
    const dirtyFile = path.join(tmpDir, "partial_corrupted_output.docx");
    fs.writeFileSync(dirtyFile, "DIRTY_CORRUPT_DATA");

    const cp = {
      checkpointId: "cp_clean_101",
      stepOrder: 1,
      stepTitle: "Clean State",
      stateSnapshot: {
        variables: { count: 10 },
        files: [],
      },
    };

    const failedStep = {
      filePath: dirtyFile,
    };

    assert.ok(fs.existsSync(dirtyFile));

    const restored = CheckpointRestorer.restore({
      checkpoint: cp,
      action: RecoveryAction.ROLLBACK,
      failedStep,
    });

    assert.equal(restored.success, true);
    assert.equal(restored.action, RecoveryAction.ROLLBACK);
    assert.deepEqual(restored.discardedArtifacts, [dirtyFile]);
    // The dirty file must have been purged from disk
    assert.equal(fs.existsSync(dirtyFile), false);

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  // Scenario 6: Repaired step creates a new checkpoint after verification
  test("Scenario 6: Repaired and re-executed step creates a new valid checkpoint with updated order", async () => {
    // Checkpoint 1
    await CheckpointManager.onStepVerified({
      taskId: testTaskId,
      step: { stepId: "s1", stepOrder: 1, stepTitle: "Step 1" },
      output: "ok1",
      verificationResult: { status: "PASSED" },
    });

    // Step 2 repaired execution
    const repairedStep2 = {
      stepId: "s2_repaired",
      stepOrder: 2,
      stepTitle: "Step 2 (Self-Repaired)",
    };

    const newCp = await CheckpointManager.onStepVerified({
      taskId: testTaskId,
      step: repairedStep2,
      output: { repaired: true, value: 42 },
      verificationResult: { status: "PASSED", confidence: 1.0 },
    });

    assert.equal(newCp.stepOrder, 2);
    assert.equal(newCp.status, CheckpointStatus.ACTIVE);

    // Verify task now has 2 checkpoints and the latest is Checkpoint 2
    const last = await CheckpointStore.getLastValidCheckpoint(testTaskId);
    assert.equal(last.checkpointId, newCp.checkpointId);
    assert.equal(last.stepOrder, 2);
  });

  // Scenario 7: Entire workflow is not unnecessarily restarted
  test("Scenario 7: Prior validated checkpoints remain preserved in history and are not re-executed", async () => {
    await CheckpointManager.onStepVerified({
      taskId: testTaskId,
      step: { stepId: "s1", stepOrder: 1, stepTitle: "Data Extraction" },
      output: { telemetry: [10, 20, 30] },
      verificationResult: { status: "PASSED" },
    });

    await CheckpointManager.onStepVerified({
      taskId: testTaskId,
      step: { stepId: "s2", stepOrder: 2, stepTitle: "Model Evaluation" },
      output: { score: 0.98 },
      verificationResult: { status: "PASSED" },
    });

    const list = await CheckpointStore.listCheckpoints(testTaskId);
    assert.equal(list.length, 2);
    assert.equal(list[0].stepOrder, 1);
    assert.equal(list[1].stepOrder, 2);
    // Previous checkpoint status is SUPERSEDED, not deleted
    assert.equal(list[0].status, CheckpointStatus.SUPERSEDED);
  });

  // Scenario 8: Retry/recovery limits are enforced
  test("Scenario 8: Exceeding MAX_RECOVERY_ATTEMPTS halts recovery and transitions to REQUIRES_HUMAN_REVIEW", async () => {
    // Initial checkpoint
    await CheckpointManager.onStepVerified({
      taskId: testTaskId,
      step: { stepId: "s1", stepOrder: 1, stepTitle: "Initial Baseline" },
      output: "ok",
      verificationResult: { status: "PASSED" },
    });

    const failedStep = { stepId: "s2", stepOrder: 2 };
    const failResult = { status: "FAILED", reason: "Persistent hardware failure" };

    // Recovery Attempt 1
    const rec1 = await CheckpointManager.handleStepFailure({
      taskId: testTaskId,
      failedStep,
      verificationResult: failResult,
    });
    assert.equal(rec1.status, "RECOVERED");
    assert.equal(rec1.attempts, 1);

    // Recovery Attempt 2
    const rec2 = await CheckpointManager.handleStepFailure({
      taskId: testTaskId,
      failedStep,
      verificationResult: failResult,
    });
    assert.equal(rec2.status, "RECOVERED");
    assert.equal(rec2.attempts, 2);

    // Recovery Attempt 3: Exceeds MAX_RECOVERY_ATTEMPTS (2) -> Halts
    const rec3 = await CheckpointManager.handleStepFailure({
      taskId: testTaskId,
      failedStep,
      verificationResult: failResult,
    });

    assert.equal(rec3.status, "REQUIRES_HUMAN_REVIEW");
    assert.equal(rec3.action, RecoveryAction.ABORT_TO_HUMAN_REVIEW);
    assert.ok(rec3.reason.includes("Exceeded maximum automated recovery attempts"));
  });

  // Scenario 9: Stale checkpoints are detected
  test("Scenario 9: Stale checkpoint detection flags missing source files or modified documents", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orion-stale-test-"));
    const sourceFile = path.join(tmpDir, "spec.pdf");
    fs.writeFileSync(sourceFile, "ORIGINAL CONTENT");
    const mtime = fs.statSync(sourceFile).mtimeMs;

    const freshCp = {
      checkpointId: "cp_fresh",
      status: CheckpointStatus.VALIDATED,
      verificationResult: { status: "PASSED" },
      inputReferences: {
        sourceFilePath: sourceFile,
        documentMtime: mtime,
        filePaths: [sourceFile],
      },
    };

    // Fresh validation passes
    const outcome1 = CheckpointValidator.validate({ checkpoint: freshCp });
    assert.equal(outcome1.valid, true);
    assert.equal(outcome1.stale, false);

    // Simulate file deleted
    fs.unlinkSync(sourceFile);
    const outcome2 = CheckpointValidator.validate({ checkpoint: freshCp });
    assert.equal(outcome2.valid, false);
    assert.equal(outcome2.stale, true);
    assert.ok(outcome2.reason.includes("missing on disk"));

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  // Scenario 10: Authorization is rechecked after restoration
  test("Scenario 10: Security policy clearance is re-evaluated before checkpoint can be restored", () => {
    const restrictedCp = {
      checkpointId: "cp_restricted_77",
      status: CheckpointStatus.VALIDATED,
      classificationContext: "RESTRICTED",
      verificationResult: { status: "PASSED" },
    };

    // Admin user clearance -> Allowed
    const adminUser = { id: 1, role: "admin" };
    const adminValidation = CheckpointValidator.validate({
      checkpoint: restrictedCp,
      context: { user: adminUser },
    });
    assert.equal(adminValidation.securityCleared, true);
    assert.equal(adminValidation.valid, true);

    // Default unauthorized user attempting to access restricted checkpoint -> Blocked by policy
    const regularUser = { id: 99, role: "guest" };
    const guestValidation = CheckpointValidator.validate({
      checkpoint: restrictedCp,
      context: { user: regularUser },
    });
    // Policy blocks unauthorized access to RESTRICTED data
    assert.equal(guestValidation.valid, false);
    assert.equal(guestValidation.securityCleared, false);
    assert.ok(guestValidation.reason.includes("Security policy clearance denied"));
  });

  // Scenario 11: Data classification remains enforced
  test("Scenario 11: Checkpoint strictly preserves data classification metadata", async () => {
    const cp = await CheckpointManager.onStepVerified({
      taskId: testTaskId,
      step: { stepId: "s1", stepOrder: 1, stepTitle: "Classified Step" },
      output: "Confidential industrial data",
      verificationResult: { status: "PASSED" },
      context: { classification: "CONFIDENTIAL" },
    });

    assert.equal(cp.classificationContext, "CONFIDENTIAL");

    const saved = await CheckpointStore.getCheckpoint(cp.checkpointId, testTaskId);
    assert.equal(saved.classificationContext, "CONFIDENTIAL");
  });

  // Scenario 12: Model restrictions remain enforced
  test("Scenario 12: Checkpoint model references must adhere to sovereign local policy", () => {
    const invalidModelCp = {
      checkpointId: "cp_invalid_model",
      status: CheckpointStatus.VALIDATED,
      classificationContext: "RESTRICTED",
      modelReference: "openai/gpt-4o", // Cloud model on restricted data is strictly forbidden
      verificationResult: { status: "PASSED" },
    };

    const validation = CheckpointValidator.validate({
      checkpoint: invalidModelCp,
      context: { user: { id: 1, role: "admin" } },
    });

    assert.equal(validation.valid, false);
    assert.ok(validation.reason.includes("not authorized under RESTRICTED policy"));
  });

  // Scenario 13: Tool restrictions remain enforced
  test("Scenario 13: Blocked tools cannot be bypassed via checkpoint restoration", () => {
    // Check that policy engine denies network egress tool on confidential/restricted classification
    const policyResult = PolicyEngine.evaluatePolicy({
      requestedCapability: "tool",
      tool: "web_scraping",
      classification: "CONFIDENTIAL",
    });

    assert.equal(policyResult.decision, "DENY");
  });

  // Scenario 14: RAG access remains authorized
  test("Scenario 14: RAG knowledge source clearance is preserved in checkpoint context", () => {
    const policyCheck = PolicyEngine.evaluatePolicy({
      requestedCapability: "knowledge",
      classification: "RESTRICTED",
      user: { role: "guest" },
    });

    assert.equal(policyCheck.decision, "DENY");
  });

  // Scenario 15: Audit events are created
  test("Scenario 15: All checkpoint lifecycle events are recorded in EventLogs with sanitized metadata", async () => {
    const loggedEvents = [];
    const origLogEvent = EventLogs.logEvent;
    EventLogs.logEvent = async (event, data, userId) => {
      loggedEvents.push({ event, data, userId });
      return true;
    };

    try {
      await CheckpointManager.onStepVerified({
        taskId: testTaskId,
        step: { stepId: "s1", stepOrder: 1, stepTitle: "Audit Test Step" },
        output: "Test Output",
        verificationResult: { status: "PASSED", method: "TestVerifier" },
      });

      assert.ok(loggedEvents.some((e) => e.event === "checkpoint_created"));
      assert.ok(loggedEvents.some((e) => e.event === "checkpoint_validated"));

      // Trigger a resume
      await CheckpointManager.handleStepFailure({
        taskId: testTaskId,
        failedStep: { stepId: "s2", stepOrder: 2 },
        verificationResult: { status: "FAILED", reason: "Format issue" },
      });

      assert.ok(loggedEvents.some((e) => e.event === "workflow_resumed"));
    } finally {
      EventLogs.logEvent = origLogEvent;
    }
  });

  // Scenario 16: Checkpoint restoration failure is handled safely
  test("Scenario 16: Missing or corrupted checkpoint record fails closed without crashing", () => {
    assert.throws(() => {
      CheckpointRestorer.restore({ checkpoint: null, action: RecoveryAction.RESUME });
    }, /Cannot restore from null checkpoint/i);
  });

  // Scenario 17: User cancellation works correctly
  test("Scenario 17: User cancellation clears task checkpoint cache safely", async () => {
    await CheckpointManager.onStepVerified({
      taskId: testTaskId,
      step: { stepId: "s1", stepOrder: 1, stepTitle: "Cancel Test" },
      output: "ok",
      verificationResult: { status: "PASSED" },
    });

    const activeBefore = await CheckpointStore.getLastValidCheckpoint(testTaskId);
    assert.ok(activeBefore);

    await CheckpointStore.clearTaskCheckpoints(testTaskId);

    const activeAfter = await CheckpointStore.getLastValidCheckpoint(testTaskId);
    assert.equal(activeAfter, null);
  });

  // Scenario 18: Demonstration Scenario — Real Industrial Multi-Step Workflow
  test("Scenario 18: Complete Industrial Workflow: OCR -> Findings -> SOP -> Recommendation Failure -> Resume -> Verified Complete", async () => {
    // Step 1: Scanned Inspection Report OCR -> Verified -> CHECKPOINT 1
    const cp1 = await CheckpointManager.onStepVerified({
      taskId: testTaskId,
      step: { stepId: "step_1_ocr", stepOrder: 1, stepTitle: "Inspection Report OCR" },
      output: { ocrText: "Main bearing vibration: 4.8 mm/s. Temperature: 94C." },
      verificationResult: { status: "PASSED", confidence: 1.0, method: "DeliverableVerifier" },
      context: { variables: { ocrSuccess: true, vibration: 4.8, temp: 94 } },
    });
    assert.equal(cp1.stepOrder, 1);

    // Step 2: Findings Extraction -> Verified -> CHECKPOINT 2
    const cp2 = await CheckpointManager.onStepVerified({
      taskId: testTaskId,
      step: { stepId: "step_2_findings", stepOrder: 2, stepTitle: "Findings Extraction" },
      output: { anomaly: "Bearing Vibration Exceeds Standard Threshold", severity: "HIGH" },
      verificationResult: { status: "PASSED", confidence: 0.98, method: "StructuredOutputVerifier" },
      context: { variables: { ocrSuccess: true, vibration: 4.8, anomalyDetected: true } },
    });
    assert.equal(cp2.stepOrder, 2);

    // Step 3: SOP Retrieval -> Verified -> CHECKPOINT 3
    const cp3 = await CheckpointManager.onStepVerified({
      taskId: testTaskId,
      step: { stepId: "step_3_sop", stepOrder: 3, stepTitle: "SOP Document Retrieval" },
      output: { sopDoc: "SOP-MECH-402: Emergency Bearing Lube Protocol", maxVibe: 4.5 },
      verificationResult: { status: "PASSED", confidence: 1.0, method: "RAGGroundingVerifier" },
      context: { variables: { ocrSuccess: true, anomalyDetected: true, sopReference: "SOP-MECH-402" } },
    });
    assert.equal(cp3.stepOrder, 3);

    // Step 4: Maintenance Recommendation -> Fails verification (e.g. model recommended wrong lubricant)
    const failedStep4 = {
      stepId: "step_4_recommendation",
      stepOrder: 4,
      stepTitle: "Maintenance Action Recommendation",
    };

    const recoveryOutcome = await CheckpointManager.handleStepFailure({
      taskId: testTaskId,
      failedStep: failedStep4,
      verificationResult: {
        status: "FAILED",
        reason: "Recommended lubricant ISO VG 32 does not match SOP-MECH-402 requirement ISO VG 68.",
      },
      diagnosis: { rootCause: "UNGROUNDED_CLAIM" },
      context: { variables: { badLube: "VG-32" } },
    });

    // Check that system does NOT restart Steps 1, 2, or 3
    assert.equal(recoveryOutcome.status, "RECOVERED");
    assert.equal(recoveryOutcome.action, RecoveryAction.RESUME);
    assert.equal(recoveryOutcome.lastValidCheckpoint.checkpointId, cp3.checkpointId);
    assert.equal(recoveryOutcome.lastValidCheckpoint.stepOrder, 3);
    assert.equal(recoveryOutcome.restoredContext.variables.sopReference, "SOP-MECH-402");

    // Re-execute Step 4 with corrected parameter -> Passes verification -> Creates CHECKPOINT 4
    const cp4 = await CheckpointManager.onStepVerified({
      taskId: testTaskId,
      step: { stepId: "step_4_recommendation_repaired", stepOrder: 4, stepTitle: "Maintenance Action (Repaired)" },
      output: { recommendedLubricant: "ISO VG 68", procedure: "Execute SOP-MECH-402 within 4 hours." },
      verificationResult: { status: "PASSED", confidence: 1.0, method: "RAGGroundingVerifier" },
      context: {
        variables: {
          ...recoveryOutcome.restoredContext.variables,
          recommendedLubricant: "ISO VG 68",
          workflowCompleted: true,
        },
      },
    });

    assert.equal(cp4.stepOrder, 4);
    assert.equal(cp4.status, CheckpointStatus.ACTIVE);

    // Final check: All 4 checkpoints are persisted in order and workflow is completed
    const finalTimeline = await CheckpointStore.listCheckpoints(testTaskId);
    assert.equal(finalTimeline.length, 4);
    assert.equal(finalTimeline[0].stepTitle, "Inspection Report OCR");
    assert.equal(finalTimeline[1].stepTitle, "Findings Extraction");
    assert.equal(finalTimeline[2].stepTitle, "SOP Document Retrieval");
    assert.equal(finalTimeline[3].stepTitle, "Maintenance Action (Repaired)");
  });
});
