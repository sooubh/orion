const fs = require("fs");
const path = require("path");
const { RecoveryAction } = require("./types");

class CheckpointRestorer {
  /**
   * Restore workflow execution context from a validated checkpoint.
   * Cleans up dirty files / partial outputs if rolling back.
   * @param {Object} params
   * @param {Object} params.checkpoint - The checkpoint record to restore from
   * @param {string} params.action - RecoveryAction ('RESUME' | 'ROLLBACK')
   * @param {Object} [params.failedStep] - The step that failed
   * @returns {Object} RestoredContext { success: boolean, variables: Object, files: Array, messageLineage: Array, ... }
   */
  static restore({ checkpoint, action, failedStep = null }) {
    if (!checkpoint) {
      throw new Error("Cannot restore from null checkpoint.");
    }

    const state = checkpoint.stateSnapshot || {};
    const restoredVariables = { ...(state.variables || {}) };
    const restoredFiles = Array.isArray(state.files) ? [...state.files] : [];
    const restoredMessages = Array.isArray(state.messages) ? [...state.messages] : [];

    const discardedArtifacts = [];

    // If rolling back: Purge any partial/corrupted files created by the failed step
    if (action === RecoveryAction.ROLLBACK && failedStep) {
      const dirtyFiles = [];
      if (failedStep.filePath) dirtyFiles.push(failedStep.filePath);
      if (failedStep.outputReferences?.filePath) dirtyFiles.push(failedStep.outputReferences.filePath);
      if (Array.isArray(failedStep.createdFiles)) dirtyFiles.push(...failedStep.createdFiles);

      for (const df of dirtyFiles) {
        // Ensure we do not delete files that belonged to the validated checkpoint
        const wasInCheckpoint = restoredFiles.some(
          (rf) => (typeof rf === "string" ? rf : rf.filePath) === df
        );

        if (!wasInCheckpoint && typeof df === "string" && fs.existsSync(df)) {
          try {
            fs.unlinkSync(df);
            discardedArtifacts.push(df);
          } catch (err) {
            console.warn(`[CheckpointRestorer] Failed cleaning up dirty file ${df}:`, err.message);
          }
        }
      }
    }

    return {
      success: true,
      checkpointId: checkpoint.checkpointId,
      stepId: checkpoint.stepId,
      stepOrder: checkpoint.stepOrder,
      stepTitle: checkpoint.stepTitle,
      action,
      variables: restoredVariables,
      files: restoredFiles,
      messages: restoredMessages,
      outputReferences: checkpoint.outputReferences || {},
      discardedArtifacts,
      restoredAt: new Date().toISOString(),
    };
  }
}

module.exports = { CheckpointRestorer };
