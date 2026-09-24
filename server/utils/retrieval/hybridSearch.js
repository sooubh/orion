const { getVectorDbClass } = require("../helpers");
const { PolicyEngine } = require("../policy");
const { EventLogs } = require("../../models/eventLogs");
const { Document } = require("../../models/documents");
const { safeJsonParse } = require("../http");
const { fileData } = require("../files");
const { ClassificationService } = require("../classification");

const STOP_WORDS = new Set([
  "a", "an", "the", "in", "on", "at", "to", "for", "of", "and", "or", "is", "are", "was",
  "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "can", "could",
  "should", "would", "what", "which", "who", "whom", "this", "that", "these", "those",
  "from", "by", "with", "about", "into", "through", "during", "before", "after", "above",
  "below", "under", "up", "down", "only", "use", "using", "tell", "show", "give", "me",
  "summarize", "analyze", "explain", "find", "search", "document", "documents", "file", "files",
  "uploaded", "workspace", "all", "any", "some", "it", "its", "they", "them", "their", "please",
  "pdf", "docx", "doc", "txt", "csv", "xlsx", "json", "md"
]);

class HybridSearch {
  /**
   * Extract meaningful entities, measurements, codes, and keywords from natural language query.
   * @param {string} query
   * @returns {{
   *   isExplicitFilename: boolean,
   *   targetFilename: string|null,
   *   entities: string[],
   *   measurements: string[],
   *   keywords: string[],
   *   cleanedQuery: string
   * }}
   */
  static analyzeQuery(query = "") {
    if (!query || typeof query !== "string") {
      return {
        isExplicitFilename: false,
        targetFilename: null,
        entities: [],
        measurements: [],
        keywords: [],
        cleanedQuery: "",
      };
    }

    const trimmed = query.trim();

    // 1. Detect explicit filename patterns
    // e.g. "03_CONFIDENTIAL_Inspection_Report.pdf", "readme.md", "data.csv"
    const fileRegex = /\b([a-zA-Z0-9_\-]+\.(?:pdf|docx?|txt|csv|xlsx?|json|md))\b/i;
    const fileMatch = trimmed.match(fileRegex);
    const isExplicitFilenameCmd =
      /^(?:open|read|view|show|display|cat|get|summarize)\s+["']?([a-zA-Z0-9_\-\.\s]+\.[a-zA-Z0-9]{2,5})["']?$/i.test(
        trimmed
      );

    const isExplicitFilename = isExplicitFilenameCmd || (!!fileMatch && trimmed.length < 80);
    const targetFilename = fileMatch ? fileMatch[1] : null;

    // Normalize text for entity and keyword extraction (replace underscores with spaces)
    const normalizedText = trimmed.replace(/[_]/g, " ");

    // 2. Extract equipment codes, tags, identifiers, and uppercase acronyms
    const entityMatches =
      normalizedText.match(/\b(?:[A-Z]{1,4}-\d{1,4}|[a-zA-Z0-9]+-[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*|[A-Z]{2,}\b)\b/g) || [];
    const entities = Array.from(
      new Set(
        entityMatches
          .map((e) => e.toUpperCase())
          .filter((e) => !STOP_WORDS.has(e.toLowerCase()))
      )
    );

    // 3. Extract measurements and units (e.g. "7.8 mm/s", "42.5 A", "71 C", "> 7.0 mm/s", general units)
    const measurementMatches =
      trimmed.match(/(?:>|<|>=|<=)?\s*\d+(?:\.\d+)?\s*(?:mm\/s|bar|psi|rpm|hz|khz|mhz|ghz|kb|mb|gb|tb|ms|s|sec|min|hr|h|km|m|cm|mm|kg|g|mg|l|ml|v|w|kw|mw|a|ma|c|°c|°f|%)\b/gi) || [];
    const measurements = Array.from(new Set(measurementMatches.map((m) => m.trim().toLowerCase())));

    // 4. Extract domain keywords (ignoring standard conversational stop words and file extensions)
    const strippedText = normalizedText
      .replace(/\.(pdf|docx?|txt|csv|xlsx?|json|md)\b/gi, " ")
      .toLowerCase();

    const words = strippedText
      .replace(/[^a-z0-9\-\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

    const keywords = Array.from(new Set(words));

    // 5. Detect explicit open/summarize document intent
    const isOpenDocumentQuery =
      /^(?:summarize|summary|overview|what(?:\s+is|\s+'s)?\s+in|explain|describe|tell\s+me\s+about|review)\s+(?:the\s+|all\s+|my\s+)?(?:document|documents|file|files|upload|workspace|data|content)\b/i.test(
        trimmed
      ) ||
      /^(?:what\s+does\s+(?:the|this|my)\s+(?:document|file|report|data)\s+(?:say|contain|have|cover))/i.test(
        trimmed
      ) ||
      /^(?:give\s+me\s+a\s+(?:summary|brief|overview|breakdown)\s+of\s+(?:the|this|all)\s+(?:document|documents|file|files))/i.test(
        trimmed
      ) ||
      /^(?:summarize|summary|overview)\b/i.test(trimmed);

    return {
      isExplicitFilename,
      targetFilename,
      isOpenDocumentQuery,
      entities,
      measurements,
      keywords,
      cleanedQuery: trimmed,
    };
  }

  /**
   * Helper to dynamically resolve document / chunk classification
   * using workspace metadata, explicit markings in title/text, and ClassificationService.
   */
  static resolveChunkClassification({ title = "", text = "", metadata = {}, docMetaMap = new Map() }) {
    const titleLower = (title || "").toLowerCase();
    const cleanTitle = titleLower.replace(/\.(pdf|docx?|txt|csv|xlsx?|json|md)$/i, "");

    // 1. Check workspace document metadata map
    const knownMeta = docMetaMap.get(titleLower) || docMetaMap.get(cleanTitle);
    if (knownMeta?.classification) {
      return knownMeta.classification;
    }

    // 2. Deterministic check on title/text for clear markings
    const combined = `${title} ${text || ""}`;
    if (/(?:\b|_)(RESTRICTED)(?:\b|_)|Classification:\s*RESTRICTED/i.test(combined)) {
      return "RESTRICTED";
    }
    if (/(?:\b|_)(CONFIDENTIAL)(?:\b|_)|Classification:\s*CONFIDENTIAL/i.test(combined)) {
      return "CONFIDENTIAL";
    }
    if (/(?:\b|_)(PUBLIC)(?:\b|_)|Classification:\s*PUBLIC/i.test(combined)) {
      return "PUBLIC";
    }
    if (/(?:\b|_)(INTERNAL)(?:\b|_)|Classification:\s*INTERNAL/i.test(combined)) {
      return "INTERNAL";
    }

    // 3. ClassificationService evaluation
    try {
      const classified = ClassificationService.classifyDocument({
        filename: title,
        text,
        metadata,
      });
      if (classified?.classification) {
        return classified.classification;
      }
    } catch {}

    // 4. Default fallback
    return metadata?.classification || "INTERNAL";
  }

  /**
   * Perform hybrid search combining vector semantic similarity, keyword/entity matching,
   * metadata scoring, and policy clearance enforcement.
   *
   * @param {Object} params
   * @param {import("@prisma/client").workspaces} params.workspace
   * @param {string} params.query - The natural language query
   * @param {Object} [params.user=null]
   * @param {Object} [params.LLMConnector=null]
   * @param {number} [params.topN=6]
   * @param {number} [params.similarityThreshold=0.20]
   * @param {string[]} [params.filterIdentifiers=[]]
   * @param {boolean} [params.rerank=false]
   * @returns {Promise<{
   *   contextTexts: string[],
   *   sources: Array<Object>,
   *   combinedContext: string,
   *   message: string|null
   * }>}
   */
  static async searchWorkspace({
    workspace,
    query = "",
    user = null,
    LLMConnector = null,
    topN = 6,
    similarityThreshold = 0.20,
    filterIdentifiers = [],
    rerank = false,
  }) {
    if (!workspace || !query || !query.trim()) {
      return {
        contextTexts: [],
        sources: [],
        combinedContext: "",
        message: "No query provided.",
      };
    }

    const analysis = this.analyzeQuery(query);
    const VectorDb = getVectorDbClass();
    const namespace = workspace.slug;

    // Preload workspace document metadata map for accurate classification and title scoring
    const workspaceDocs = await Document.where({ workspaceId: Number(workspace.id) });
    const docMetaMap = new Map();
    for (const d of workspaceDocs) {
      const meta = safeJsonParse(d.metadata, {});
      const title = meta.title || d.filename;
      if (title) {
        docMetaMap.set(title.toLowerCase(), meta);
        const cleanTitle = title.toLowerCase().replace(/\.(pdf|docx?|txt|csv|xlsx?|json|md)$/i, "");
        docMetaMap.set(cleanTitle, meta);
      }
      if (d.filename) {
        docMetaMap.set(d.filename.toLowerCase(), meta);
      }
    }

    // Check if namespace exists in vector store
    const hasVectorized = await VectorDb.hasNamespace(namespace);
    let vectorResults = { contextTexts: [], sources: [] };

    // 1. SEMANTIC VECTOR RETRIEVAL
    if (hasVectorized && LLMConnector) {
      try {
        vectorResults = await VectorDb.performSimilaritySearch({
          namespace,
          input: query,
          LLMConnector,
          similarityThreshold: 0.15, // Cast a slightly wider net for hybrid reranking
          topN: Math.max(topN * 4, 24),
          filterIdentifiers,
          rerank,
        });
      } catch (err) {
        console.warn("[HybridSearch] Vector similarity search error:", err.message);
      }
    }

    // 2. CANDIDATE CHUNKS AGGREGATION
    // Map of chunkId -> chunk record
    const candidateMap = new Map();

    // Ingest vector results
    (vectorResults.sources || []).forEach((src, idx) => {
      const meta = src.metadata || src;
      const id = meta.id || `vec-${idx}`;
      const text = meta.text || vectorResults.contextTexts?.[idx] || "";
      const title = meta.title || meta.filename || "unknown";
      const vectorScore = meta.score ?? (1 - (meta._distance || 0.5));
      const classification = this.resolveChunkClassification({ title, text, metadata: meta, docMetaMap });

      candidateMap.set(id, {
        id,
        text,
        title,
        docpath: meta.docpath || meta.chunkSource || "",
        classification,
        vectorScore: Math.max(0, Math.min(1, vectorScore)),
        lexicalScore: 0,
        metadataScore: 0,
        metadata: {
          ...meta,
          title,
          classification,
        },
      });
    });

    // 3. RETRIEVE WORKSPACE DOCUMENT CHUNKS FOR LEXICAL / ENTITY MATCHING
    // Avoid loading entire tables into memory if vector search already yielded candidates; safeguard with bounded query limit(100)
    if (hasVectorized && VectorDb.name === "LanceDb" && candidateMap.size === 0) {
      try {
        const { client } = await VectorDb.connect();
        const exists = await VectorDb.namespaceExists(client, namespace);
        if (exists) {
          const table = await client.openTable(namespace);
          const allRows = await table.query().limit(100).toArray();

          for (const row of allRows) {
            const id = row.id;
            const text = row.text || "";
            const title = row.title || row.filename || "unknown";
            const classification = this.resolveChunkClassification({ title, text, metadata: row, docMetaMap });

            if (!candidateMap.has(id)) {
              candidateMap.set(id, {
                id,
                text,
                title,
                docpath: row.chunkSource || row.url || "",
                classification,
                vectorScore: 0,
                lexicalScore: 0,
                metadataScore: 0,
                metadata: {
                  ...row,
                  title,
                  classification,
                },
              });
            } else {
              // Ensure classification on existing candidate is updated
              const existing = candidateMap.get(id);
              existing.classification = classification;
              if (existing.metadata) existing.metadata.classification = classification;
            }
          }
        }
      } catch (err) {
        console.warn("[HybridSearch] LanceDB full chunk scan error:", err.message);
      }
    }

    // Fallback: If no vector candidates were loaded, load documents directly from SQLite Document store
    if (candidateMap.size === 0) {
      try {
        for (const doc of workspaceDocs) {
          try {
            const data = await fileData(doc.docpath);
            if (data?.pageContent) {
              const meta = safeJsonParse(doc.metadata, {});
              const title = data.title || meta.title || doc.filename;
              const text = data.pageContent;
              const classification = this.resolveChunkClassification({ title, text, metadata: meta, docMetaMap });

              candidateMap.set(doc.docId, {
                id: doc.docId,
                text,
                title,
                docpath: doc.docpath,
                classification,
                vectorScore: 0,
                lexicalScore: 0,
                metadataScore: 0,
                metadata: {
                  ...meta,
                  title,
                  classification,
                },
              });
            }
          } catch {}
        }
      } catch (err) {
        console.warn("[HybridSearch] Document database scan error:", err.message);
      }
    }

    // 4. LEXICAL, ENTITY, AND METADATA SCORING
    const candidates = Array.from(candidateMap.values());

    for (const item of candidates) {
      const textLower = (item.text || "").toLowerCase();
      const titleLower = (item.title || "").toLowerCase();
      const cleanTitle = titleLower.replace(/[_]/g, " ");

      let entityMatches = 0;
      let measurementMatches = 0;
      let keywordMatches = 0;
      let titleKeywordMatches = 0;

      // Check exact entities (e.g. C-204, P-101, XV-101)
      for (const ent of analysis.entities) {
        const entRegex = new RegExp(`\\b${ent}\\b`, "i");
        if (entRegex.test(item.text) || entRegex.test(item.title) || entRegex.test(cleanTitle)) {
          entityMatches += 1;
        }
      }

      // Check exact measurements (e.g. 7.8 mm/s, 71 C)
      for (const m of analysis.measurements) {
        const cleanM = m.replace(/^[<>=]+\s*/, "");
        if (cleanM && textLower.includes(cleanM)) {
          measurementMatches += 1;
        }
      }

      // Check keywords and title matches
      for (const kw of analysis.keywords) {
        if (kw.length > 1) {
          if (textLower.includes(kw)) keywordMatches += 1;
          if (cleanTitle.includes(kw)) {
            titleKeywordMatches += 1;
            keywordMatches += 2.0; // Higher weight for title matching keywords
          }
        }
      }

      // Normalize lexical score
      const totalPossibleEntities = Math.max(1, analysis.entities.length);
      const totalPossibleMeasurements = Math.max(1, analysis.measurements.length);
      const totalPossibleKeywords = Math.max(1, analysis.keywords.length);

      const entityScore = analysis.entities.length > 0 ? entityMatches / totalPossibleEntities : 0;
      const measurementScore =
        analysis.measurements.length > 0 ? measurementMatches / totalPossibleMeasurements : 0;
      const keywordScore =
        analysis.keywords.length > 0 ? Math.min(1, keywordMatches / (totalPossibleKeywords * 1.5)) : 0;

      // Composite lexical score
      const hasEntities = analysis.entities.length > 0;
      const hasMeasurements = analysis.measurements.length > 0;
      const hasKeywords = analysis.keywords.length > 0;

      let lexicalScore = 0;
      if (hasEntities && hasMeasurements && hasKeywords) {
        lexicalScore = entityScore * 0.40 + measurementScore * 0.30 + keywordScore * 0.30;
      } else if (hasEntities && hasKeywords) {
        lexicalScore = entityScore * 0.50 + keywordScore * 0.50;
      } else if (hasMeasurements && hasKeywords) {
        lexicalScore = measurementScore * 0.50 + keywordScore * 0.50;
      } else if (hasEntities) {
        lexicalScore = entityScore;
      } else if (hasMeasurements) {
        lexicalScore = measurementScore;
      } else {
        lexicalScore = keywordScore;
      }
      item.lexicalScore = Math.min(1.0, lexicalScore);

      // Title token overlap score
      const titleTokens = cleanTitle
        .replace(/\.(pdf|docx?|txt|csv|xlsx?|json|md)\b/gi, " ")
        .replace(/[^a-z0-9\-\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

      let matchingTitleTokens = 0;
      for (const kw of analysis.keywords) {
        if (titleTokens.includes(kw)) matchingTitleTokens++;
      }
      const titleOverlap = analysis.keywords.length > 0 ? matchingTitleTokens / analysis.keywords.length : 0;

      // Explicit filename or title match
      if (analysis.isExplicitFilename && analysis.targetFilename) {
        const targetClean = analysis.targetFilename.toLowerCase().replace(/[_]/g, " ");
        if (titleLower === analysis.targetFilename.toLowerCase() || titleLower.endsWith(analysis.targetFilename.toLowerCase())) {
          item.metadataScore = 1.0;
        } else if (cleanTitle.includes(targetClean)) {
          item.metadataScore = 0.85;
        } else {
          item.metadataScore = titleOverlap * 0.70;
        }
      } else if (analysis.targetFilename && cleanTitle.includes(analysis.targetFilename.toLowerCase())) {
        item.metadataScore = 0.65;
      } else {
        item.metadataScore = titleOverlap * 0.45;
      }
    }

    // 5. HYBRID SCORING CALCULATION
    for (const item of candidates) {
      if (analysis.isOpenDocumentQuery) {
        // Explicit request to summarize/review/overview workspace documents
        // Prioritize intro/executive summary chunks + any vector correlation
        const isIntroChunk =
          item.id?.endsWith("_0") ||
          item.id?.endsWith("-0") ||
          item.id?.includes("_chunk_0") ||
          item.metadata?.chunkIndex === 0;
        const introBonus = isIntroChunk ? 0.35 : 0.15;
        item.combinedScore = Math.min(1.0, 0.55 + 0.30 * (item.vectorScore || 0) + introBonus);
      } else if (analysis.isExplicitFilename && item.metadataScore >= 0.85) {
        // If exact filename was explicitly requested and matched strongly
        item.combinedScore = 0.50 * item.metadataScore + 0.30 * item.vectorScore + 0.20 * item.lexicalScore;
      } else {
        // Natural language query: ensure vector similarity can surface chunks on its own
        const hasExactEntity = analysis.entities.length > 0 && item.lexicalScore > 0.2;
        const entityBonus = hasExactEntity ? 0.25 : 0;
        const hasLexicalSignal = analysis.keywords.length > 0 || analysis.entities.length > 0 || analysis.measurements.length > 0;

        if (!hasLexicalSignal) {
          // Pure semantic inquiry: vector similarity is primary
          item.combinedScore = item.vectorScore;
        } else {
          // Blended search: dense vector + sparse lexical signals with floor
          item.combinedScore = Math.max(
            item.vectorScore * 0.85,
            0.50 * item.vectorScore +
            0.35 * item.lexicalScore +
            0.15 * item.metadataScore +
            entityBonus
          );
        }
      }

      // Cap at 1.0 and floor at 0
      item.combinedScore = Math.max(0.0, Math.min(1.0, item.combinedScore));
    }

    // 6. FILTER BY RELEVANCE THRESHOLD
    const scoredCandidates = candidates
      .filter((item) => item.combinedScore >= similarityThreshold)
      .sort((a, b) => b.combinedScore - a.combinedScore);

    if (scoredCandidates.length === 0) {
      return {
        contextTexts: [],
        sources: [],
        combinedContext: "",
        message: null,
      };
    }

    // 7. MULTI-DOCUMENT BALANCED SELECTION
    // Ensure diverse document representation when multiple documents have high relevance
    const selectedChunks = [];
    const docChunkCount = new Map();
    const maxChunksPerDoc = Math.max(2, Math.ceil(topN / 2));

    for (const candidate of scoredCandidates) {
      const docKey = candidate.title;
      const count = docChunkCount.get(docKey) || 0;

      if (count < maxChunksPerDoc || selectedChunks.length < topN) {
        selectedChunks.push(candidate);
        docChunkCount.set(docKey, count + 1);
      }

      if (selectedChunks.length >= topN * 1.5) break;
    }

    // Sort selected chunks by score
    selectedChunks.sort((a, b) => b.combinedScore - a.combinedScore);
    const finalCandidates = selectedChunks.slice(0, topN);

    // 8. DATA CLASSIFICATION & POLICY ENGINE ENFORCEMENT
    const authorizedSources = [];
    const authorizedContextTexts = [];

    for (const item of finalCandidates) {
      const chunkClassification = this.resolveChunkClassification({
        title: item.title,
        text: item.text,
        metadata: item.metadata,
        docMetaMap,
      });

      item.classification = chunkClassification;
      if (item.metadata) item.metadata.classification = chunkClassification;

      const policyResult = PolicyEngine.evaluatePolicy({
        requestedCapability: "knowledge",
        classification: chunkClassification,
        source: item.metadata,
        user,
        workspace,
        model: LLMConnector,
      });

      if (policyResult.decision === "ALLOW") {
        authorizedSources.push({
          id: item.id,
          title: item.title,
          text: item.text,
          score: Number(item.combinedScore.toFixed(4)),
          classification: chunkClassification,
          metadata: {
            ...item.metadata,
            title: item.title,
            classification: chunkClassification,
            docpath: item.docpath,
          },
        });
        authorizedContextTexts.push(item.text);
      } else {
        console.warn(
          `[HybridSearch] Chunk from ${item.title} BLOCKED by policy for classification ${chunkClassification}: ${policyResult.reason}`
        );
        EventLogs.logEvent(
          "knowledge_source_blocked",
          {
            docTitle: item.title,
            docpath: item.docpath,
            classification: chunkClassification,
            reason: policyResult.reason,
            policyRule: policyResult.policyRule,
          },
          user?.id ? Number(user.id) : null
        );
      }
    }

    if (authorizedSources.length === 0) {
      return {
        contextTexts: [],
        sources: [],
        combinedContext: "",
        message: "No authorized documents were available for this request under current security policy.",
      };
    }

    // 9. CONSTRUCT STRUCTURED EVIDENCE CONTEXT FOR AGENT GROUNDING
    let combinedContext = "### RETRIEVED DOCUMENT EVIDENCE (Authorized Workspace Sources)\n\n";
    authorizedSources.forEach((src, idx) => {
      combinedContext += `[SOURCE ${idx + 1}]: "${src.title}" (Classification: ${src.classification}, Relevance Score: ${src.score})\n`;
      combinedContext += `\`\`\`text\n${src.text.trim()}\n\`\`\`\n\n`;
    });

    return {
      contextTexts: authorizedContextTexts,
      sources: authorizedSources,
      combinedContext,
      message: null,
    };
  }

  /**
   * Find the single best matching document for document summarization or file opening.
   * If an exact filename match exists, uses it; otherwise performs content-based concept search.
   *
   * @param {Object} params
   * @param {import("@prisma/client").workspaces} params.workspace
   * @param {string} params.filenameOrQuery
   * @param {Object} [params.user=null]
   * @param {Object} [params.LLMConnector=null]
   * @returns {Promise<{
   *   document: Object|null,
   *   documentId: string|null,
   *   filename: string|null,
   *   content: string|null,
   *   classification: string,
   *   matchMethod: 'exact_filename' | 'fuzzy_filename' | 'content_search' | null,
   *   error: string|null
   * }>}
   */
  static async findBestMatchingDocument({
    workspace,
    filenameOrQuery = "",
    user = null,
    LLMConnector = null,
  }) {
    if (!workspace || !filenameOrQuery || !filenameOrQuery.trim()) {
      return {
        document: null,
        documentId: null,
        filename: null,
        content: null,
        classification: "INTERNAL",
        matchMethod: null,
        error: "No document name or search query provided.",
      };
    }

    const queryClean = filenameOrQuery.trim();
    const queryLower = queryClean.toLowerCase();

    // 1. Fetch all documents available in this workspace
    const workspaceDocs = await Document.where({ workspaceId: Number(workspace.id) });
    if (!workspaceDocs.length) {
      return {
        document: null,
        documentId: null,
        filename: null,
        content: null,
        classification: "INTERNAL",
        matchMethod: null,
        error: "No documents found in workspace.",
      };
    }

    // Collect available document metadata
    const parsedDocs = [];
    const docMetaMap = new Map();
    for (const doc of workspaceDocs) {
      const meta = safeJsonParse(doc.metadata, {});
      const filename = meta?.title || doc.filename;
      if (filename) {
        docMetaMap.set(filename.toLowerCase(), meta);
        const clean = filename.toLowerCase().replace(/\.(pdf|docx?|txt|csv|xlsx?|json|md)$/i, "");
        docMetaMap.set(clean, meta);
      }
      if (doc.filename) {
        docMetaMap.set(doc.filename.toLowerCase(), meta);
      }
      parsedDocs.push({
        docId: doc.docId,
        filename,
        docpath: doc.docpath,
        metadata: meta,
      });
    }

    const resolveDocClassification = (doc) => {
      return this.resolveChunkClassification({
        title: doc.filename,
        metadata: doc.metadata,
        docMetaMap,
      });
    };

    // 2. CHECK EXACT FILENAME MATCH
    const exactMatch = parsedDocs.find(
      (d) => d.filename.toLowerCase() === queryLower || d.docpath.toLowerCase() === queryLower
    );
    if (exactMatch) {
      const contentData = await Document.content(exactMatch.docId);
      const classification = resolveDocClassification(exactMatch);

      // Evaluate Policy
      const policyResult = PolicyEngine.evaluatePolicy({
        requestedCapability: "knowledge",
        classification,
        source: exactMatch.metadata,
        user,
        workspace,
        model: LLMConnector,
      });

      if (policyResult.decision !== "ALLOW") {
        return {
          document: null,
          documentId: exactMatch.docId,
          filename: exactMatch.filename,
          content: null,
          classification,
          matchMethod: "exact_filename",
          error: `ACTION BLOCKED BY POLICY: Document "${exactMatch.filename}" is classified as ${classification}. Access denied: ${policyResult.reason}`,
        };
      }

      return {
        document: exactMatch,
        documentId: exactMatch.docId,
        filename: exactMatch.filename,
        content: contentData.content,
        classification,
        matchMethod: "exact_filename",
        error: null,
      };
    }

    // 3. CHECK FUZZY / SUBSTRING / TITLE TOKEN OVERLAP MATCH
    // e.g. "Inspection_Report" or "C-204_inspection_report.pdf"
    const strippedQuery = queryLower
      .replace(/\.(pdf|docx?|txt|csv|xlsx?)$/i, "")
      .replace(/^[0-9]+[_\-\s]*/, "")
      .replace(/[_]/g, " ")
      .trim();

    // Direct substring match
    const directFuzzy = parsedDocs.find((d) => {
      const strippedFilename = d.filename
        .toLowerCase()
        .replace(/\.(pdf|docx?|txt|csv|xlsx?)$/i, "")
        .replace(/^[0-9]+[_\-\s]*/, "")
        .replace(/[_]/g, " ")
        .trim();
      return (
        d.filename.toLowerCase().includes(strippedQuery) ||
        strippedFilename.includes(strippedQuery) ||
        strippedQuery.includes(strippedFilename)
      );
    });

    if (directFuzzy) {
      const contentData = await Document.content(directFuzzy.docId);
      const classification = resolveDocClassification(directFuzzy);

      const policyResult = PolicyEngine.evaluatePolicy({
        requestedCapability: "knowledge",
        classification,
        source: directFuzzy.metadata,
        user,
        workspace,
        model: LLMConnector,
      });

      if (policyResult.decision !== "ALLOW") {
        return {
          document: null,
          documentId: directFuzzy.docId,
          filename: directFuzzy.filename,
          content: null,
          classification,
          matchMethod: "fuzzy_filename",
          error: `ACTION BLOCKED BY POLICY: Document "${directFuzzy.filename}" is classified as ${classification}. Access denied: ${policyResult.reason}`,
        };
      }

      return {
        document: directFuzzy,
        documentId: directFuzzy.docId,
        filename: directFuzzy.filename,
        content: contentData.content,
        classification,
        matchMethod: "fuzzy_filename",
        error: null,
      };
    }

    // Title token overlap match
    const queryTokens = strippedQuery
      .replace(/[^a-z0-9\-\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    let bestTokenMatch = null;
    let highestTokenScore = 0;

    for (const d of parsedDocs) {
      const docClean = d.filename
        .toLowerCase()
        .replace(/\.(pdf|docx?|txt|csv|xlsx?)$/i, "")
        .replace(/^[0-9]+[_\-\s]*/, "")
        .replace(/[_]/g, " ");
      const docTokens = docClean
        .replace(/[^a-z0-9\-\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

      let matchCount = 0;
      for (const qt of queryTokens) {
        if (docTokens.includes(qt)) matchCount++;
      }

      const score = queryTokens.length > 0 ? matchCount / queryTokens.length : 0;
      if (score > highestTokenScore) {
        highestTokenScore = score;
        bestTokenMatch = d;
      }
    }

    if (bestTokenMatch && highestTokenScore >= 0.5 && queryTokens.length >= 2) {
      const contentData = await Document.content(bestTokenMatch.docId);
      const classification = resolveDocClassification(bestTokenMatch);

      const policyResult = PolicyEngine.evaluatePolicy({
        requestedCapability: "knowledge",
        classification,
        source: bestTokenMatch.metadata,
        user,
        workspace,
        model: LLMConnector,
      });

      if (policyResult.decision !== "ALLOW") {
        return {
          document: null,
          documentId: bestTokenMatch.docId,
          filename: bestTokenMatch.filename,
          content: null,
          classification,
          matchMethod: "fuzzy_filename",
          error: `ACTION BLOCKED BY POLICY: Document "${bestTokenMatch.filename}" is classified as ${classification}. Access denied: ${policyResult.reason}`,
        };
      }

      return {
        document: bestTokenMatch,
        documentId: bestTokenMatch.docId,
        filename: bestTokenMatch.filename,
        content: contentData.content,
        classification,
        matchMethod: "fuzzy_filename",
        error: null,
      };
    }

    // 4. FALLBACK: HYBRID CONTENT SEARCH TO FIND MATCHING DOCUMENT
    // When the LLM guessed a name or the user provided a concept/topic without filename
    const searchResults = await this.searchWorkspace({
      workspace,
      query: queryClean,
      user,
      LLMConnector,
      topN: 3,
      similarityThreshold: 0.20,
    });

    if (searchResults.sources?.length > 0) {
      const topHit = searchResults.sources[0];
      const matchedDoc =
        parsedDocs.find((d) => d.filename === topHit.title || d.docId === topHit.id) ||
        parsedDocs.find((d) => d.filename.toLowerCase().includes(topHit.title.toLowerCase()));

      if (matchedDoc) {
        const contentData = await Document.content(matchedDoc.docId);
        const classification = resolveDocClassification(matchedDoc);

        const policyResult = PolicyEngine.evaluatePolicy({
          requestedCapability: "knowledge",
          classification,
          source: matchedDoc.metadata,
          user,
          workspace,
          model: LLMConnector,
        });

        if (policyResult.decision !== "ALLOW") {
          return {
            document: null,
            documentId: matchedDoc.docId,
            filename: matchedDoc.filename,
            content: null,
            classification,
            matchMethod: "content_search",
            error: `ACTION BLOCKED BY POLICY: Document "${matchedDoc.filename}" is classified as ${classification}. Access denied: ${policyResult.reason}`,
          };
        }

        return {
          document: matchedDoc,
          documentId: matchedDoc.docId,
          filename: matchedDoc.filename,
          content: contentData.content,
          classification,
          matchMethod: "content_search",
          error: null,
        };
      }
    }

    return {
      document: null,
      documentId: null,
      filename: null,
      content: null,
      classification: "INTERNAL",
      matchMethod: null,
      error: "No relevant document was found in the current workspace.",
    };
  }
}

module.exports = { HybridSearch };
