/**
 * Sovereign Industrial AI Workbench — Centralized Policy Engine
 * (SIH PS 26117 on-premise governance & access control)
 *
 * Deterministic policy evaluator governing Models, Tools, Knowledge Sources (RAG),
 * and Actions based on data sensitivity levels: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED.
 */

const {
  CLASSIFICATION_LEVELS,
  CLASSIFICATION_WEIGHTS,
} = require("../classification");
const { EventLogs } = require("../../models/eventLogs");

const POLICY_DECISIONS = {
  ALLOW: "ALLOW",
  DENY: "DENY",
  REQUIRE_APPROVAL: "REQUIRE_APPROVAL",
};

const CAPABILITIES = {
  MODEL: "model",
  TOOL: "tool",
  KNOWLEDGE: "knowledge",
  ACTION: "action",
};

const ACTIONS = {
  EXPORT: "export",
  DELETE: "delete",
  SHARE: "share",
  MODIFY: "modify",
};

// Known local air-gapped providers (allowed for confidential/restricted sovereign processing)
const LOCAL_PROVIDERS = [
  "ollama",
  "lmstudio",
  "localai",
  "koboldcpp",
  "textgenwebui",
  "vllm",
  "native",
  "lancedb",
  "generic-openai", // when self-hosted
];

// Cloud / External providers strictly blocked from processing confidential or restricted industrial data
const CLOUD_PROVIDERS = [
  "openai",
  "anthropic",
  "gemini",
  "groq",
  "togetherai",
  "mistral",
  "perplexity",
  "openrouter",
  "cohere",
  "azure",
  "bedrock",
];

// Dangerous / external network tools blocked on sensitive data
const NETWORK_EGRESS_TOOLS = [
  "web-browsing",
  "web-scraping",
  "scrape",
  "fetch-url",
  "url",
  "http",
  "curl",
  "gmail",
  "outlook",
  "email",
  "google-calendar",
  "github",
  "webhook",
  "network",
];

// Unrestricted local tools
const LOCAL_SAFE_TOOLS = [
  "chat-history",
  "file-history",
  "memory",
  "rechart",
  "summarize",
  "request-user-input",
  "router-classifier",
  "model-router-cooldown",
  "websocket",
  "http-socket",
];

class PolicyEngine {
  /**
   * Central policy evaluation method.
   * Deterministic, explainable, and fails closed.
   *
   * @param {Object} context
   * @param {Object} [context.user] - Requesting user
   * @param {Object} [context.workspace] - Active workspace
   * @param {string} context.classification - Sensitivity level (PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED)
   * @param {'model'|'tool'|'knowledge'|'action'} context.requestedCapability - The capability to evaluate
   * @param {string|Object} [context.model] - Target model or provider object
   * @param {string} [context.tool] - Tool identifier or plugin name
   * @param {string} [context.action] - Action identifier ('export', 'share', 'delete', etc.)
   * @param {Object} [context.source] - Document or chunk metadata
   * @returns {{ decision: 'ALLOW'|'DENY'|'REQUIRE_APPROVAL', reason: string, policyRule: string, suggestedAction?: string }}
   */
  static evaluatePolicy(context = {}) {
    if (!context || typeof context !== "object") {
      return {
        allowed: false,
        effect: POLICY_DECISIONS.DENY,
        decision: POLICY_DECISIONS.DENY,
        reason: "Missing or invalid policy context. Security policy requires fail-closed denial.",
        policyRule: "SEC-POL-000: Invalid Context Fail-Closed",
        suggestedAction: "Provide a valid policy context object.",
      };
    }

    if (Object.keys(context).length === 0) {
      return {
        allowed: false,
        effect: POLICY_DECISIONS.DENY,
        decision: POLICY_DECISIONS.DENY,
        reason: "Empty policy context provided. Security policy requires fail-closed denial.",
        policyRule: "SEC-POL-000: Empty Context Fail-Closed",
        suggestedAction: "Provide a valid policy context object.",
      };
    }

    const {
      user = null,
      workspace = null,
      requestedCapability = "model",
      model = null,
      tool = null,
      action = null,
      source = null,
    } = context;

    // If classification is omitted or explicitly null, fail-closed to RESTRICTED
    const rawClass = context.classification !== undefined && context.classification !== null
      ? context.classification
      : CLASSIFICATION_LEVELS.RESTRICTED;

    const normClass = String(rawClass || CLASSIFICATION_LEVELS.RESTRICTED)
      .toUpperCase()
      .trim();

    // Security Gate 0: Validate classification level - Fail closed on invalid classification
    if (!CLASSIFICATION_WEIGHTS.hasOwnProperty(normClass)) {
      return {
        allowed: false,
        effect: POLICY_DECISIONS.DENY,
        decision: POLICY_DECISIONS.DENY,
        reason: `Invalid or corrupted classification '${rawClass}'. Security policy requires fail-closed denial.`,
        policyRule: "SEC-POL-000: Invalid Classification Fail-Closed",
        suggestedAction: "Re-classify the document with a recognized sensitivity tier.",
      };
    }

    let rawResult;
    switch (requestedCapability) {
      case "model":
        rawResult = this.#evaluateModelPolicy(normClass, model, user);
        break;
      case "tool":
        rawResult = this.#evaluateToolPolicy(normClass, tool, user);
        break;
      case "knowledge":
        rawResult = this.#evaluateKnowledgePolicy(normClass, source, user, model);
        break;
      case "action":
        rawResult = this.#evaluateActionPolicy(normClass, action, user, workspace);
        break;
      default:
        rawResult = {
          decision: POLICY_DECISIONS.DENY,
          reason: `Unknown capability '${requestedCapability}'. Unhandled capabilities are denied by default.`,
          policyRule: "SEC-POL-099: Unknown Capability Deny-By-Default",
        };
    }

    return {
      allowed: rawResult.decision === POLICY_DECISIONS.ALLOW,
      effect: rawResult.decision,
      ...rawResult,
    };
  }

  /**
   * Evaluate whether a model is authorized to process data of the given classification.
   */
  static #evaluateModelPolicy(classification, model, user) {
    const rawTarget = typeof model === "object"
      ? `${model?.provider || ""} ${model?.model || ""}`
      : String(model || "");
    const normTarget = rawTarget.toLowerCase().trim();

    const isCloud = CLOUD_PROVIDERS.some((cp) => normTarget.includes(cp));
    const isLocal = LOCAL_PROVIDERS.some((lp) => normTarget.includes(lp));

    // Rule 1: RESTRICTED Data — Explicit authorized local sovereign models only
    if (classification === CLASSIFICATION_LEVELS.RESTRICTED) {
      if (isCloud) {
        return {
          decision: POLICY_DECISIONS.DENY,
          reason: `External cloud model '${rawTarget}' is strictly forbidden from processing RESTRICTED sovereign assets.`,
          policyRule: "SEC-POL-101: Restricted Sovereign Air-Gap Model Isolation",
          suggestedAction: "Select an approved local on-premise model (e.g. Ollama, LM Studio).",
        };
      }
      if (!isLocal && normTarget !== "") {
        return {
          decision: POLICY_DECISIONS.DENY,
          reason: `Model provider '${rawTarget}' is not in the verified on-premise sovereign whitelist.`,
          policyRule: "SEC-POL-102: Restricted Model Whitelist Gate",
          suggestedAction: "Use a verified local open-weight model deployment.",
        };
      }
      return {
        decision: POLICY_DECISIONS.ALLOW,
        reason: `Local on-premise model '${rawTarget}' is authorized for RESTRICTED processing.`,
        policyRule: "SEC-POL-100: Authorized Sovereign Model Execution",
      };
    }

    // Rule 2: CONFIDENTIAL Data — Approved secure local models only
    if (classification === CLASSIFICATION_LEVELS.CONFIDENTIAL) {
      if (isCloud) {
        return {
          decision: POLICY_DECISIONS.DENY,
          reason: `Cloud provider '${rawTarget}' cannot receive CONFIDENTIAL industrial information without breaching data boundary.`,
          policyRule: "SEC-POL-110: Confidential Data External Exfiltration Prevention",
          suggestedAction: "Route this task to a verified on-premise LLM provider.",
        };
      }
      return {
        decision: POLICY_DECISIONS.ALLOW,
        reason: `Secure local provider '${rawTarget}' is permitted to process CONFIDENTIAL data.`,
        policyRule: "SEC-POL-111: Approved On-Premise Confidential Processing",
      };
    }

    // Rule 3: INTERNAL Data — Approved local models default
    if (classification === CLASSIFICATION_LEVELS.INTERNAL) {
      if (isCloud) {
        return {
          decision: POLICY_DECISIONS.REQUIRE_APPROVAL,
          reason: `Routing INTERNAL operational data to external provider '${rawTarget}' requires administrative approval.`,
          policyRule: "SEC-POL-120: Internal Data Egress Review Gate",
          suggestedAction: "Prefer local on-premise models or obtain manager approval.",
        };
      }
      return {
        decision: POLICY_DECISIONS.ALLOW,
        reason: `Model '${rawTarget}' is authorized for INTERNAL data.`,
        policyRule: "SEC-POL-121: Standard Internal Model Processing",
      };
    }

    // Rule 4: PUBLIC Data — All approved models allowed
    return {
      decision: POLICY_DECISIONS.ALLOW,
      reason: `PUBLIC unclassified data is permitted for processing across all configured models.`,
      policyRule: "SEC-POL-130: Public Data Model Access",
    };
  }

  /**
   * Evaluate whether a tool is permitted to execute given the data classification and user.
   */
  static #evaluateToolPolicy(classification, tool, user) {
    const toolName = String(tool || "").toLowerCase().trim().replace(/_/g, "-");

    // Rule 1: RESTRICTED Data — Strict local sandbox; external egress strictly blocked
    if (classification === CLASSIFICATION_LEVELS.RESTRICTED) {
      if (NETWORK_EGRESS_TOOLS.some((t) => toolName.includes(t))) {
        return {
          decision: POLICY_DECISIONS.DENY,
          reason: `Tool '${tool}' execution is denied: requires network egress, which is strictly prohibited for RESTRICTED data.`,
          policyRule: "SEC-POL-201: Restricted Air-Gap Tool Network Egress Barrier",
          suggestedAction: "Use local analysis or offline document reasoning tools only.",
        };
      }
      if (toolName.includes("cli") || toolName.includes("create-files")) {
        const isAdmin = ["admin"].includes(user?.role);
        if (!isAdmin) {
          return {
            decision: POLICY_DECISIONS.REQUIRE_APPROVAL,
            reason: `System write or execution tool '${tool}' on RESTRICTED data requires administrator clearance.`,
            policyRule: "SEC-POL-202: Restricted Host System Execution Gate",
            suggestedAction: "Contact an administrator to execute or review this action.",
          };
        }
      }
      return {
        decision: POLICY_DECISIONS.ALLOW,
        reason: `Tool '${tool}' operates in local air-gap mode and is allowed for RESTRICTED data.`,
        policyRule: "SEC-POL-200: Restricted Safe Local Tool Execution",
      };
    }

    // Rule 2: CONFIDENTIAL Data — No external web scraping or uncontrolled exfiltration
    if (classification === CLASSIFICATION_LEVELS.CONFIDENTIAL) {
      if (NETWORK_EGRESS_TOOLS.some((t) => toolName.includes(t))) {
        return {
          decision: POLICY_DECISIONS.DENY,
          reason: `External communication tool '${tool}' is denied and blocked while working with CONFIDENTIAL industrial assets.`,
          policyRule: "SEC-POL-210: Confidential Tool Egress Guard",
          suggestedAction: "Use local document reasoning or knowledge base search.",
        };
      }
      return {
        decision: POLICY_DECISIONS.ALLOW,
        reason: `Tool '${tool}' is authorized for CONFIDENTIAL data processing.`,
        policyRule: "SEC-POL-211: Confidential Safe Tool Execution",
      };
    }

    // Rule 3: INTERNAL / PUBLIC Data — Standard tool execution
    return {
      decision: POLICY_DECISIONS.ALLOW,
      reason: `Tool '${tool}' is authorized under organizational policy.`,
      policyRule: "SEC-POL-220: Standard Tool Authorization",
    };
  }

  /**
   * Evaluate whether retrieved RAG knowledge chunks are authorized for the active query session.
   */
  static #evaluateKnowledgePolicy(chunkClassification, source, user, model) {
    const chunkWeight = CLASSIFICATION_WEIGHTS[chunkClassification] ?? 1;
    const provider = typeof model === "object" ? model?.provider : String(model || "");
    const isCloud = CLOUD_PROVIDERS.includes(String(provider).toLowerCase());

    // Prevent cloud model from seeing confidential or restricted chunks
    if (isCloud && chunkWeight >= CLASSIFICATION_WEIGHTS.CONFIDENTIAL) {
      return {
        decision: POLICY_DECISIONS.DENY,
        reason: `Retrieved knowledge chunk is classified as ${chunkClassification} and cannot be exposed to external model '${provider}'.`,
        policyRule: "SEC-POL-301: RAG Confidentiality Boundary Defense",
      };
    }

    // Role-based clearance checks
    if (chunkClassification === CLASSIFICATION_LEVELS.RESTRICTED) {
      const userRole = user?.role || "default";
      if (!["admin", "manager"].includes(userRole)) {
        return {
          decision: POLICY_DECISIONS.DENY,
          reason: `RESTRICTED knowledge chunk requires manager or admin clearance. User role '${userRole}' is not authorized.`,
          policyRule: "SEC-POL-302: Restricted Knowledge Retrieval Clearance Gate",
        };
      }
    }

    return {
      decision: POLICY_DECISIONS.ALLOW,
      reason: `Knowledge chunk (${chunkClassification}) authorized for model and user context.`,
      policyRule: "SEC-POL-300: Knowledge Chunk Retrieval Authorized",
    };
  }

  /**
   * Evaluate user actions (export, share, delete, etc.) against sensitivity.
   */
  static #evaluateActionPolicy(classification, action, user, workspace) {
    const act = String(action || "").toLowerCase().trim();
    const userRole = user?.role || "default";

    if (act === "export" || act === "download") {
      if (classification === CLASSIFICATION_LEVELS.RESTRICTED) {
        if (userRole !== "admin") {
          return {
            decision: POLICY_DECISIONS.DENY,
            reason: `Direct export of RESTRICTED sovereign assets is prohibited for role '${userRole}'.`,
            policyRule: "SEC-POL-401: Restricted Asset Egress Ban",
            suggestedAction: "Only administrators can export restricted deliverables.",
          };
        }
        return {
          decision: POLICY_DECISIONS.REQUIRE_APPROVAL,
          reason: `Exporting RESTRICTED information requires dual administrator confirmation.`,
          policyRule: "SEC-POL-402: Restricted Export Dual-Control",
        };
      }

      if (classification === CLASSIFICATION_LEVELS.CONFIDENTIAL) {
        if (userRole === "default") {
          return {
            decision: POLICY_DECISIONS.REQUIRE_APPROVAL,
            reason: `Exporting CONFIDENTIAL industrial data requires manager approval.`,
            policyRule: "SEC-POL-410: Confidential Export Authorization",
          };
        }
      }

      return {
        decision: POLICY_DECISIONS.ALLOW,
        reason: `Export action authorized for ${classification} content.`,
        policyRule: "SEC-POL-420: Document Export Permitted",
      };
    }

    if (act === "delete") {
      if (classification === CLASSIFICATION_LEVELS.RESTRICTED && userRole !== "admin") {
        return {
          decision: POLICY_DECISIONS.DENY,
          reason: `Deleting RESTRICTED documents requires administrator role.`,
          policyRule: "SEC-POL-430: Restricted Deletion Protection",
        };
      }
      return {
        decision: POLICY_DECISIONS.ALLOW,
        reason: `Delete action authorized.`,
        policyRule: "SEC-POL-431: Document Deletion Permitted",
      };
    }

    if (act === "checkpoint_restore" || act === "restore") {
      if (classification === CLASSIFICATION_LEVELS.RESTRICTED) {
        if (!["admin", "manager"].includes(userRole)) {
          return {
            decision: POLICY_DECISIONS.DENY,
            reason: `Restoring RESTRICTED sovereign checkpoint requires manager or admin clearance. User role '${userRole}' is not authorized.`,
            policyRule: "SEC-POL-440: Restricted Checkpoint Restoration Clearance Gate",
            suggestedAction: "Contact an administrator or manager to restore this checkpoint.",
          };
        }
      }
      return {
        decision: POLICY_DECISIONS.ALLOW,
        reason: `Checkpoint restoration authorized for ${classification} content.`,
        policyRule: "SEC-POL-441: Checkpoint Restoration Permitted",
      };
    }

    return {
      decision: POLICY_DECISIONS.ALLOW,
      reason: `Action '${action}' authorized under standard workspace policy.`,
      policyRule: "SEC-POL-499: Default Action Permitted",
    };
  }

  /**
   * Helper: Check if a model is permitted for a given classification level.
   * Returns boolean for easy filtering in router loops.
   */
  static isModelPermitted(model, classification) {
    const result = this.evaluatePolicy({
      requestedCapability: "model",
      model,
      classification,
    });
    return result.decision === POLICY_DECISIONS.ALLOW;
  }

  /**
   * Helper: Check if a tool is permitted for a given classification level.
   * Returns boolean for easy filtering.
   */
  static isToolPermitted(tool, classification, user = null) {
    const result = this.evaluatePolicy({
      requestedCapability: "tool",
      tool,
      classification,
      user,
    });
    return result.decision === POLICY_DECISIONS.ALLOW;
  }

  /**
   * Returns the static policy governance matrix for administrative inspection.
   */
  static getPolicyGovernanceMatrix() {
    return [
      {
        tier: CLASSIFICATION_LEVELS.PUBLIC,
        label: "Public Release",
        color: "zinc",
        allowedModels: "All approved on-premise and configured models",
        allowedTools: "All standard tools (RAG, calculation, document reader, charting)",
        allowedActions: "Read, Export, Share, Embed, Index",
        approvalRequired: "None (Automatic Allow)",
        externalNetworkEgress: "Permitted",
      },
      {
        tier: CLASSIFICATION_LEVELS.INTERNAL,
        label: "Internal Operations",
        color: "sky",
        allowedModels: "Approved local open-weight models (Ollama, LM Studio, LocalAI)",
        allowedTools: "All local workspace tools and internal connectors",
        allowedActions: "Read, Workspace Search, Internal Collaboration",
        approvalRequired: "Manager approval required for external egress",
        externalNetworkEgress: "Review Required",
      },
      {
        tier: CLASSIFICATION_LEVELS.CONFIDENTIAL,
        label: "Confidential Industrial",
        color: "amber",
        allowedModels: "Verified secure on-premise local models only. Cloud models BLOCKED.",
        allowedTools: "Local document reasoning & RAG. Web scraping/browsing BLOCKED.",
        allowedActions: "Workspace internal querying, local deliverable generation. Export restricted.",
        approvalRequired: "Manager approval required for file export",
        externalNetworkEgress: "STRICTLY BLOCKED",
      },
      {
        tier: CLASSIFICATION_LEVELS.RESTRICTED,
        label: "Restricted Sovereign",
        color: "rose",
        allowedModels: "Explicitly authorized sovereign air-gapped models only. Zero cloud egress.",
        allowedTools: "Air-gapped sandboxed local reading & reasoning only. Network tools BLOCKED.",
        allowedActions: "Air-gapped on-premise indexing & query only. Direct export DENIED.",
        approvalRequired: "Administrator dual confirmation for all privileged actions",
        externalNetworkEgress: "AIR-GAP ENFORCED (ZERO EGRESS)",
      },
    ];
  }

  /**
   * Redact sensitive payload contents (document text, tokens) from security audit records
   * to guarantee zero text leakage in SQLite audit logs.
   */
  static sanitizeMetadataForAudit(metadata = {}) {
    if (!metadata || typeof metadata !== "object") return {};
    const sanitized = { ...metadata };
    delete sanitized.text;
    delete sanitized.fullText;
    delete sanitized.content;
    delete sanitized.prompt;
    delete sanitized.rawContent;
    delete sanitized.token;
    delete sanitized.secret;
    delete sanitized.password;
    delete sanitized.key;
    return sanitized;
  }
}

module.exports = {
  POLICY_DECISIONS,
  CAPABILITIES,
  ACTIONS,
  PolicyEngine,
  LOCAL_PROVIDERS,
  CLOUD_PROVIDERS,
  NETWORK_EGRESS_TOOLS,
};
