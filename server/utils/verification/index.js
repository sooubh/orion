const {
  VerificationStatus,
  RepairStrategy,
  StepType,
  RootCauseCategory,
  MAX_REPAIR_ATTEMPTS,
} = require("./types");
const { StructuredOutputVerifier } = require("./verifiers/structured");
const { CalculationVerifier } = require("./verifiers/calculation");
const { RAGGroundingVerifier } = require("./verifiers/grounding");
const { DeliverableVerifier } = require("./verifiers/deliverable");
const { DiagnosisEngine } = require("./diagnosis");
const { RepairEngine } = require("./repair");
const { EventLogs } = require("../../models/eventLogs");

class VerificationManager {
  static attempts = new Map();
  static history = new Map();
  static humanReviewQueue = new Map();

  /**
   * Reset tracking state (useful for tests and new sessions)
   */
  static reset() {
    this.attempts.clear();
    this.history.clear();
    this.humanReviewQueue.clear();
  }

  /**
   * Verify an execution step using independent deterministic verifiers.
   * @param {Object} params
   * @param {Object} params.step - Step definition { stepId, type, input, expectedResult, schema, expression, filePath, ... }
   * @param {any} params.output - The actual result or deliverable produced
   * @param {Object} [params.context] - Session context (user, workspace, classification)
   * @param {Object} [params.socket] - WebSocket connection for live UI notifications
   * @returns {Promise<Object>} VerificationResult
   */
  static async verifyStep({ step, output, context = {}, socket = null }) {
    const stepId = step?.stepId || `step_${Date.now()}`;
    if (step && !step.stepId) step.stepId = stepId;
    const stepType = step?.type || StepType.TEXT_RESPONSE;

    // Notify UI that verification has begun
    this.emitSocketEvent(socket, "step_verification_start", {
      stepId,
      stepType,
      method: "IndependentVerifier",
    });

    let result;

    switch (stepType) {
      case StepType.CALCULATION: {
        result = CalculationVerifier.verify({
          claimedValue: output?.claimedValue ?? output,
          expression: step.expression,
          expectedValue: step.expectedResult,
          sumOf: step.sumOf,
          epsilon: step.epsilon,
        });
        break;
      }

      case StepType.STRUCTURED_OUTPUT: {
        result = StructuredOutputVerifier.verify({
          output,
          schema: step.schema,
        });
        break;
      }

      case StepType.DELIVERABLE: {
        const filePath = step.filePath || (typeof output === "string" ? output : output?.filePath);
        result = DeliverableVerifier.verify({
          filePath,
          requiredSections: step.requiredSections,
          minSizeBytes: step.minSizeBytes,
        });
        break;
      }

      case StepType.RAG_GROUNDING: {
        const generatedText = typeof output === "string" ? output : output?.text;
        result = RAGGroundingVerifier.verify({
          generatedText,
          sources: step.sources || [],
          citedSources: step.citedSources || [],
        });
        break;
      }

      case StepType.TOOL_CALL:
      default: {
        // General tool output verification
        if (output === null || output === undefined) {
          result = {
            status: VerificationStatus.FAILED,
            confidence: 1.0,
            reason: "Tool produced empty/null result.",
            evidence: { output: null },
            method: "DefaultToolVerifier",
          };
        } else if (
          typeof output === "object" &&
          (output.error || output.failed || output.success === false)
        ) {
          result = {
            status: VerificationStatus.FAILED,
            confidence: 0.98,
            reason: output.error || "Tool returned failure status.",
            evidence: output,
            method: "DefaultToolVerifier",
          };
        } else {
          result = {
            status: VerificationStatus.PASSED,
            confidence: 1.0,
            reason: "Tool executed successfully and output verified.",
            evidence: { hasOutput: true },
            method: "DefaultToolVerifier",
          };
        }
        break;
      }
    }

    // Fail-closed enforcement: if status is anything other than PASSED, treat as FAILED
    const passed = result.status === VerificationStatus.PASSED;

    // Log audit event (sanitized, zero sensitive payload leakage)
    try {
      await EventLogs.logEvent(
        passed ? "verification_passed" : "verification_failed",
        {
          stepId,
          stepType,
          method: result.method,
          confidence: result.confidence,
          passed,
          reason: result.reason ? String(result.reason).slice(0, 200) : "n/a",
        },
        context.user?.id ? Number(context.user.id) : null
      );
    } catch (e) {
      console.warn("[VerificationManager] Audit log failed:", e.message);
    }

    // Emit live WebSocket update
    this.emitSocketEvent(
      socket,
      passed ? "step_verification_passed" : "step_verification_failed",
      {
        stepId,
        stepType,
        status: result.status,
        reason: result.reason,
        method: result.method,
      }
    );

    return result;
  }

  /**
   * Diagnose a failed step, apply bounded retry logic, and formulate a repair action.
   * If MAX_REPAIR_ATTEMPTS is exceeded, halts and transitions to REQUIRES_HUMAN_REVIEW.
   * @param {Object} params
   * @param {Object} params.step - Step definition
   * @param {Object} params.verificationResult - Result from verifyStep
   * @param {Object} [params.context] - Session context
   * @param {Object} [params.socket] - WebSocket connection
   * @returns {Promise<Object>} Diagnosis and Repair result or Human Review state
   */
  static async diagnoseAndRepair({
    step,
    verificationResult,
    context = {},
    socket = null,
  }) {
    const stepId = step?.stepId || `step_${Date.now()}`;
    if (step && !step.stepId) step.stepId = stepId;
    const currentAttempts = (this.attempts.get(stepId) || 0) + 1;
    this.attempts.set(stepId, currentAttempts);

    // Record trajectory
    const trajectory = this.history.get(stepId) || [];

    // Bounded retries check
    if (currentAttempts > MAX_REPAIR_ATTEMPTS) {
      // Retries exhausted -> halt and transition to REQUIRES_HUMAN_REVIEW
      const humanReviewRecord = {
        stepId,
        step,
        verificationResult,
        attemptsCount: currentAttempts,
        trajectory,
        status: VerificationStatus.REQUIRES_HUMAN_REVIEW,
        reason: `Exceeded maximum automated repair attempts (${MAX_REPAIR_ATTEMPTS}). Human review required.`,
        createdAt: new Date().toISOString(),
        resolved: false,
        resolution: null,
      };

      this.humanReviewQueue.set(stepId, humanReviewRecord);

      try {
        await EventLogs.logEvent(
          "verification_exhausted_human_review",
          {
            stepId,
            stepType: step?.type,
            attempts: currentAttempts,
            reason: humanReviewRecord.reason,
          },
          context.user?.id ? Number(context.user.id) : null
        );
      } catch (e) {
        console.warn("[VerificationManager] Audit log failed:", e.message);
      }

      this.emitSocketEvent(socket, "step_requires_human_review", {
        stepId,
        stepType: step?.type,
        status: VerificationStatus.REQUIRES_HUMAN_REVIEW,
        attempts: currentAttempts,
        reason: humanReviewRecord.reason,
      });

      return {
        status: VerificationStatus.REQUIRES_HUMAN_REVIEW,
        canRetry: false,
        attempts: currentAttempts,
        reason: humanReviewRecord.reason,
        humanReviewRecord,
      };
    }

    // Under bounds: diagnose root cause
    const diagnosis = DiagnosisEngine.diagnose({
      step,
      verificationResult,
      attemptNumber: currentAttempts,
    });

    // Formulate targeted repair
    const repair = RepairEngine.formulateRepair({
      step,
      diagnosis,
      context,
    });

    trajectory.push({
      attempt: currentAttempts,
      verificationResult,
      diagnosis,
      repair,
      timestamp: new Date().toISOString(),
    });
    this.history.set(stepId, trajectory);

    try {
      await EventLogs.logEvent(
        "step_repaired",
        {
          stepId,
          stepType: step?.type,
          attempt: currentAttempts,
          rootCause: diagnosis.rootCause,
          repairStrategy: repair.strategy,
        },
        context.user?.id ? Number(context.user.id) : null
      );
    } catch (e) {
      console.warn("[VerificationManager] Audit log failed:", e.message);
    }

    this.emitSocketEvent(socket, "step_repair_start", {
      stepId,
      stepType: step?.type,
      attempt: currentAttempts,
      maxAttempts: MAX_REPAIR_ATTEMPTS,
      rootCause: diagnosis.rootCause,
      repairStrategy: repair.strategy,
      summary: diagnosis.diagnosisSummary,
    });

    return {
      status: VerificationStatus.FAILED,
      canRetry: true,
      attempts: currentAttempts,
      maxAttempts: MAX_REPAIR_ATTEMPTS,
      diagnosis,
      repair,
    };
  }

  /**
   * Resolve a human review item by an authorized operator.
   * @param {string} stepId
   * @param {Object} params
   * @param {string} params.action - 'APPROVED_OVERRIDE' | 'APPLY_CORRECTION' | 'REJECTED'
   * @param {any} [params.correctedValue] - Operator provided correction
   * @param {string} [params.notes] - Operator justification notes
   * @param {Object} [params.reviewerUser] - User performing the review
   * @returns {Promise<Object>}
   */
  static async resolveHumanReview(stepId, { action, correctedValue, notes = "", reviewerUser = null }) {
    const item = this.humanReviewQueue.get(stepId);
    if (!item) {
      throw new Error(`Human review item not found for step ${stepId}`);
    }

    item.resolved = true;
    item.resolvedAt = new Date().toISOString();
    item.resolution = {
      action,
      correctedValue,
      notes,
      reviewedBy: reviewerUser?.username || "administrator",
    };

    try {
      await EventLogs.logEvent(
        "human_review_resolved",
        {
          stepId,
          action,
          hasCorrection: correctedValue !== undefined,
          reviewedBy: reviewerUser?.username || "administrator",
        },
        reviewerUser?.id ? Number(reviewerUser.id) : null
      );
    } catch (e) {
      console.warn("[VerificationManager] Audit log failed:", e.message);
    }

    return item;
  }

  /**
   * Helper to emit socket message safely.
   */
  static emitSocketEvent(socket, type, data) {
    if (!socket) return;
    try {
      if (typeof socket.send === "function") {
        socket.send(
          JSON.stringify({
            type: "verificationEvent",
            event: type,
            data,
            timestamp: new Date().toISOString(),
          })
        );
      }
    } catch (e) {
      console.warn("[VerificationManager] Failed to emit socket event:", e.message);
    }
  }

  /**
   * Get queue of human review items.
   */
  static getHumanReviewQueue() {
    return Array.from(this.humanReviewQueue.values());
  }

  /**
   * Get verification trajectory for a step.
   */
  static getStepTrajectory(stepId) {
    return {
      stepId,
      attempts: this.attempts.get(stepId) || 0,
      trajectory: this.history.get(stepId) || [],
      humanReview: this.humanReviewQueue.get(stepId) || null,
    };
  }
}

module.exports = {
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
};
