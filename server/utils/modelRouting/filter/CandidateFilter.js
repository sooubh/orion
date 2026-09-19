const { SENSITIVITY_LEVELS, TRUST_STATUS } = require("../contracts/types");

class CandidateFilter {
  /**
   * Stage A: Hard Constraint Filtering Pipeline.
   * Eliminates models that cannot or must not execute the request.
   *
   * @param {Array<Object>} candidates - All registered model profiles
   * @param {Object} routingContext - Normalized RoutingContext
   * @param {Object} hardwareProfiler - HardwareProfiler instance
   * @returns {{ eligible: Array<Object>, rejected: Array<{ modelId: string, reason: string, code: string }> }}
   */
  static filter(candidates = [], routingContext = {}, hardwareProfiler) {
    const eligible = [];
    const rejected = [];

    const effectiveSensitivity = routingContext.data?.sensitivity || "INTERNAL";
    const requiredSensValue =
      SENSITIVITY_LEVELS[effectiveSensitivity.toUpperCase()] ??
      SENSITIVITY_LEVELS.INTERNAL;

    const userRole = routingContext.user?.role || "default";
    const allowedModelIds = routingContext.permissions?.allowedModelIds;
    const deniedModelIds = routingContext.permissions?.deniedModelIds || [];

    const task = routingContext.task || {};
    const hardware = routingContext.hardware || {};

    for (const model of candidates) {
      // 1. Enabled Status check
      if (!model.enabled) {
        rejected.push({
          modelId: model.id,
          reason: "Model is administratively disabled in registry.",
          code: "REJECT_DISABLED",
        });
        continue;
      }

      // 2. Trust Status check
      if (model.trustStatus !== TRUST_STATUS.APPROVED) {
        rejected.push({
          modelId: model.id,
          reason: `Model trust status is '${model.trustStatus}', expected 'approved'.`,
          code: "REJECT_NOT_APPROVED",
        });
        continue;
      }

      // 3. Permission & Role RBAC check
      if (deniedModelIds.includes(model.id)) {
        rejected.push({
          modelId: model.id,
          reason: "Model is explicitly denied by permission policy.",
          code: "REJECT_PERMISSION_DENIED",
        });
        continue;
      }

      if (Array.isArray(allowedModelIds) && allowedModelIds.length > 0) {
        if (!allowedModelIds.includes(model.id)) {
          rejected.push({
            modelId: model.id,
            reason: "Model is not in the allowed models whitelist.",
            code: "REJECT_NOT_IN_ALLOWLIST",
          });
          continue;
        }
      }

      if (Array.isArray(model.allowedRoles) && model.allowedRoles.length > 0) {
        if (!model.allowedRoles.includes(userRole)) {
          rejected.push({
            modelId: model.id,
            reason: `User role '${userRole}' is not permitted to access model.`,
            code: "REJECT_ROLE_UNAUTHORIZED",
          });
          continue;
        }
      }

      // 4. Data Sensitivity clearance check (Hard gate: technical capability != authorization)
      const modelLevels = (model.sensitivityAccess || []).map(
        (s) => SENSITIVITY_LEVELS[String(s).toUpperCase()] ?? 0,
      );
      const maxModelLevel =
        modelLevels.length > 0 ? Math.max(...modelLevels) : 0;

      if (requiredSensValue > maxModelLevel) {
        rejected.push({
          modelId: model.id,
          reason: `Data sensitivity '${effectiveSensitivity}' exceeds model clearance (max: ${model.sensitivityAccess?.join(", ")}).`,
          code: "REJECT_SENSITIVITY_EXCEEDED",
        });
        continue;
      }

      // 5. Modality & Task Capability constraints
      if (task.requiresVision && !model.capabilities?.vision) {
        rejected.push({
          modelId: model.id,
          reason: "Task requires vision, but model lacks vision capability.",
          code: "REJECT_MISSING_VISION",
        });
        continue;
      }

      if (task.requiresCode && !model.capabilities?.code) {
        rejected.push({
          modelId: model.id,
          reason: "Task requires code, but model lacks code capability.",
          code: "REJECT_MISSING_CODE",
        });
        continue;
      }

      if (task.requiresTools && !model.capabilities?.toolUse) {
        rejected.push({
          modelId: model.id,
          reason:
            "Task requires tool execution, but model lacks tool capability.",
          code: "REJECT_MISSING_TOOL_USE",
        });
        continue;
      }

      const estimatedTokens = task.estimatedTokens || 0;
      if (
        estimatedTokens > 0 &&
        estimatedTokens > (model.contextLength || 8192)
      ) {
        rejected.push({
          modelId: model.id,
          reason: `Estimated tokens (${estimatedTokens}) exceeds model context length (${model.contextLength}).`,
          code: "REJECT_CONTEXT_OVERFLOW",
        });
        continue;
      }

      // 6. Hardware Feasibility check
      if (
        hardwareProfiler &&
        !hardwareProfiler.isHardwareFeasible(model, hardware)
      ) {
        const minVram = model.resourceRequirements?.minVramGb || 0;
        const minRam = model.resourceRequirements?.minRamGb || 0;
        rejected.push({
          modelId: model.id,
          reason: `Insufficient hardware resources (min VRAM: ${minVram}GB, avail VRAM: ${hardware.availableVramGb || 0}GB, min RAM: ${minRam}GB, system RAM: ${hardware.systemRamGb || 0}GB).`,
          code: "REJECT_INSUFFICIENT_HARDWARE",
        });
        continue;
      }

      eligible.push(model);
    }

    return { eligible, rejected };
  }
}

module.exports = { CandidateFilter };
