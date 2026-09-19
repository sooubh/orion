const {
  RecoveryAction,
  StateCorruptionLevel,
  MAX_RECOVERY_ATTEMPTS,
} = require("./types");

class RecoveryDecisionEngine {
  /**
   * Deterministically decide whether to RESUME, ROLLBACK, or ABORT_TO_HUMAN_REVIEW.
   * @param {Object} params
   * @param {Object} params.checkpoint - The candidate valid checkpoint
   * @param {Object} params.failedStep - The step that failed
   * @param {Object} params.verificationResult - The verification result of the failure
   * @param {Object} params.diagnosis - The diagnosis result from DiagnosisEngine
   * @param {number} [params.attemptNumber=1] - Current recovery attempt count
   * @param {Object} [params.validationOutcome] - Output from CheckpointValidator.validate
   * @returns {Object} Decision { action: RecoveryAction, reason: string, corruptionLevel: StateCorruptionLevel }
   */
  static decide({
    checkpoint,
    failedStep,
    verificationResult,
    diagnosis,
    attemptNumber = 1,
    validationOutcome = { valid: true },
  }) {
    // 1. Boundary check: Max attempts exceeded
    if (attemptNumber > MAX_RECOVERY_ATTEMPTS) {
      return {
        action: RecoveryAction.ABORT_TO_HUMAN_REVIEW,
        reason: `Exceeded maximum automated recovery attempts (${MAX_RECOVERY_ATTEMPTS}). Halting fail-closed for human operator review.`,
        corruptionLevel: StateCorruptionLevel.SUSPECTED,
      };
    }

    // 2. Checkpoint validation check: If checkpoint is invalid or stale
    if (!validationOutcome.valid) {
      return {
        action: RecoveryAction.ABORT_TO_HUMAN_REVIEW,
        reason: `Last checkpoint is not valid for recovery: ${validationOutcome.reason}`,
        corruptionLevel: StateCorruptionLevel.SUSPECTED,
      };
    }

    if (!checkpoint) {
      return {
        action: RecoveryAction.ABORT_TO_HUMAN_REVIEW,
        reason: "No valid checkpoint found to recover from.",
        corruptionLevel: StateCorruptionLevel.SUSPECTED,
      };
    }

    // 3. Check for state corruption or partial file write
    const failureReason = (verificationResult?.reason || "").toLowerCase();
    const rootCause = (diagnosis?.rootCause || "").toUpperCase();

    // Deliverable corruption or partial file writes require ROLLBACK to clean dirty files
    const isFileCorrupted =
      failureReason.includes("file signature mismatch") ||
      failureReason.includes("empty (0 bytes)") ||
      failureReason.includes("corrupt") ||
      rootCause === "CORRUPT_DELIVERABLE";

    // Broken tool side-effects or partial state mutations require ROLLBACK
    const isStateCorrupted =
      failedStep?.stateCorrupted === true ||
      failureReason.includes("inconsistent state") ||
      failureReason.includes("partial write");

    if (isFileCorrupted || isStateCorrupted) {
      return {
        action: RecoveryAction.ROLLBACK,
        reason: isFileCorrupted
          ? "Deliverable or file corrupted during step execution; rolling back to clean state from last valid checkpoint."
          : "Intermediate state is inconsistent or partially mutated; rolling back to last valid checkpoint.",
        corruptionLevel: StateCorruptionLevel.CORRUPTED,
      };
    }

    // 4. Isolated reasoning, calculation, schema, or parameter failures -> RESUME
    return {
      action: RecoveryAction.RESUME,
      reason: `Prior checkpoint state [Step ${checkpoint.stepOrder}: ${checkpoint.stepTitle || checkpoint.stepId}] is clean and intact; resuming step execution with targeted self-repair.`,
      corruptionLevel: StateCorruptionLevel.NONE,
    };
  }
}

module.exports = { RecoveryDecisionEngine };
