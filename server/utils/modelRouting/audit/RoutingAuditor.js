/**
 * RoutingAuditor: Emits structured, explainable, and privacy-compliant audit traces.
 *
 * STRICT PRIVACY RULES:
 * 1. NEVER log raw prompt text or prompt snippets.
 * 2. NEVER log document bodies, RAG text chunks, or file contents.
 * 3. NEVER log API keys, auth tokens, or session secrets.
 */
class RoutingAuditor {
  static LOG_PREFIX = "\x1b[36m[AdaptiveModelRouter]\x1b[0m";

  /**
   * Sanitizes and builds an immutable audit payload from a routing decision.
   * @param {Object} decision
   * @param {Object} routingContext
   * @param {number} executionDurationMs
   * @returns {Object} Cleaned audit log record
   */
  static buildAuditRecord(
    decision,
    routingContext = {},
    executionDurationMs = 0,
  ) {
    return {
      requestId: decision.requestId,
      decisionId: decision.decisionId,
      timestamp: decision.timestamp || new Date().toISOString(),
      status: decision.status,
      selectedModel: decision.selectedModel
        ? {
            id: decision.selectedModel.id,
            provider: decision.selectedModel.provider,
            model: decision.selectedModel.model,
            score: decision.selectedModel.score,
          }
        : null,
      task: {
        type: routingContext.task?.type,
        complexity: routingContext.task?.complexity,
        requiresVision: routingContext.task?.requiresVision,
        requiresCode: routingContext.task?.requiresCode,
        estimatedTokens: routingContext.task?.estimatedTokens,
      },
      data: {
        sensitivity: routingContext.data?.sensitivity,
        types: routingContext.data?.types || [],
      },
      user: {
        userId: routingContext.user?.userId || null,
        role: routingContext.user?.role || "default",
      },
      hardware: {
        cpuCores: routingContext.hardware?.cpuCores,
        systemRamGb: routingContext.hardware?.systemRamGb,
        availableVramGb: routingContext.hardware?.availableVramGb,
        gpuName: routingContext.hardware?.gpuName,
      },
      reasoning: decision.reasoning || null,
      alternativesCount: decision.alternatives?.length || 0,
      executionDurationMs,
    };
  }

  /**
   * Prints clean, safe console log without leaking any prompt content.
   */
  static logDecision(decision, executionDurationMs = 0) {
    const isSelected = decision.status === "SELECTED";
    const statusColor = isSelected
      ? "\x1b[32mSELECTED\x1b[0m"
      : "\x1b[31mFAIL_CLOSED\x1b[0m";

    console.log(
      `${this.LOG_PREFIX} [${statusColor}] Request: ${decision.requestId} | ` +
        `Task: ${decision.task?.type} (${decision.task?.complexity}) | ` +
        `Sens: ${decision.constraints?.sensitivity} | ` +
        `${isSelected ? `Model: ${decision.selectedModel?.id} (score: ${decision.selectedModel?.score})` : `Reason: ${decision.reason}`} | ` +
        `${executionDurationMs}ms`,
    );
  }
}

module.exports = { RoutingAuditor };
