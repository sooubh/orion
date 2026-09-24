const { RepairStrategy, MAX_REPAIR_ATTEMPTS } = require("./types");
const { PolicyEngine } = require("../policy");

class RepairEngine {
  /**
   * Formulate a concrete repair action to re-execute the step.
   * @param {Object} params
   * @param {Object} params.step - The step definition
   * @param {Object} params.diagnosis - The output of DiagnosisEngine.diagnose
   * @param {Object} [params.context] - Workspace, user, and session context
   * @returns {Object} RepairAction
   */
  static formulateRepair({ step, diagnosis, context = {} }) {
    const attemptNumber = (diagnosis?.attemptNumber || 1);
    const strategy = diagnosis?.repairStrategy || RepairStrategy.PARAMETER_CORRECTION;
    const suggestedFix = diagnosis?.suggestedFix || {};

    let modifiedInput = null;
    let modelOverride = null;
    let additionalRetrieval = false;
    let toolOverride = null;
    let feedbackPrompt = "";

    // Strip previous self-repair instructions from string inputs to prevent accumulation
    const cleanInput = (input) => {
      if (typeof input !== "string") return input || "";
      return input.replace(/\n*\[SELF-REPAIR (?:INSTRUCTION|ESCALATION)[^\]]*\]:[^\n]*(?:\n(?!\[SELF-REPAIR).)*/g, "").trim();
    };

    switch (strategy) {
      case RepairStrategy.RECALCULATION: {
        const correctVal = suggestedFix.correctValue;
        feedbackPrompt =
          `[SELF-REPAIR INSTRUCTION - CALCULATION ERROR DETECTED]: ` +
          `Your previous calculation had an arithmetic mismatch. ` +
          (correctVal !== undefined
            ? `The deterministically verified correct value is ${correctVal}. `
            : "") +
          `Please update the calculation to use the verified value and re-run.`;

        if (step?.input && typeof step.input === "object") {
          modifiedInput = {
            ...step.input,
            correctedValue: correctVal,
            repairConstraint: `Must match verified value ${correctVal}`,
          };
        } else {
          modifiedInput = `${cleanInput(step?.input)}\n\n${feedbackPrompt}`;
        }
        break;
      }

      case RepairStrategy.SCHEMA_CORRECTION: {
        const missing = (suggestedFix.missingKeys || []).join(", ");
        feedbackPrompt =
          `[SELF-REPAIR INSTRUCTION - SCHEMA VIOLATION DETECTED]: ` +
          `Your previous output failed JSON schema validation. ` +
          (missing ? `Missing required fields: [${missing}]. ` : "") +
          `You MUST respond ONLY with valid JSON conforming to the requested schema. Do not omit any required keys.`;

        if (step?.input && typeof step.input === "object") {
          modifiedInput = {
            ...step.input,
            enforceValidJson: true,
            requiredKeys: suggestedFix.missingKeys || [],
          };
        } else {
          modifiedInput = `${cleanInput(step?.input)}\n\n${feedbackPrompt}`;
        }
        break;
      }

      case RepairStrategy.DELIVERABLE_REBUILD: {
        const missingSections = (suggestedFix.missingSections || []).join(", ");
        feedbackPrompt =
          `[SELF-REPAIR INSTRUCTION - DELIVERABLE CORRUPTION]: ` +
          `The generated deliverable was empty, corrupted, or missing sections: [${missingSections}]. ` +
          `Ensure file generation includes non-empty payload and all required sections.`;

        if (step?.input && typeof step.input === "object") {
          modifiedInput = {
            ...step.input,
            forceRegeneration: true,
            requiredSections: suggestedFix.missingSections || [],
          };
        } else {
          modifiedInput = `${cleanInput(step?.input)}\n\n${feedbackPrompt}`;
        }
        break;
      }

      case RepairStrategy.RETRIEVAL_EXPANSION:
      case RepairStrategy.QUERY_REFINEMENT: {
        additionalRetrieval = true;
        feedbackPrompt =
          `[SELF-REPAIR INSTRUCTION - UNGROUNDED CLAIM / HALLUCINATION]: ` +
          `Previous response contained claims not grounded in retrieved documents: [${(suggestedFix.ungroundedEntities || []).slice(0, 5).join(", ")}]. ` +
          `Do not extrapolate or speculate. Answer ONLY using facts explicitly present in the source context.`;

        modifiedInput = `${cleanInput(step?.input)}\n\n${feedbackPrompt}`;
        break;
      }

      case RepairStrategy.MODEL_ESCALATION: {
        // Escalate to higher tier sovereign model if allowed by policy
        const classification = context.classification || "INTERNAL";
        const highTierCandidate = "ollama/qwen2.5:72b"; // Example sovereign powerhouse
        const fallbackLocal = "ollama/llama3.3:70b";

        const policyCheck = PolicyEngine.evaluatePolicy({
          requestedCapability: "model",
          model: highTierCandidate,
          classification,
          user: context.user,
          workspace: context.workspace,
        });

        if (policyCheck.decision === "ALLOW") {
          modelOverride = highTierCandidate;
        } else {
          modelOverride = fallbackLocal;
        }

        feedbackPrompt =
          `[SELF-REPAIR ESCALATION]: Escalating reasoning to higher-tier sovereign model ` +
          `(${modelOverride}) due to repeated step verification difficulty.`;
        modifiedInput = `${cleanInput(step?.input)}\n\n${feedbackPrompt}`;
        break;
      }

      case RepairStrategy.PARAMETER_CORRECTION:
      default: {
        feedbackPrompt =
          `[SELF-REPAIR INSTRUCTION - PARAMETER CORRECTION]: ` +
          `Execution failed with error: ${suggestedFix.error || "invalid parameters"}. ` +
          `Please correct the parameters and re-execute.`;

        if (step?.input && typeof step.input === "object") {
          modifiedInput = {
            ...step.input,
            _repairAttempt: attemptNumber,
            _errorFeedback: suggestedFix.error,
          };
        } else {
          modifiedInput = `${cleanInput(step?.input)}\n\n${feedbackPrompt}`;
        }
        break;
      }
    }

    return {
      stepId: step?.stepId || "step_unknown",
      strategy,
      attemptNumber,
      feedbackPrompt,
      modifiedInput,
      modelOverride,
      additionalRetrieval,
      toolOverride,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { RepairEngine };
