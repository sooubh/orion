const { VerificationStatus } = require("../types");

class RAGGroundingVerifier {
  static name = "RAGGroundingVerifier";
  static MIN_GROUNDING_SCORE = 0.55; // Threshold for token/entity grounding

  /**
   * Tokenize text into lower-case alphanumeric tokens, excluding common stop words.
   * @param {string} text
   * @returns {Set<string>}
   */
  static extractKeywords(text) {
    if (!text || typeof text !== "string") return new Set();
    const stopWords = new Set([
      "the", "is", "at", "which", "on", "a", "an", "and", "or", "in", "with",
      "to", "of", "for", "by", "from", "as", "that", "it", "this", "be", "are",
      "was", "were", "will", "would", "can", "could", "should", "has", "have",
      "had", "not", "but", "also", "into", "than", "then", "its", "their", "such",
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s.-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    return new Set(words);
  }

  /**
   * Extract factual entities (numbers, measurements, percentages, technical codes) from text.
   * @param {string} text
   * @returns {Array<string>}
   */
  static extractFactualTokens(text) {
    if (!text || typeof text !== "string") return [];
    // Numbers, percentages, model codes like "750 RPM", "3.5 bar", "TX-900", "99.4%"
    const patterns = [
      /\b\d+(?:\.\d+)?(?:\s*(?:%|rpm|bar|psi|kw|mw|volts|v|hz|c|f|kg|lbs|mpa))\b/gi,
      /\b[a-z]{2,5}-\d{2,6}\b/gi,
      /\b\d+(?:\.\d+)?\b/g,
    ];

    const entities = new Set();
    for (const pattern of patterns) {
      const matches = text.match(pattern) || [];
      for (const m of matches) {
        entities.add(m.trim().toLowerCase());
      }
    }
    return Array.from(entities);
  }

  /**
   * Verify generated text against retrieved RAG sources.
   * @param {Object} params
   * @param {string} params.generatedText - The text produced by the model
   * @param {Array<Object|string>} params.sources - Retrieved context chunks
   * @param {Array<Object>} [params.citedSources] - Sources explicitly cited
   * @returns {Object} VerificationResult
   */
  static verify({ generatedText, sources = [], citedSources = [] }) {
    if (!generatedText || typeof generatedText !== "string") {
      return {
        status: VerificationStatus.FAILED,
        confidence: 1.0,
        reason: "No generated text provided for RAG grounding verification.",
        evidence: null,
        method: this.name,
      };
    }

    // Combine all retrieved source text into a single corpus
    const combinedSourceText = (sources || [])
      .map((s) => {
        if (typeof s === "string") return s;
        return s.text || s.pageContent || s.content || "";
      })
      .join("\n")
      .toLowerCase();

    if (!combinedSourceText.trim()) {
      return {
        status: VerificationStatus.UNCERTAIN,
        confidence: 0.5,
        reason: "No retrieved knowledge sources provided; grounding cannot be confirmed.",
        evidence: { sourceCount: (sources || []).length },
        method: this.name,
      };
    }

    // Check factual numbers/metrics in response against source text
    const responseFacts = this.extractFactualTokens(generatedText);
    const ungroundedFacts = [];

    for (const fact of responseFacts) {
      // Ignore trivial numbers like 1, 2, 3 in bullet lists
      if (/^[1-9]$/.test(fact)) continue;

      if (!combinedSourceText.includes(fact)) {
        ungroundedFacts.push(fact);
      }
    }

    // Check keyword overlap
    const responseKeywords = this.extractKeywords(generatedText);
    const sourceKeywords = this.extractKeywords(combinedSourceText);

    let overlapCount = 0;
    for (const kw of responseKeywords) {
      if (sourceKeywords.has(kw)) overlapCount++;
    }

    const groundingScore =
      responseKeywords.size > 0 ? overlapCount / responseKeywords.size : 0;

    // Check citation validity if citations are present
    const citationFailures = [];
    if (Array.isArray(citedSources) && citedSources.length > 0) {
      const availableDocIdentifiers = (sources || []).map((s) => {
        if (typeof s === "string") return "";
        return (
          s.metadata?.title ||
          s.metadata?.docpath ||
          s.title ||
          s.id ||
          ""
        ).toLowerCase();
      });

      for (const cited of citedSources) {
        const citedId = (
          cited.title ||
          cited.docpath ||
          cited.id ||
          ""
        ).toLowerCase();
        if (
          citedId &&
          !availableDocIdentifiers.some((id) => id && (id.includes(citedId) || citedId.includes(id)))
        ) {
          citationFailures.push(citedId);
        }
      }
    }

    // Determine verification outcome
    const ungroundedCount = ungroundedFacts.length;
    const hasSevereUngrounded = ungroundedCount > 2 || (ungroundedCount > 0 && responseFacts.length <= 2);
    const scorePasses = groundingScore >= this.MIN_GROUNDING_SCORE;

    if (citationFailures.length > 0) {
      return {
        status: VerificationStatus.FAILED,
        confidence: 0.95,
        groundingScore,
        ungroundedEntities: ungroundedFacts,
        citationFailures,
        reason: `Citation verification failed: cited source(s) [${citationFailures.join(", ")}] not present in retrieved context.`,
        evidence: { citationFailures, groundingScore },
        method: this.name,
      };
    }

    if (hasSevereUngrounded) {
      return {
        status: VerificationStatus.FAILED,
        confidence: 0.92,
        groundingScore,
        ungroundedEntities: ungroundedFacts,
        reason: `Potential hallucination detected: ${ungroundedCount} numerical/factual values not supported by retrieved context: [${ungroundedFacts.slice(0, 5).join(", ")}]`,
        evidence: { ungroundedFacts, groundingScore },
        method: this.name,
      };
    }

    if (!scorePasses && responseKeywords.size > 15) {
      return {
        status: VerificationStatus.FAILED,
        confidence: 0.85,
        groundingScore,
        ungroundedEntities: ungroundedFacts,
        reason: `Low grounding score (${(groundingScore * 100).toFixed(1)}% < ${this.MIN_GROUNDING_SCORE * 100}% threshold); text diverges significantly from retrieved sources.`,
        evidence: { groundingScore, responseKeywordCount: responseKeywords.size },
        method: this.name,
      };
    }

    return {
      status: VerificationStatus.PASSED,
      confidence: Math.min(1.0, Math.max(0.8, groundingScore)),
      groundingScore,
      ungroundedEntities: [],
      reason: `Grounding verified: factual entities supported and overlap score ${(groundingScore * 100).toFixed(1)}% satisfies threshold.`,
      evidence: { groundingScore, factCount: responseFacts.length },
      method: this.name,
    };
  }
}

module.exports = { RAGGroundingVerifier };
