const {
  RepairStrategy,
  RootCauseCategory,
  StepType,
} = require("./types");

class DiagnosisEngine {
  /**
   * Diagnose the root cause of a failed step and recommend a repair strategy.
   * @param {Object} params
   * @param {Object} params.step - The step definition { stepId, type, input, expectedResult }
   * @param {Object} params.verificationResult - Result from verifier { status, reason, evidence, method, ... }
   * @param {number} [params.attemptNumber=1] - Current attempt count (1 or 2)
   * @returns {Object} DiagnosisResult
   */
  static diagnose({ step, verificationResult, attemptNumber = 1 }) {
    const stepType = step?.type || StepType.TEXT_RESPONSE;
    const failureReason = verificationResult?.reason || "Unknown verification failure";
    const method = verificationResult?.method || "";

    let rootCause = RootCauseCategory.UNKNOWN_ANOMALY;
    let repairStrategy = RepairStrategy.PARAMETER_CORRECTION;
    let suggestedFix = null;

    // 1. Calculation failures
    if (
      stepType === StepType.CALCULATION ||
      method === "CalculationVerifier" ||
      /calculation mismatch|could not be parsed as a number/i.test(failureReason)
    ) {
      rootCause = RootCauseCategory.CALCULATION_DRIFT;
      repairStrategy = RepairStrategy.RECALCULATION;
      suggestedFix = {
        correctValue: verificationResult?.expected,
        calculationDiff: verificationResult?.errorMargin,
        instruction: `Recompute value strictly using deterministic arithmetic. Correct expected value is ${verificationResult?.expected}.`,
      };
    }

    // 2. Structured output and JSON schema violations
    else if (
      stepType === StepType.STRUCTURED_OUTPUT ||
      method === "StructuredOutputVerifier" ||
      /schema validation failed|not valid json|missing required fields/i.test(failureReason)
    ) {
      rootCause = /not valid json|parse/i.test(failureReason)
        ? RootCauseCategory.SYNTAX_ERROR
        : RootCauseCategory.SCHEMA_VIOLATION;
      repairStrategy = RepairStrategy.SCHEMA_CORRECTION;
      suggestedFix = {
        missingKeys: verificationResult?.evidence?.missingKeys || [],
        typeMismatches: verificationResult?.evidence?.typeMismatches || [],
        instruction: `Ensure output is strictly valid JSON conforming to schema. Include missing properties: [${(verificationResult?.evidence?.missingKeys || []).join(", ")}].`,
      };
    }

    // 3. Deliverable file corruption or validation failures
    else if (
      stepType === StepType.DELIVERABLE ||
      method === "DeliverableVerifier" ||
      /deliverable|file signature mismatch|empty \(0 bytes\)|missing required section/i.test(failureReason)
    ) {
      rootCause = RootCauseCategory.CORRUPT_DELIVERABLE;
      repairStrategy = RepairStrategy.DELIVERABLE_REBUILD;
      suggestedFix = {
        missingSections: verificationResult?.evidence?.missingSections || [],
        instruction: `Re-generate file with proper format signature, non-zero payload, and required sections: [${(verificationResult?.evidence?.missingSections || []).join(", ")}].`,
      };
    }

    // 4. RAG grounding and citation hallucinations
    else if (
      stepType === StepType.RAG_GROUNDING ||
      method === "RAGGroundingVerifier" ||
      /hallucination detected|citation verification failed|low grounding score/i.test(failureReason)
    ) {
      rootCause = RootCauseCategory.UNGROUNDED_CLAIM;
      repairStrategy =
        attemptNumber >= 2
          ? RepairStrategy.RETRIEVAL_EXPANSION
          : RepairStrategy.QUERY_REFINEMENT;
      suggestedFix = {
        ungroundedEntities: verificationResult?.ungroundedEntities || [],
        citationFailures: verificationResult?.citationFailures || [],
        instruction: `Remove unsupported claims and hallucinations [${(verificationResult?.ungroundedEntities || []).slice(0, 5).join(", ")}]. Restrict claims strictly to facts in retrieved chunks.`,
      };
    }

    // 5. Tool execution errors
    else if (
      stepType === StepType.TOOL_CALL ||
      /failed|error|invalid parameters/i.test(failureReason)
    ) {
      rootCause = RootCauseCategory.TOOL_EXECUTION_FAILURE;
      repairStrategy =
        attemptNumber >= 2
          ? RepairStrategy.MODEL_ESCALATION
          : RepairStrategy.PARAMETER_CORRECTION;
      suggestedFix = {
        error: failureReason,
        instruction: `Correct tool arguments to match expected format and schema: ${failureReason}`,
      };
    }

    // Escalation strategy override on 2nd attempt if first repair attempt was not sufficient
    if (attemptNumber >= 2 && repairStrategy === RepairStrategy.PARAMETER_CORRECTION) {
      repairStrategy = RepairStrategy.MODEL_ESCALATION;
    }

    return {
      failedStepId: step?.stepId || "step_unknown",
      stepType,
      rootCause,
      repairStrategy,
      expected: verificationResult?.expected ?? step?.expectedResult ?? null,
      actual: verificationResult?.actual ?? verificationResult?.evidence ?? null,
      suggestedFix,
      diagnosisSummary: `Step [${step?.stepId || "unknown"}] failed due to ${rootCause}. Selected repair strategy: ${repairStrategy}.`,
      attemptNumber,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { DiagnosisEngine };
