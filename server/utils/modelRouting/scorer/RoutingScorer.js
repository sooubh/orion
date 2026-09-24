const { DEFAULT_ROUTING_WEIGHTS } = require("./weights");
const { SENSITIVITY_LEVELS } = require("../contracts/types");

class RoutingScorer {
  /**
   * Stage B: Evaluates and ranks eligible candidates using weighted multi-criteria scoring.
   *
   * @param {Array<Object>} eligibleModels - Candidate models that passed Stage A
   * @param {Object} routingContext - Normalized RoutingContext
   * @param {Object} hardwareProfiler - HardwareProfiler instance
   * @param {Object} [weights=DEFAULT_ROUTING_WEIGHTS]
   * @returns {Array<{ model: Object, score: number, breakdown: Object }>} Ranked models
   */
  static rank(
    eligibleModels = [],
    routingContext = {},
    hardwareProfiler,
    weights = DEFAULT_ROUTING_WEIGHTS,
  ) {
    const task = routingContext.task || {};
    const data = routingContext.data || {};
    const hardware = routingContext.hardware || {};

    const scored = eligibleModels.map((model) => {
      // 1. Task Fit (30%)
      let taskFit = model.taskAffinity?.[task.type] ?? 0.6;
      if (task.complexity === "HIGH" && model.capabilities?.reasoning) {
        taskFit = Math.min(1.0, taskFit + 0.2);
      }
      if (task.complexity === "LOW" && !model.capabilities?.reasoning) {
        taskFit = Math.min(1.0, taskFit + 0.1);
      }
      // If task requires code and model specializes in code
      if (task.requiresCode && model.capabilities?.code) {
        taskFit = Math.max(taskFit, 0.95);
      }
      // If task requires vision and model specializes in vision
      if (task.requiresVision && model.capabilities?.vision) {
        taskFit = Math.max(taskFit, 0.95);
      }

      // 2. Capability Fit (25%)
      let capabilityFit = 0.85;
      if (task.requiresVision && model.capabilities?.vision)
        capabilityFit = 1.0;
      if (task.requiresCode && model.capabilities?.code) capabilityFit = 1.0;
      // Slight efficiency deduction for over-provisioning (e.g. vision model on pure text summary)
      if (!task.requiresVision && model.capabilities?.vision)
        capabilityFit -= 0.15;
      if (!task.requiresCode && model.category === "code") capabilityFit -= 0.1;

      // 3. Sensitivity Fit (20%)
      // Exact tier match gets full 1.0; over-clearance gets 0.85 to preserve higher-tier models
      const targetSensitivity = String(data.sensitivity || "INTERNAL").toUpperCase().trim();
      const targetLevel = SENSITIVITY_LEVELS[targetSensitivity] ?? SENSITIVITY_LEVELS.INTERNAL;

      const modelLevels = (model.sensitivityAccess || []).map(
        (s) => SENSITIVITY_LEVELS[String(s).toUpperCase().trim()] ?? 0,
      );
      const modelMaxLevel = modelLevels.length > 0 ? Math.max(...modelLevels) : 0;

      const sensitivityFit = modelMaxLevel === targetLevel ? 1.0 : 0.85;

      // 4. Hardware Fit (15%)
      let hardwareFit = 1.0;
      if (hardwareProfiler) {
        hardwareFit = hardwareProfiler.calculateHardwareFit(model, hardware);
      }

      // 5. Context Fit (5%)
      const estimatedTokens = task.estimatedTokens || 1000;
      const contextCapacity = model.contextLength || 8192;
      const utilization = estimatedTokens / contextCapacity;
      const contextFit =
        utilization <= 0.5 ? 1.0 : utilization <= 0.8 ? 0.8 : 0.5;

      // 6. Model Priority (5%)
      const priority = Math.min(
        1.0,
        Math.max(0.0, (model.priority || 50) / 100),
      );

      // Weighted calculation
      const compositeScore =
        taskFit * weights.taskFit +
        capabilityFit * weights.capabilityFit +
        sensitivityFit * weights.sensitivityFit +
        hardwareFit * weights.hardwareFit +
        contextFit * weights.contextFit +
        priority * weights.priority;

      const roundedScore = Math.round(compositeScore * 10000) / 10000;

      return {
        model,
        score: roundedScore,
        breakdown: {
          taskFit: Math.round(taskFit * 100) / 100,
          capabilityFit: Math.round(capabilityFit * 100) / 100,
          sensitivityFit: Math.round(sensitivityFit * 100) / 100,
          hardwareFit: Math.round(hardwareFit * 100) / 100,
          contextFit: Math.round(contextFit * 100) / 100,
          priority: Math.round(priority * 100) / 100,
          compositeScore: roundedScore,
        },
      };
    });

    // Sort descending by score; if tied, sort by priority
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.model.priority || 0) - (a.model.priority || 0);
    });

    return scored;
  }
}

module.exports = { RoutingScorer };
