const { v4: uuidv4 } = require("uuid");
const {
  CheckpointStatus,
  RecoveryAction,
  MAX_RECOVERY_ATTEMPTS,
} = require("./types");
const { CheckpointStore } = require("./store");
const { CheckpointValidator } = require("./validator");
const { CheckpointRestorer } = require("./restoration");
const { RecoveryDecisionEngine } = require("./recoveryDecision");
const { EventLogs } = require("../../models/eventLogs");

class CheckpointManager {
  static recoveryAttempts = new Map(); // taskId -> count

  /**
   * Reset runtime tracking (for tests and session restarts)
   */
  static reset() {
    this.recoveryAttempts.clear();
    CheckpointStore.reset();
  }

  /**
   * Record a valid checkpoint after step execution and verification have passed.
   * INVARIANT: Only steps with status 'PASSED' can produce a VALIDATED checkpoint.
   * @param {Object} params
   * @param {string} params.taskId - Unique identifier for task/workflow
   * @param {string} [params.workflowId] - Optional workflow ID
   * @param {Object} params.step - Step definition { stepId, stepOrder, stepTitle, type, input, ... }
   * @param {any} params.output - Verified output
   * @param {Object} params.verificationResult - Result from VerificationManager ({ status: 'PASSED', ... })
   * @param {Object} [params.context] - Session context { user, workspace, variables, files, classification, model }
   * @param {Object} [params.socket] - Optional WebSocket for live frontend streaming
   * @returns {Promise<Object>} Created CheckpointRecord
   */
  static async onStepVerified({
    taskId,
    workflowId = null,
    step,
    output,
    verificationResult,
    context = {},
    socket = null,
  }) {
    if (!taskId) taskId = `task_${Date.now()}`;

    // Fail-closed invariant: Do not create a valid checkpoint unless verification PASSED
    if (!verificationResult || verificationResult.status !== "PASSED") {
      throw new Error(
        `Cannot create checkpoint for step ${step?.stepId}: verification status is "${verificationResult?.status || "missing"}" (must be "PASSED").`
      );
    }

    const stepOrder = Number(step?.stepOrder ?? 1);
    const checkpointId = `cp_${taskId}_s${stepOrder}_${uuidv4().slice(0, 8)}`;

    // Mark any previous active checkpoint for this task as SUPERSEDED
    const prevValid = await CheckpointStore.getLastValidCheckpoint(taskId);
    if (prevValid) {
      await CheckpointStore.updateCheckpointStatus(
        prevValid.checkpointId,
        CheckpointStatus.SUPERSEDED
      );
    }

    const record = {
      checkpointId,
      taskId,
      workflowId,
      stepId: step?.stepId || `step_${stepOrder}`,
      stepOrder,
      stepTitle: step?.stepTitle || step?.toolName || `Step ${stepOrder}`,
      status: CheckpointStatus.ACTIVE,
      inputReferences: {
        toolName: step?.toolName || null,
        args: step?.input || null,
        sourceFilePath: step?.filePath || null,
      },
      outputReferences: {
        output: typeof output === "object" ? output : { result: output },
        filePath: step?.filePath || (output?.filePath ? output.filePath : null),
      },
      stateSnapshot: {
        variables: { ...(context.variables || {}) },
        files: Array.isArray(context.files) ? [...context.files] : [],
        messages: Array.isArray(context.messages) ? [...context.messages] : [],
      },
      verificationResult: {
        status: verificationResult.status,
        confidence: verificationResult.confidence,
        method: verificationResult.method,
        reason: verificationResult.reason,
      },
      verificationMethod: verificationResult.method || "IndependentVerifier",
      modelReference: context.model || null,
      toolReferences: step?.toolName ? [step.toolName] : [],
      workspaceContext: context.workspace?.slug || context.workspace?.id || null,
      classificationContext: context.classification || "INTERNAL",
      policyContext: {
        rule: "SOVEREIGN_CHECKPOINT_V1",
      },
      stateVersion: 1,
      createdAt: new Date().toISOString(),
    };

    const saved = await CheckpointStore.saveCheckpoint(record);

    // Audit logging (sanitized metadata)
    try {
      await EventLogs.logEvent(
        "checkpoint_created",
        {
          taskId,
          checkpointId,
          stepOrder,
          stepTitle: record.stepTitle,
          classification: record.classificationContext,
        },
        context.user?.id ? Number(context.user.id) : null
      );
      await EventLogs.logEvent(
        "checkpoint_validated",
        {
          taskId,
          checkpointId,
          stepOrder,
          verificationMethod: record.verificationMethod,
        },
        context.user?.id ? Number(context.user.id) : null
      );
    } catch (e) {
      console.warn("[CheckpointManager] Audit log failed:", e.message);
    }

    // Emit live WebSocket notification to frontend
    this.emitSocketEvent(socket, "checkpoint_created", {
      taskId,
      checkpointId,
      stepOrder,
      stepTitle: record.stepTitle,
      status: CheckpointStatus.ACTIVE,
      timestamp: record.createdAt,
    });

    return saved;
  }

  /**
   * Handle step failure by identifying the last valid checkpoint and determining RESUME vs ROLLBACK.
   * @param {Object} params
   * @param {string} params.taskId - Task/workflow ID
   * @param {Object} params.failedStep - The failed step definition
   * @param {Object} params.verificationResult - Verification failure result
   * @param {Object} [params.diagnosis] - Output of DiagnosisEngine
   * @param {Object} [params.context] - Session context
   * @param {Object} [params.socket] - WebSocket connection
   * @returns {Promise<Object>} Recovery resolution { action, restoredContext, status, reason }
   */
  static async handleStepFailure({
    taskId,
    failedStep,
    verificationResult,
    diagnosis = {},
    context = {},
    socket = null,
  }) {
    if (!taskId) taskId = "default";
    const currentAttempts = (this.recoveryAttempts.get(taskId) || 0) + 1;
    this.recoveryAttempts.set(taskId, currentAttempts);

    // 1. Identify last valid checkpoint
    const lastValidCheckpoint = await CheckpointStore.getLastValidCheckpoint(taskId);

    // 2. Validate the checkpoint freshness and policy authorization
    const validationOutcome = lastValidCheckpoint
      ? CheckpointValidator.validate({ checkpoint: lastValidCheckpoint, context })
      : { valid: false, reason: "No valid checkpoints recorded for task" };

    // 3. Make deterministic decision: RESUME, ROLLBACK, or ABORT_TO_HUMAN_REVIEW
    const decision = RecoveryDecisionEngine.decide({
      checkpoint: lastValidCheckpoint,
      failedStep,
      verificationResult,
      diagnosis,
      attemptNumber: currentAttempts,
      validationOutcome,
    });

    // Handle Human Review escalation (bounded limit exceeded or stale checkpoint)
    if (decision.action === RecoveryAction.ABORT_TO_HUMAN_REVIEW) {
      try {
        await EventLogs.logEvent(
          "recovery_failed",
          {
            taskId,
            attempts: currentAttempts,
            reason: decision.reason,
          },
          context.user?.id ? Number(context.user.id) : null
        );
        await EventLogs.logEvent(
          "human_review_requested",
          {
            taskId,
            stepId: failedStep?.stepId,
            reason: decision.reason,
          },
          context.user?.id ? Number(context.user.id) : null
        );
      } catch (e) {
        console.warn("[CheckpointManager] Audit log failed:", e.message);
      }

      this.emitSocketEvent(socket, "checkpoint_recovery_exhausted", {
        taskId,
        failedStepId: failedStep?.stepId,
        attempts: currentAttempts,
        reason: decision.reason,
      });

      return {
        status: "REQUIRES_HUMAN_REVIEW",
        action: decision.action,
        attempts: currentAttempts,
        reason: decision.reason,
        lastValidCheckpoint,
      };
    }

    // 4. Restore state from checkpoint (cleaning up dirty files if rolling back)
    const restoredContext = CheckpointRestorer.restore({
      checkpoint: lastValidCheckpoint,
      action: decision.action,
      failedStep,
    });

    // 5. Log audit event
    try {
      const eventName =
        decision.action === RecoveryAction.ROLLBACK
          ? "workflow_rolled_back"
          : "workflow_resumed";

      await EventLogs.logEvent(
        eventName,
        {
          taskId,
          checkpointId: lastValidCheckpoint.checkpointId,
          restoredStepOrder: lastValidCheckpoint.stepOrder,
          action: decision.action,
          attempt: currentAttempts,
          reason: decision.reason,
        },
        context.user?.id ? Number(context.user.id) : null
      );
    } catch (e) {
      console.warn("[CheckpointManager] Audit log failed:", e.message);
    }

    // 6. Notify frontend
    this.emitSocketEvent(socket, "checkpoint_recovery_applied", {
      taskId,
      checkpointId: lastValidCheckpoint.checkpointId,
      stepOrder: lastValidCheckpoint.stepOrder,
      stepTitle: lastValidCheckpoint.stepTitle,
      action: decision.action,
      attempts: currentAttempts,
      reason: decision.reason,
    });

    return {
      status: "RECOVERED",
      action: decision.action,
      canRetry: true,
      attempts: currentAttempts,
      maxAttempts: MAX_RECOVERY_ATTEMPTS,
      lastValidCheckpoint,
      restoredContext,
      reason: decision.reason,
    };
  }

  /**
   * Helper to emit WebSocket notification safely
   */
  static emitSocketEvent(socket, eventType, data) {
    if (!socket) return;
    try {
      if (typeof socket.send === "function") {
        socket.send(
          JSON.stringify({
            type: "checkpointEvent",
            event: eventType,
            data,
            timestamp: new Date().toISOString(),
          })
        );
      }
    } catch (e) {
      console.warn("[CheckpointManager] Failed to emit socket event:", e.message);
    }
  }

  /**
   * List checkpoints for task
   */
  static async listCheckpoints(taskId) {
    return await CheckpointStore.listCheckpoints(taskId);
  }

  /**
   * Get single checkpoint
   */
  static async getCheckpoint(checkpointId) {
    return await CheckpointStore.getCheckpoint(checkpointId);
  }
}

module.exports = { CheckpointManager };
