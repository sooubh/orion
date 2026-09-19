const fs = require("fs");
const { CheckpointStatus } = require("./types");
const { PolicyEngine } = require("../policy");

class CheckpointValidator {
  /**
   * Validate a checkpoint for restoration and continuation.
   * Ensures the checkpoint is verified, fresh (not stale), and permitted by current security policy.
   * @param {Object} params
   * @param {Object} params.checkpoint - The checkpoint record to validate
   * @param {Object} [params.context] - Current execution context { user, workspace, activeClassification }
   * @returns {Object} Validation outcome { valid: boolean, stale: boolean, securityCleared: boolean, reason: string }
   */
  static validate({ checkpoint, context = {} }) {
    if (!checkpoint) {
      return {
        valid: false,
        stale: false,
        securityCleared: false,
        reason: "Checkpoint record is null or undefined.",
      };
    }

    // 1. Status check: Only VALIDATED or ACTIVE checkpoints are eligible
    if (checkpoint.status === CheckpointStatus.INVALIDATED) {
      return {
        valid: false,
        stale: true,
        securityCleared: false,
        reason: `Checkpoint ${checkpoint.checkpointId} is explicitly invalidated: ${checkpoint.statusReason || "no reason specified"}`,
      };
    }

    if (
      checkpoint.status !== CheckpointStatus.VALIDATED &&
      checkpoint.status !== CheckpointStatus.ACTIVE
    ) {
      return {
        valid: false,
        stale: false,
        securityCleared: false,
        reason: `Checkpoint ${checkpoint.checkpointId} has invalid lifecycle status "${checkpoint.status}". Only VALIDATED or ACTIVE checkpoints can be restored.`,
      };
    }

    // 2. Verification evidence check: Must have a recorded PASSED verification result
    const verResult = checkpoint.verificationResult;
    if (!verResult || verResult.status !== "PASSED") {
      return {
        valid: false,
        stale: false,
        securityCleared: false,
        reason: `Checkpoint ${checkpoint.checkpointId} lacks verified evidence (verification status: ${verResult?.status || "missing"}).`,
      };
    }

    // 3. Stale dependency check: Verify underlying files / inputs still exist
    const inputRefs = checkpoint.inputReferences || {};
    if (inputRefs.filePaths && Array.isArray(inputRefs.filePaths)) {
      for (const fp of inputRefs.filePaths) {
        if (typeof fp === "string" && !fs.existsSync(fp)) {
          return {
            valid: false,
            stale: true,
            securityCleared: false,
            reason: `Checkpoint dependency is missing on disk: ${fp}. Checkpoint is stale.`,
          };
        }
      }
    }

    if (inputRefs.documentMtime && inputRefs.sourceFilePath) {
      if (fs.existsSync(inputRefs.sourceFilePath)) {
        const currentMtime = fs.statSync(inputRefs.sourceFilePath).mtimeMs;
        if (Math.abs(currentMtime - inputRefs.documentMtime) > 1000) {
          return {
            valid: false,
            stale: true,
            securityCleared: false,
            reason: `Source document ${inputRefs.sourceFilePath} has changed since checkpoint creation. Checkpoint is stale.`,
          };
        }
      }
    }

    // 4. Security & Policy re-check: Revalidate user and workspace clearance
    const classification =
      checkpoint.classificationContext || context.activeClassification || "INTERNAL";
    const user = context.user || null;
    const workspace = context.workspace || null;

    const policyCheck = PolicyEngine.evaluatePolicy({
      requestedCapability: "action",
      action: "checkpoint_restore",
      classification,
      user,
      workspace,
    });

    if (policyCheck.decision !== "ALLOW") {
      return {
        valid: false,
        stale: false,
        securityCleared: false,
        reason: `Security policy clearance denied for checkpoint ${checkpoint.checkpointId} (${classification} data): ${policyCheck.reason}`,
      };
    }

    // 5. Model restriction check: Verify referenced model is still permitted under current policy
    if (checkpoint.modelReference) {
      const modelAllowed = PolicyEngine.isModelPermitted(
        checkpoint.modelReference,
        classification
      );
      if (!modelAllowed) {
        return {
          valid: false,
          stale: false,
          securityCleared: false,
          reason: `Model ${checkpoint.modelReference} stored in checkpoint is not authorized under ${classification} policy.`,
        };
      }
    }

    return {
      valid: true,
      stale: false,
      securityCleared: true,
      reason: `Checkpoint ${checkpoint.checkpointId} is verified, fresh, and authorized under ${classification} policy.`,
    };
  }
}

module.exports = { CheckpointValidator };
