const { validatedRequest } = require("../utils/middleware/validatedRequest");
const { flexUserRoleValid, ROLES } = require("../utils/middleware/multiUserProtected");
const { VerificationManager } = require("../utils/verification");
const { userFromSession } = require("../utils/http");

function verificationEndpoints(app) {
  if (!app) return;

  /**
   * GET /api/verification/queue
   * List all steps currently awaiting or completed human review
   */
  app.get(
    "/verification/queue",
    [validatedRequest, flexUserRoleValid([ROLES.all])],
    async (request, response) => {
      try {
        const queue = VerificationManager.getHumanReviewQueue();
        return response.status(200).json({ queue });
      } catch (error) {
        console.error("[verificationEndpoints] Error fetching queue:", error.message);
        return response.status(500).json({ error: "Failed to fetch verification queue." });
      }
    }
  );

  /**
   * GET /api/verification/step/:stepId
   * Get trajectory, attempts, and verification state for a specific step
   */
  app.get(
    "/verification/step/:stepId",
    [validatedRequest, flexUserRoleValid([ROLES.all])],
    async (request, response) => {
      try {
        const { stepId } = request.params;
        const trajectory = VerificationManager.getStepTrajectory(stepId);
        return response.status(200).json(trajectory);
      } catch (error) {
        console.error("[verificationEndpoints] Error fetching step:", error.message);
        return response.status(500).json({ error: "Failed to fetch step trajectory." });
      }
    }
  );

  /**
   * POST /api/verification/step/:stepId/resolve
   * Human operator resolves a step that reached REQUIRES_HUMAN_REVIEW
   */
  app.post(
    "/verification/step/:stepId/resolve",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (request, response) => {
      try {
        const { stepId } = request.params;
        const { action, correctedValue, notes } = request.body || {};

        if (!action || !["APPROVED_OVERRIDE", "APPLY_CORRECTION", "REJECTED"].includes(action)) {
          return response.status(400).json({
            error: "Valid action required: APPROVED_OVERRIDE, APPLY_CORRECTION, or REJECTED",
          });
        }

        const reviewerUser = await userFromSession(request, response);
        const resolved = await VerificationManager.resolveHumanReview(stepId, {
          action,
          correctedValue,
          notes,
          reviewerUser,
        });

        return response.status(200).json({
          success: true,
          resolved,
        });
      } catch (error) {
        console.error("[verificationEndpoints] Error resolving review:", error.message);
        return response.status(500).json({ error: error.message });
      }
    }
  );

  /**
   * POST /api/verification/verify-step
   * Ad-hoc step verification simulator / executor
   */
  app.post(
    "/verification/verify-step",
    [validatedRequest, flexUserRoleValid([ROLES.all])],
    async (request, response) => {
      try {
        const { step, output } = request.body || {};
        if (!step) {
          return response.status(400).json({ error: "Step payload required." });
        }

        const user = await userFromSession(request, response);
        const result = await VerificationManager.verifyStep({
          step,
          output,
          context: { user },
        });

        return response.status(200).json({ result });
      } catch (error) {
        console.error("[verificationEndpoints] Verify step error:", error.message);
        return response.status(500).json({ error: error.message });
      }
    }
  );
}

module.exports = { verificationEndpoints };
