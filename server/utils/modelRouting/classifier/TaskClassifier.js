const { TASK_TYPES, TASK_COMPLEXITIES } = require("../contracts/types");
const { TASK_PATTERNS, CODE_INDICATORS } = require("./taxonomy");

class TaskClassifier {
  /**
   * Deterministic, zero-LLM classification of prompt and attachments.
   * Execution time: < 1ms.
   *
   * @param {Object} input
   * @param {string} [input.prompt]
   * @param {Array<Object>} [input.attachments]
   * @param {number} [input.conversationTokenCount]
   * @param {Array<string>} [input.contextTexts]
   * @param {boolean} [input.requiresVisionOverride]
   * @param {boolean} [input.requiresCodeOverride]
   * @returns {Object} normalized TaskContext
   */
  static classify({
    prompt = "",
    attachments = [],
    conversationTokenCount = 0,
    requiresVisionOverride,
    requiresCodeOverride,
  } = {}) {
    const promptStr = typeof prompt === "string" ? prompt : "";
    const promptLower = promptStr.toLowerCase();

    // 1. Task Type categorization: Match functional intent patterns first before modality overrides
    let detectedType = null;

    for (const rule of TASK_PATTERNS) {
      if (rule.type === TASK_TYPES.MULTIMODAL_ANALYSIS) continue;
      if (rule.pattern.test(promptStr)) {
        detectedType = rule.type;
        break;
      }
    }

    // 2. Modality detection (Vision)
    const hasImageAttachment = attachments.some(
      (a) =>
        a?.mime?.startsWith("image/") ||
        /\.(png|jpe?g|webp|gif|bmp|tiff)$/i.test(a?.name || ""),
    );
    const mentionsVision =
      /\b(image|picture|photo|screenshot|diagram|drawing|scanned|scan|ocr|visual)\b/i.test(
        promptLower,
      ) ||
      /\b(inspect|read|interpret|analyze|view|describe)\s+(?:the\s+|this\s+)?chart\b/i.test(
        promptLower,
      );
    // Don't let mentions of "chart" override a text-based functional intent like DOCUMENT_SUMMARY unless there's an actual image
    const requiresVision =
      requiresVisionOverride ?? (hasImageAttachment || (mentionsVision && !detectedType));

    // 3. Code detection

    if (!detectedType) {
      if (requiresVision) {
        detectedType = TASK_TYPES.MULTIMODAL_ANALYSIS;
      } else if (requiresCode) {
        detectedType = /\b(review|audit|lint|analyze|inspect)\b/i.test(
          promptLower,
        )
          ? TASK_TYPES.CODE_REVIEW
          : TASK_TYPES.CODE_GENERATION;
      } else {
        const multimodalRule = TASK_PATTERNS.find(
          (r) => r.type === TASK_TYPES.MULTIMODAL_ANALYSIS,
        );
        if (multimodalRule && multimodalRule.pattern.test(promptStr)) {
          detectedType = TASK_TYPES.MULTIMODAL_ANALYSIS;
        } else {
          detectedType = TASK_TYPES.TEXT_QA;
        }
      }
    }

    // 4. Token estimation and long context flag
    const estimatedTokens =
      conversationTokenCount || Math.ceil(promptStr.length / 4);
    const requiresLongContext = estimatedTokens > 8192;

    // 5. Complexity determination
    let complexity = TASK_COMPLEXITIES.LOW;
    if (
      estimatedTokens > 16384 ||
      detectedType === TASK_TYPES.GENERAL_REASONING ||
      (requiresVision && requiresCode) ||
      detectedType === TASK_TYPES.REPORT_GENERATION
    ) {
      complexity = TASK_COMPLEXITIES.HIGH;
    } else if (
      estimatedTokens > 4096 ||
      detectedType === TASK_TYPES.DOCUMENT_SUMMARY ||
      detectedType === TASK_TYPES.CODE_REVIEW ||
      detectedType === TASK_TYPES.DATA_ANALYSIS ||
      detectedType === TASK_TYPES.CODE_GENERATION
    ) {
      complexity = TASK_COMPLEXITIES.MEDIUM;
    }

    // 6. Tool use detection
    const requiresTools =
      /\b(search the web|browse|execute query|run sql|database query|call tool|fetch url)\b/i.test(
        promptLower,
      );

    return {
      type: detectedType,
      complexity,
      requiresVision,
      requiresCode,
      requiresLongContext,
      requiresTools,
      estimatedTokens,
    };
  }
}

module.exports = { TaskClassifier };
