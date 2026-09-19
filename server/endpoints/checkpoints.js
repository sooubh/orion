const { validatedRequest } = require("../utils/middleware/validatedRequest");
const { flexUserRoleValid, ROLES } = require("../utils/middleware/multiUserProtected");
const {
  CheckpointManager,
  CheckpointStore,
  CheckpointValidator,
  CheckpointRestorer,
  RecoveryAction,
} = require("../utils/checkpoints");
const { userFromSession } = require("../utils/http");

function checkpointsEndpoints(app) {
  if (!app) return;

  /**
   * GET /api/checkpoints/task/:taskId
   * List all checkpoints for a task / workflow ordered by stepOrder
   */
  app.get(
    "/checkpoints/task/:taskId",
    [validatedRequest, flexUserRoleValid([ROLES.all])],
    async (request, response) => {
      try {
        const { taskId } = request.params;
        const checkpoints = await CheckpointManager.listCheckpoints(taskId);
        return response.status(200).json({ checkpoints });
      } catch (error) {
        console.error("[checkpointsEndpoints] Error listing checkpoints:", error.message);
        return response.status(500).json({ error: "Failed to list checkpoints." });
      }
    }
  );

  /**
   * GET /api/checkpoints/:checkpointId
   * Retrieve a specific checkpoint record
   */
  app.get(
    "/checkpoints/:checkpointId",
    [validatedRequest, flexUserRoleValid([ROLES.all])],
    async (request, response) => {
      try {
        const { checkpointId } = request.params;
        const checkpoint = await CheckpointManager.getCheckpoint(checkpointId);
        if (!checkpoint) {
          return response.status(404).json({ error: "Checkpoint not found." });
        }
        return response.status(200).json({ checkpoint });
      } catch (error) {
        console.error("[checkpointsEndpoints] Error fetching checkpoint:", error.message);
        return response.status(500).json({ error: "Failed to fetch checkpoint." });
      }
    }
  );

  /**
   * POST /api/checkpoints/:checkpointId/restore
   * Manually restore or roll back to a specific validated checkpoint
   */
  app.post(
    "/checkpoints/:checkpointId/restore",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (request, response) => {
      try {
        const { checkpointId } = request.params;
        const { action = RecoveryAction.RESUME } = request.body || {};
        const user = await userFromSession(request, response);

        const checkpoint = await CheckpointManager.getCheckpoint(checkpointId);
        if (!checkpoint) {
          return response.status(404).json({ error: "Checkpoint not found." });
        }

        // Validate checkpoint freshness and policy authorization
        const validation = CheckpointValidator.validate({
          checkpoint,
          context: { user },
        });

        if (!validation.valid) {
          return response.status(400).json({
            error: `Checkpoint cannot be restored: ${validation.reason}`,
          });
        }

        const restored = CheckpointRestorer.restore({
          checkpoint,
          action,
        });

        return response.status(200).json({
          success: true,
          restored,
        });
      } catch (error) {
        console.error("[checkpointsEndpoints] Error restoring checkpoint:", error.message);
        return response.status(500).json({ error: error.message });
      }
    }
  );

  /**
   * POST /api/checkpoints/:checkpointId/invalidate
   * Explicitly invalidate a checkpoint (e.g. if dependency changed or security revoked)
   */
  app.post(
    "/checkpoints/:checkpointId/invalidate",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (request, response) => {
      try {
        const { checkpointId } = request.params;
        const { reason = "Operator invalidated checkpoint" } = request.body || {};

        const updated = await CheckpointStore.invalidateCheckpoint(checkpointId, reason);
        if (!updated) {
          return response.status(404).json({ error: "Checkpoint not found." });
        }

        return response.status(200).json({
          success: true,
          checkpoint: updated,
        });
      } catch (error) {
        console.error("[checkpointsEndpoints] Error invalidating checkpoint:", error.message);
        return response.status(500).json({ error: error.message });
      }
    }
  );
}

module.exports = { checkpointsEndpoints };
