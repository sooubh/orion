const { HybridSearch } = require("../retrieval/hybridSearch");
const { RAGGroundingVerifier } = require("../verification/verifiers/grounding");
const { VerificationManager, StepType, VerificationStatus } = require("../verification");
const { resolveProviderConnector } = require("../helpers");

class DocumentGroundedAgent {
  static FAILURE_MESSAGE =
    "I could not find sufficient relevant information in the uploaded documents to answer this question.";

  static FORBIDDEN_FALLBACK_PHRASE = "However, based on general knowledge";

  /**
   * Detect if a query contains a strict "use only uploaded documents" instruction.
   * @param {string} query
   * @returns {boolean}
   */
  static isStrictDocumentGrounded(query = "") {
    if (!query || typeof query !== "string") return false;
    const STRICT_DOC_ONLY_REGEX =
      /(?:use|using)\s+only\s+(?:the\s+)?(?:uploaded\s+)?(?:documents?|files?|workspace)|only\s+(?:from|based\s+on|use|using)\s+(?:the\s+)?(?:uploaded\s+)?(?:documents?|files?|workspace)|strictly\s+(?:from|based\s+on|according\s+to)\s+(?:the\s+)?(?:uploaded\s+)?(?:documents?|files?|workspace)|only\s+(?:the\s+)?uploaded\s+(?:documents?|files?)/i;
    return STRICT_DOC_ONLY_REGEX.test(query);
  }

  /**
   * Detect if a query is document-grounded (strict constraint or referencing uploaded documents/assets).
   * @param {string} query
   * @returns {boolean}
   */
  static isDocumentGrounded(query = "") {
    if (!query || typeof query !== "string") return false;
    if (this.isStrictDocumentGrounded(query)) return true;

    // References uploaded assets, tags (e.g. C-204), or specific uploaded document comparisons
    if (/\buploaded\b|\bworkspace\b/i.test(query)) return true;
    if (/\b(?:C-204|[A-Z]{1,4}-\d{1,4})\b/i.test(query)) return true;
    if (/compare\s+(?:the\s+)?information\b/i.test(query)) return true;
    if (/(?:according\s+to|based\s+on|from|in)\s+(?:the\s+)?(?:uploaded\s+)?[a-zA-Z0-9_\-\s]*(?:documents?|files?|workspace|sop|report)/i.test(query)) return true;

    const analysis = HybridSearch.analyzeQuery(query);
    return Boolean(analysis?.isDocumentGrounded);
  }

  /**
   * Detect if a query is a general knowledge query (not requiring or referencing uploaded documents).
   * @param {string} query
   * @returns {boolean}
   */
  static isGeneralKnowledge(query = "") {
    return !this.isDocumentGrounded(query);
  }

  /**
   * Analyze query structure, grounding constraints, and entities.
   * @param {string} query
   * @returns {Object}
   */
  static analyzeQuery(query = "") {
    const analysis = HybridSearch.analyzeQuery(query);
    const isStrict = this.isStrictDocumentGrounded(query);
    const isGrounded = this.isDocumentGrounded(query);
    const isGeneral = !isGrounded;

    return {
      ...analysis,
      isStrict,
      isDocumentGrounded: isGrounded,
      isGeneralKnowledge: isGeneral,
    };
  }

  /**
   * Retrieve workspace sources relevant to the query with security clearance and thresholding.
   * @param {Object} params
   * @param {Object} params.workspace
   * @param {string} params.query
   * @param {Object} [params.LLMConnector=null]
   * @param {Object} [params.user=null]
   * @param {number} [params.topN=6]
   * @param {number} [params.similarityThreshold=0.20]
   * @returns {Promise<{ sources: Array<Object>, contextTexts: string[], hasRelevantEvidence: boolean }>}
   */
  static async retrieveSources({
    workspace,
    query,
    LLMConnector = null,
    user = null,
    topN = 6,
    similarityThreshold = 0.20,
  }) {
    const searchRes = await HybridSearch.searchWorkspace({
      workspace,
      query,
      LLMConnector,
      user,
      topN,
      similarityThreshold,
    });

    const sources = searchRes.sources || [];
    const contextTexts = searchRes.contextTexts || [];

    // Verify whether the retrieved sources contain relevant evidence for specific topical requests
    const analysis = this.analyzeQuery(query);
    let hasRelevantEvidence = sources.length > 0;

    if (sources.length > 0 && analysis.keywords.length > 0) {
      // Check if topical keywords overlap with retrieved text
      const combinedCorpus = sources
        .map((s) => `${s.title} ${s.text || ""}`)
        .join(" ")
        .toLowerCase();

      // Meaningful content keywords (ignoring document meta words like report, document)
      const contentKeywords = analysis.keywords.filter(
        (kw) => !["report", "document", "documents", "file", "files", "sop"].includes(kw)
      );

      if (contentKeywords.length > 0) {
        const matches = contentKeywords.filter((kw) => combinedCorpus.includes(kw));
        const keywordRatio = matches.length / contentKeywords.length;
        // If query specified distinct content keywords and insufficient keywords appear in any retrieved chunk,
        // and no exact entities or measurements matched, then there is no relevant evidence.
        if (
          (matches.length === 0 || (contentKeywords.length >= 2 && keywordRatio < 0.5 && matches.length < 2)) &&
          analysis.entities.length === 0 &&
          analysis.measurements.length === 0
        ) {
          hasRelevantEvidence = false;
        }
      }
    }

    return {
      sources: hasRelevantEvidence ? sources : [],
      contextTexts: hasRelevantEvidence ? contextTexts : [],
      hasRelevantEvidence,
    };
  }

  /**
   * Process a user query through the sovereign document-grounded agent pipeline.
   * Handles:
   *  - Query mode analysis (General Knowledge vs Strict Document Grounded)
   *  - Multi-document retrieval and evidence alignment
   *  - Truthful failure responses (no hallucinations or general knowledge fallbacks)
   *  - Verification via RAGGroundingVerifier and ClosedLoopVerification
   *
   * @param {Object} params
   * @param {Object} params.workspace
   * @param {string} params.query
   * @param {Object} [params.LLMConnector=null]
   * @param {Object} [params.user=null]
   * @param {number} [params.topN=6]
   * @param {string|Function} [params.forceResponse=null] - For deterministic testing of response handling
   * @returns {Promise<{
   *   textResponse: string,
   *   sources: Array<Object>,
   *   isDocumentGrounded: boolean,
   *   isStrict: boolean,
   *   isGeneralKnowledge: boolean,
   *   retrievalSuccess: boolean,
   *   groundingVerification: Object|null,
   *   mode: string
   * }>}
   */
  static async processQuery({
    workspace,
    query,
    LLMConnector = null,
    user = null,
    topN = 6,
    forceResponse = null,
  }) {
    const analysis = this.analyzeQuery(query);
    const { isStrict, isDocumentGrounded, isGeneralKnowledge } = analysis;

    // Resolve LLMConnector if not explicitly passed
    let connector = LLMConnector;
    if (!connector && workspace) {
      const resolved = await resolveProviderConnector({
        workspace,
        prompt: query,
        user,
      });
      connector = resolved.connector;
    }

    // Step 1: Retrieve authorized knowledge sources
    const retrieval = await this.retrieveSources({
      workspace,
      query,
      LLMConnector: connector,
      user,
      topN,
    });

    const sources = retrieval.sources;
    const contextTexts = retrieval.contextTexts;
    const retrievalSuccess = retrieval.hasRelevantEvidence;

    // Step 2: Handle strict document grounding failure condition
    // When a query asks for non-existent documents with "Use only the uploaded documents",
    // it MUST return the exact failure message and NEVER contain general knowledge fallbacks.
    if (isStrict && !retrievalSuccess) {
      return {
        textResponse: this.FAILURE_MESSAGE,
        sources: [],
        isDocumentGrounded: true,
        isStrict: true,
        isGeneralKnowledge: false,
        retrievalSuccess: false,
        groundingVerification: {
          status: VerificationStatus.PASSED,
          confidence: 1.0,
          reason: "Truthful failure response returned for unretrieved document request under strict constraint.",
        },
        mode: "strict_document_grounded_failure",
      };
    }

    // Step 3: Construct Grounded Prompt
    let textResponse = "";

    if (forceResponse) {
      textResponse =
        typeof forceResponse === "function"
          ? await forceResponse({ sources, contextTexts, query, isStrict })
          : String(forceResponse);
    } else if (connector) {
      let systemPrompt = "";
      if (isStrict) {
        systemPrompt =
          "You are Orion, a sovereign document-grounded AI assistant.\n" +
          "CRITICAL GROUNDING DIRECTIVE:\n" +
          "1. Base your answer strictly and exclusively on the uploaded documents provided in Context.\n" +
          "2. Cite the exact source document name(s) (e.g. 03_CONFIDENTIAL_Inspection_Report.pdf, 04_CONFIDENTIAL_Maintenance_SOP.docx).\n" +
          "3. State all specific recorded measurements, numbers, thresholds, findings, and follow-up actions with exact figures.\n" +
          "4. When asked to compare documents, explicitly contrast the empirical findings and measurements against the defined criteria, thresholds, and purposes.\n" +
          "5. If the context does not contain the answer, state: \"I could not find sufficient relevant information in the uploaded documents to answer this question.\"\n" +
          "6. NEVER use general knowledge, speculate, or say \"However, based on general knowledge...\".";
      } else if (isDocumentGrounded) {
        systemPrompt =
          "You are Orion, a sovereign document-grounded assistant.\n" +
          "Base your answer on the retrieved workspace documents provided in Context.\n" +
          "Directly provide specific findings, measurements, and criteria from the documents.";
      } else {
        systemPrompt =
          "You are Orion, an intelligent AI workbench assistant.\n" +
          "Answer the user query clearly and accurately. You may use general knowledge or reference documents if applicable.";
      }

      const messages = connector.constructPrompt({
        systemPrompt,
        contextTexts: isGeneralKnowledge && contextTexts.length === 0 ? [] : contextTexts,
        userPrompt: query,
      });

      const completion = await connector.getChatCompletion(messages, {
        temperature: 0.1,
        user,
      });
      textResponse = completion?.textResponse || "";
    }

    // Step 4: Strict Post-Generation Interception & Fallback Stripping
    // Ensure "However, based on general knowledge..." is NEVER present in document-grounded answers
    if (isStrict || isDocumentGrounded) {
      if (
        textResponse.startsWith(this.FAILURE_MESSAGE) ||
        textResponse.includes("could not find sufficient relevant information in the uploaded documents") ||
        /(?:no\s+relevant\s+documents?(?:\s+(?:were|are|was))?\s+found|could\s+not\s+find\s+(?:any|sufficient)\s+relevant\s+documents?)/i.test(textResponse)
      ) {
        textResponse = this.FAILURE_MESSAGE;
      } else if (
        textResponse.includes("However, based on general knowledge") ||
        textResponse.includes("based on general knowledge") ||
        /however,?\s+based\s+on\s+general/i.test(textResponse)
      ) {
        if (!retrievalSuccess) {
          textResponse = this.FAILURE_MESSAGE;
        } else {
          // Strip out the unauthorized general knowledge appendage
          textResponse = textResponse
            .replace(/(?:however,?\s+based\s+on\s+general\s+knowledge|based\s+on\s+general\s+knowledge).*$/is, "")
            .trim();
        }
      }
    }

    // Step 5: Verify Grounding with ClosedLoopVerification / RAGGroundingVerifier
    let groundingVerification = null;
    if (sources.length > 0) {
      groundingVerification = RAGGroundingVerifier.verify({
        generatedText: textResponse,
        sources,
      });
    }

    const mode = isStrict
      ? "strict_document_grounded"
      : isDocumentGrounded
      ? "document_grounded"
      : "general_knowledge";

    return {
      textResponse,
      sources,
      isDocumentGrounded,
      isStrict,
      isGeneralKnowledge,
      retrievalSuccess,
      groundingVerification,
      mode,
    };
  }
}

module.exports = { DocumentGroundedAgent };
