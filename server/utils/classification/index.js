/**
 * Sovereign Industrial AI Workbench — Data Classification Service
 * (SIH PS 26117 on-premise security layer)
 *
 * Local hybrid classification engine operating 100% on-premise without external APIs.
 * Supports four standard sensitivity tiers: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED.
 */

const CLASSIFICATION_LEVELS = {
  PUBLIC: "PUBLIC",
  INTERNAL: "INTERNAL",
  CONFIDENTIAL: "CONFIDENTIAL",
  RESTRICTED: "RESTRICTED",
};

const CLASSIFICATION_ORDER = [
  CLASSIFICATION_LEVELS.PUBLIC,
  CLASSIFICATION_LEVELS.INTERNAL,
  CLASSIFICATION_LEVELS.CONFIDENTIAL,
  CLASSIFICATION_LEVELS.RESTRICTED,
];

const CLASSIFICATION_WEIGHTS = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
};

const POLICY_VERSION = "1.0.0";

// Deterministic Pattern Definitions
const PATTERNS = {
  RESTRICTED: [
    {
      regex: /\b(TOP\s*SECRET|ITAR(\s+CONTROLLED)?|EXPORT\s*CONTROLLED|SOVEREIGN\s*CLEARANCE|RESTRICTED\s*DISTRIBUTION|DEFENSE\s*CONFIDENTIAL|NATIONAL\s*SECURITY|CLASSIFIED\s*ORDNANCE|TACTICAL\s*GRID|NUCLEAR\s*REACTOR\s*CORE)\b/i,
      reason: "High-grade security or defense restriction marking detected",
      weight: 3,
    },
    {
      regex: /-----BEGIN\s+((RSA|EC|DSA|OPENSSH|PGP)\s+)?PRIVATE\s+KEY-----/i,
      reason: "Cryptographic private key detected in content",
      weight: 3,
    },
    {
      regex: /(postgres|mysql|mongodb|redis|mssql):\/\/[a-zA-Z0-9_]+:[^@\s]+@[a-zA-Z0-9_\-\.]+/i,
      reason: "Database connection URI with embedded credentials detected",
      weight: 3,
    },
    {
      regex: /\b(api[_-]?key|secret[_-]?key|bearer\s+[a-zA-Z0-9_\-\.]{24,})\s*[:=]\s*['"][^'"]+['"]/i,
      reason: "Hardcoded API secret or authorization token detected",
      weight: 3,
    },
  ],
  CONFIDENTIAL: [
    {
      regex: /\b(CONFIDENTIAL|PROPRIETARY|STRICTLY\s*CONFIDENTIAL|COMPANY\s*CONFIDENTIAL|COMMERCIALLY\s*SENSITIVE|TRADE\s*SECRET|PRIVILEGED\s*(&|AND)\s*CONFIDENTIAL|NON-DISCLOSURE\s*AGREEMENT|NDA\s*PROTECTED)\b/i,
      reason: "Confidentiality or proprietary disclosure marking detected",
      weight: 2,
    },
    {
      regex: /\b(SCADA|PLC[-_]?[0-9A-Z]+|Modbus|Profibus|OPC[-_]?UA|turbines?[-_]?(serial|id|unit)|RTU[-_]?[0-9A-Z]+|HMI[-_]tag|industrial\s*controller|substation\s*telemetry|switchgear\s*schematic|cooling\s*loop\s*sensor)\b/i,
      reason: "Confidential industrial equipment or plant telemetry identifier detected",
      weight: 2,
    },
    {
      regex: /\b(balance\s*sheet|profit\s*(&|and)\s*loss|p&l|ebitda|payroll\s*register|salary\s*breakdown|wire\s*transfer\s*instructions?|bank\s*account\s*number|revenue\s*forecast)\b/i,
      reason: "Sensitive financial or payroll information detected",
      weight: 2,
    },
    {
      regex: /\b(\d{3}-\d{2}-\d{4}|passport\s*(no|number|#)?\s*[:=]?\s*[A-Z0-9]{6,12}|aadhaar\s*(card|no)?\s*[:=]?\s*[0-9]{4}\s*[0-9]{4}\s*[0-9]{4})\b/i,
      reason: "Sensitive personally identifiable information (PII) detected",
      weight: 2,
    },
  ],
  INTERNAL: [
    {
      regex: /\b(INTERNAL\s*USE\s*ONLY|INTERNAL\s*ONLY|FOR\s*INTERNAL\s*USE|INTERNAL\s*DOCUMENT|COMPANY\s*INTERNAL|OFFICIAL\s*USE)\b/i,
      reason: "Internal organizational use marking detected",
      weight: 1,
    },
    {
      regex: /\b(sop|standard\s*operating\s*procedure|maintenance\s*log|shift\s*handover|daily\s*briefing|meeting\s*notes|project\s*roadmap|equipment\s*inspection)\b/i,
      reason: "Routine operational internal documentation patterns detected",
      weight: 1,
    },
  ],
  PUBLIC: [
    {
      regex: /\b(PUBLIC\s*RELEASE|PUBLIC\s*DOMAIN|UNCLASSIFIED|FOR\s*PUBLIC\s*DISTRIBUTION|PRESS\s*RELEASE|MARKETING\s*BROCHURE|OPEN\s*SOURCE\s*LICENSE|OPEN\s*SOURCE|MIT\s*LICENSE|APACHE\s*LICENSE|CREATIVE\s*COMMONS|PUBLIC\s*DOCUMENTATION)\b/i,
      reason: "Explicit public release or open-source marking detected",
      weight: 0,
    },
  ],
};

class ClassificationService {
  /**
   * Classify a document based on text content, filename, and existing metadata.
   * Uses deterministic pattern scanning, contextual heuristics, and conservative fallback.
   *
   * @param {Object} params
   * @param {string} params.filename - Source filename
   * @param {string} [params.content] - Extracted text content
   * @param {string} [params.text] - Alias for content
   * @param {Object} [params.metadata] - Optional caller-provided metadata
   * @param {string} [params.userId] - User ID initiating upload (or "system")
   * @returns {Object} Structured classification result
   */
  static classifyDocument({
    filename = "",
    content = "",
    text = "",
    metadata = {},
    userId = "system",
  }) {
    const rawContent = content || text || "";
    const combinedText = `${filename} ${(metadata?.title || "")} ${(metadata?.description || "")} ${rawContent.slice(0, 100_000)}`;

    const detectedReasons = [];
    let highestWeight = -1;
    let matchCount = 0;

    // Check RESTRICTED first
    for (const rule of PATTERNS.RESTRICTED) {
      if (rule.regex.test(combinedText)) {
        highestWeight = Math.max(highestWeight, rule.weight);
        detectedReasons.push(rule.reason);
        matchCount++;
      }
    }

    // Check CONFIDENTIAL
    for (const rule of PATTERNS.CONFIDENTIAL) {
      if (rule.regex.test(combinedText)) {
        highestWeight = Math.max(highestWeight, rule.weight);
        detectedReasons.push(rule.reason);
        matchCount++;
      }
    }

    // Check INTERNAL
    for (const rule of PATTERNS.INTERNAL) {
      if (rule.regex.test(combinedText)) {
        highestWeight = Math.max(highestWeight, rule.weight);
        detectedReasons.push(rule.reason);
        matchCount++;
      }
    }

    // Check PUBLIC markings
    let hasPublicMarking = false;
    for (const rule of PATTERNS.PUBLIC) {
      if (rule.regex.test(combinedText)) {
        hasPublicMarking = true;
        detectedReasons.push(rule.reason);
        matchCount++;
      }
    }

    let finalClassification;
    let confidence;
    let method = "local_hybrid";

    if (highestWeight === 3) {
      finalClassification = CLASSIFICATION_LEVELS.RESTRICTED;
      confidence = Math.min(0.99, 0.94 + matchCount * 0.02);
    } else if (highestWeight === 2) {
      finalClassification = CLASSIFICATION_LEVELS.CONFIDENTIAL;
      confidence = Math.min(0.98, 0.90 + matchCount * 0.02);
    } else if (highestWeight === 1) {
      finalClassification = CLASSIFICATION_LEVELS.INTERNAL;
      confidence = Math.min(0.95, 0.85 + matchCount * 0.03);
    } else if (hasPublicMarking) {
      finalClassification = CLASSIFICATION_LEVELS.PUBLIC;
      confidence = 0.95;
    } else {
      // Conservative Fallback: In an industrial on-premise workbench, default unclassified
      // internal files to INTERNAL rather than PUBLIC.
      finalClassification = CLASSIFICATION_LEVELS.INTERNAL;
      confidence = 0.80;
      detectedReasons.push("Default sovereign baseline applied: Non-public organizational document");
    }

    // Metadata override if explicitly specified and valid
    if (metadata?.classification && CLASSIFICATION_LEVELS[String(metadata.classification).toUpperCase()]) {
      const explicitLevel = CLASSIFICATION_LEVELS[String(metadata.classification).toUpperCase()];
      const explicitWeight = CLASSIFICATION_WEIGHTS[explicitLevel];
      // Only permit upgrade from metadata or preserve if safe
      if (explicitWeight > CLASSIFICATION_WEIGHTS[finalClassification]) {
        finalClassification = explicitLevel;
        confidence = 0.99;
        method = "explicit_metadata";
        detectedReasons.push(`Upgraded via caller metadata to ${explicitLevel}`);
      }
    }

    return {
      classification: finalClassification,
      confidence: Math.round(confidence * 100) / 100,
      classification_method: method,
      classification_timestamp: new Date().toISOString(),
      classification_policy_version: POLICY_VERSION,
      classified_by: userId ? String(userId) : "system",
      classification_reasons: detectedReasons,
      reasons: detectedReasons,
    };
  }

  /**
   * Determine the supremum (highest sensitivity level) across a set of items.
   * Guaranteed never to silently downgrade sensitive data.
   *
   * @param {Array<string|Object>} items - Array of classification labels or objects with .classification
   * @param {string} [defaultLevel=null] - Fallback if items are empty (defaults to PUBLIC)
   * @returns {string} The highest sensitivity level
   */
  static resolveSupremum(items = [], defaultLevel = null) {
    if (!items || items.length === 0) {
      return defaultLevel || CLASSIFICATION_LEVELS.PUBLIC;
    }

    let maxWeight = defaultLevel && CLASSIFICATION_WEIGHTS[defaultLevel] ? CLASSIFICATION_WEIGHTS[defaultLevel] : 0;

    for (const item of items) {
      if (!item) continue;
      const raw = typeof item === "object" ? item.classification || item.sensitivity : item;
      if (!raw) continue;
      const normalized = String(raw).toUpperCase().trim();
      if (CLASSIFICATION_WEIGHTS.hasOwnProperty(normalized)) {
        const weight = CLASSIFICATION_WEIGHTS[normalized];
        if (weight > maxWeight) maxWeight = weight;
      } else {
        // Unknown or ambiguous classification treated conservatively as RESTRICTED (fail-closed)
        maxWeight = CLASSIFICATION_WEIGHTS.RESTRICTED;
      }
    }

    return CLASSIFICATION_ORDER[maxWeight] || CLASSIFICATION_LEVELS.PUBLIC;
  }

  /**
   * Automatically classifies newly processed documents from collector, stamps
   * classification metadata onto their storage JSON files, and logs audit events.
   *
   * @param {Array<Object>} documents - Documents array returned by CollectorApi.processDocument
   * @param {string} originalname - Original upload filename
   * @param {Object} metadata - Optional upload metadata
   * @param {number|string|null} userId - Requesting user ID
   */
  static async applyClassificationToProcessedDocs(
    documents = [],
    originalname = "",
    metadata = {},
    userId = null
  ) {
    const fs = require("fs");
    const path = require("path");
    const { EventLogs } = require("../../models/eventLogs");
    const documentsPath = process.env.STORAGE_DIR
      ? path.resolve(process.env.STORAGE_DIR, "documents")
      : path.resolve(__dirname, "../../storage/documents");

    for (const doc of documents) {
      if (!doc?.location) continue;
      const fullPath = path.resolve(documentsPath, doc.location);
      let pageContent = "";
      let existingData = {};

      if (fs.existsSync(fullPath)) {
        try {
          existingData = JSON.parse(fs.readFileSync(fullPath, "utf8"));
          pageContent = existingData.pageContent || "";
        } catch (e) {
          console.error(`[ClassificationService] Error reading ${fullPath}:`, e.message);
        }
      }

      const result = this.classifyDocument({
        filename: originalname || doc.name || path.basename(doc.location),
        content: pageContent,
        metadata: { ...existingData, ...metadata },
        userId,
      });

      // Stamp onto document in memory
      Object.assign(doc, result);

      // Stamp onto persistent storage JSON file
      if (fs.existsSync(fullPath)) {
        try {
          const updatedFile = {
            ...existingData,
            ...result,
          };
          fs.writeFileSync(fullPath, JSON.stringify(updatedFile, null, 2), "utf8");
        } catch (e) {
          console.error(`[ClassificationService] Error writing classification to ${fullPath}:`, e.message);
        }
      }

      // Record audit event
      await EventLogs.logEvent(
        "document_classified",
        {
          documentName: originalname || doc.name,
          docLocation: doc.location,
          classification: result.classification,
          confidence: result.confidence,
          method: result.classification_method,
          reasons: result.classification_reasons,
        },
        userId ? Number(userId) : null
      );
    }
  }

  /**
   * Human review and manual classification override.
   * Enforces role checks:
   * - Escalating sensitivity allowed for manager & admin.
   * - Downgrading sensitivity strictly requires admin role.
   *
   * @param {Object} params
   * @param {string} params.docpath - e.g. "custom-documents/report.json"
   * @param {string} params.newClassification - PUBLIC, INTERNAL, CONFIDENTIAL, or RESTRICTED
   * @param {string} params.reason - Justification for audit record
   * @param {Object} params.user - User object performing the override
   * @returns {Promise<{ success: boolean, error?: string, updatedDoc?: Object }>}
   */
  static async updateClassification({
    docpath = "",
    newClassification = "",
    reason = "",
    user = null,
  }) {
    const fs = require("fs");
    const path = require("path");
    const prisma = require("../prisma");
    const { EventLogs } = require("../../models/eventLogs");

    const normNew = String(newClassification || "").toUpperCase().trim();
    if (!CLASSIFICATION_WEIGHTS.hasOwnProperty(normNew)) {
      return { success: false, error: `Invalid classification level '${newClassification}'.` };
    }

    if (!reason || !reason.trim()) {
      return { success: false, error: "A valid justification reason is required for classification override." };
    }

    const userRole = user?.role || "default";

    // Role check: Only managers and admins can review/override classification
    if (!["admin", "manager"].includes(userRole)) {
      return {
        success: false,
        error: "Insufficient permissions. Admin privileges required to override or downgrade classification.",
      };
    }

    // Role check: Downgrade to PUBLIC or unclassified strictly requires Admin
    if (normNew === CLASSIFICATION_LEVELS.PUBLIC && userRole !== "admin") {
      return {
        success: false,
        error: "Admin privileges required to downgrade classification to PUBLIC.",
      };
    }

    const documentsPath = process.env.STORAGE_DIR
      ? path.resolve(process.env.STORAGE_DIR, "documents")
      : path.resolve(__dirname, "../../storage/documents");

    const fullPath = path.resolve(documentsPath, docpath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `Document file not found at '${docpath}'.` };
    }

    let docData;
    try {
      docData = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    } catch (e) {
      return { success: false, error: "Failed to parse document file." };
    }

    const prevClassification = docData.classification || CLASSIFICATION_LEVELS.INTERNAL;
    const prevWeight = CLASSIFICATION_WEIGHTS[prevClassification] ?? 1;
    const newWeight = CLASSIFICATION_WEIGHTS[normNew];

    // Downgrade check: strictly admin only
    if (newWeight < prevWeight && userRole !== "admin") {
      return {
        success: false,
        error: `Downgrading classification from ${prevClassification} to ${normNew} requires Administrator privilege.`,
      };
    }

    const overrideMetadata = {
      classification: normNew,
      confidence: 1.0,
      classification_method: "manual_override",
      classification_timestamp: new Date().toISOString(),
      classification_policy_version: POLICY_VERSION,
      classified_by: user ? `${user.username || user.id} (${userRole})` : "admin",
      classification_reasons: [
        `Manual override from ${prevClassification} to ${normNew}: ${reason.trim()}`,
      ],
    };

    // Update storage file
    const updatedDocData = { ...docData, ...overrideMetadata };
    fs.writeFileSync(fullPath, JSON.stringify(updatedDocData, null, 2), "utf8");

    // Update workspace_documents table if embedded
    try {
      const embeddedDocs = await prisma.workspace_documents.findMany({
        where: { docpath },
      });
      for (const embedded of embeddedDocs) {
        let meta = {};
        try {
          meta = JSON.parse(embedded.metadata || "{}");
        } catch {}
        meta = { ...meta, ...overrideMetadata };
        await prisma.workspace_documents.update({
          where: { id: embedded.id },
          data: { metadata: JSON.stringify(meta) },
        });
      }
    } catch (e) {
      console.error("[ClassificationService] Error syncing workspace_documents metadata:", e.message);
    }

    // Record audit event
    await EventLogs.logEvent(
      "classification_override",
      {
        docpath,
        previousClassification: prevClassification,
        newClassification: normNew,
        reason: reason.trim(),
        user: user?.username || user?.id,
        role: userRole,
      },
      user?.id ? Number(user.id) : null
    );

    return {
      success: true,
      error: null,
      updatedDoc: updatedDocData,
    };
  }

  /**
   * Compare two classifications.
   * Returns positive if a > b, negative if a < b, 0 if equal.
   */
  static compare(a, b) {
    const wa = CLASSIFICATION_WEIGHTS[String(a).toUpperCase()] ?? 1;
    const wb = CLASSIFICATION_WEIGHTS[String(b).toUpperCase()] ?? 1;
    return wa - wb;
  }
}

module.exports = {
  CLASSIFICATION_LEVELS,
  SENSITIVITY_LEVELS: CLASSIFICATION_LEVELS,
  CLASSIFICATION_ORDER,
  SENSITIVITY_HIERARCHY: CLASSIFICATION_ORDER,
  CLASSIFICATION_WEIGHTS,
  ClassificationService,
};
