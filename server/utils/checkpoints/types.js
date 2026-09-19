/**
 * Checkpoint Types, Enums and Constants
 * Sovereign Industrial AI Workbench (SIH PS 26117)
 */

const CheckpointStatus = Object.freeze({
  PENDING: "PENDING",
  CREATED: "CREATED",
  VALIDATED: "VALIDATED",
  ACTIVE: "ACTIVE",
  SUPERSEDED: "SUPERSEDED",
  INVALIDATED: "INVALIDATED",
});

const RecoveryAction = Object.freeze({
  RESUME: "RESUME",
  ROLLBACK: "ROLLBACK",
  ABORT_TO_HUMAN_REVIEW: "ABORT_TO_HUMAN_REVIEW",
});

const StateCorruptionLevel = Object.freeze({
  NONE: "NONE",
  SUSPECTED: "SUSPECTED",
  CORRUPTED: "CORRUPTED",
});

const MAX_RECOVERY_ATTEMPTS = 2;

module.exports = {
  CheckpointStatus,
  RecoveryAction,
  StateCorruptionLevel,
  MAX_RECOVERY_ATTEMPTS,
};
