const { v4: uuidv4 } = require("uuid");
const { ModelRegistry } = require("./registry/ModelRegistry");
const { HardwareProfiler } = require("./profiler/HardwareProfiler");
const { CandidateFilter } = require("./filter/CandidateFilter");
const { RoutingScorer } = require("./scorer/RoutingScorer");
const { RoutingAuditor } = require("./audit/RoutingAuditor");
const { OrionContextAdapter } = require("./adapter/OrionContextAdapter");
const { ROUTING_STATUS } = require("./contracts/types");

class AdaptiveModelRouter {
  static instance = null;

  constructor() {
    if (AdaptiveModelRouter.instance) return AdaptiveModelRouter.instance;
    AdaptiveModelRouter.instance = this;

    this.registry = ModelRegistry.getInstance();
    this.hardwareProfiler = HardwareProfiler.getInstance();
  }

  static getInstance() {
    if (!AdaptiveModelRouter.instance) new AdaptiveModelRouter();
    return AdaptiveModelRouter.instance;
  }

  /**
   * Main routing method:
   * Task + Sensitivity + Capability + Hardware + Permission → Best Model
   *
   * @param {Object} routingContext
   * @returns {Promise<Object>} RoutingDecision
   */
  async route(routingContext = {}) {
    const startTime = Date.now();
    const requestId = routingContext.requestId || uuidv4();
    const decisionId = uuidv4();

    // 1. Ensure Hardware Telemetry is available
    const hardware =
      routingContext.hardware || (await this.hardwareProfiler.getProfile());
    routingContext.hardware = hardware;

    // 2. Fetch candidate models: dynamically discover from runtime or use passed candidates
    const candidates =
      routingContext.candidates || (await this.registry.getAvailableModels());

    // 3. Stage A: Hard Constraint Filtering
    const { eligible, rejected } = CandidateFilter.filter(
      candidates,
      routingContext,
      this.hardwareProfiler,
    );

    // 4. Fail-Closed Check: If no candidate passed hard constraints
    if (eligible.length === 0) {
      const topRejections = rejected
        .slice(0, 3)
        .map((r) => `${r.modelId}: ${r.reason}`)
        .join("; ");
      const decision = {
        status: ROUTING_STATUS.NO_ELIGIBLE_MODEL,
        decisionId,
        requestId,
        externalFallbackAllowed: false,
        reason: `No approved local model satisfies the task, sensitivity, capability, and hardware constraints (${topRejections || "no candidates registered"}).`,
        task: {
          type: routingContext.task?.type,
          complexity: routingContext.task?.complexity,
        },
        constraints: {
          sensitivity: routingContext.data?.sensitivity,
          requiredCapabilities: this.#extractRequiredCapabilities(
            routingContext.task,
          ),
          userRole: routingContext.user?.role,
        },
        hardwareSummary: {
          gpuName: hardware.gpuName,
          availableVramGb: hardware.availableVramGb,
          systemRamGb: hardware.systemRamGb,
        },
        alternatives: rejected.map((r) => ({
          modelId: r.modelId,
          rejectedBecause: r.reason,
          code: r.code,
        })),
        timestamp: new Date().toISOString(),
      };

      const durationMs = Date.now() - startTime;
      RoutingAuditor.logDecision(decision, durationMs);
      decision.auditPayload = RoutingAuditor.buildAuditRecord(
        decision,
        routingContext,
        durationMs,
      );

      return decision;
    }

    // 5. Stage B: Weighted Suitability Scoring
    const ranked = RoutingScorer.rank(
      eligible,
      routingContext,
      this.hardwareProfiler,
    );

    const winner = ranked[0];

    const decision = {
      status: ROUTING_STATUS.SELECTED,
      decisionId,
      requestId,
      externalFallbackAllowed: false,
      selectedModel: {
        id: winner.model.id,
        displayName: winner.model.displayName,
        provider: winner.model.provider || winner.model.runtime || "ollama",
        model: winner.model.model || winner.model.id,
        score: winner.score,
      },
      task: {
        type: routingContext.task?.type,
        complexity: routingContext.task?.complexity,
      },
      constraints: {
        sensitivity: routingContext.data?.sensitivity,
        requiredCapabilities: this.#extractRequiredCapabilities(
          routingContext.task,
        ),
      },
      reasoning: winner.breakdown,
      alternatives: [
        ...ranked.slice(1).map((item) => ({
          modelId: item.model.id,
          score: item.score,
        })),
        ...rejected.map((r) => ({
          modelId: r.modelId,
          rejectedBecause: r.reason,
        })),
      ],
      timestamp: new Date().toISOString(),
    };

    const durationMs = Date.now() - startTime;
    RoutingAuditor.logDecision(decision, durationMs);
    decision.auditPayload = RoutingAuditor.buildAuditRecord(
      decision,
      routingContext,
      durationMs,
    );

    return decision;
  }

  #extractRequiredCapabilities(task = {}) {
    const caps = [];
    if (task.requiresVision) caps.push("vision");
    if (task.requiresCode) caps.push("code");
    if (task.requiresTools) caps.push("toolUse");
    if (task.requiresLongContext) caps.push("longContext");
    if (caps.length === 0) caps.push("text");
    return caps;
  }
}

const { ModelDiscovery } = require("./discovery/ModelDiscovery");

module.exports = {
  AdaptiveModelRouter,
  OrionContextAdapter,
  ModelRegistry,
  ModelDiscovery,
  HardwareProfiler,
};
