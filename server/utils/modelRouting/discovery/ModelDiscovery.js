const fs = require("fs");
const path = require("path");
const { TASK_TYPES, TRUST_STATUS } = require("../contracts/types");

/**
 * ModelDiscovery: Discovers models actually available in the local system/runtime
 * (Ollama, LM Studio, LocalAI, vLLM) and merges them with configurable metadata
 * from storage/models/model-profiles.json.
 */
class ModelDiscovery {
  static instance = null;
  static DEFAULT_REFRESH_SECONDS = 60; // 1 minute discovery refresh

  constructor() {
    if (ModelDiscovery.instance) return ModelDiscovery.instance;
    ModelDiscovery.instance = this;

    this.cachedModels = [];
    this.lastDiscoveredAt = 0;
    this.refreshMs =
      (Number(process.env.ROUTER_DISCOVERY_REFRESH_SECONDS) ||
        ModelDiscovery.DEFAULT_REFRESH_SECONDS) * 1000;
  }

  static getInstance() {
    if (!ModelDiscovery.instance) new ModelDiscovery();
    return ModelDiscovery.instance;
  }

  /**
   * Main discovery entry point.
   * Discovers models from running local runtimes and JSON config.
   * @param {boolean} [forceRefresh=false]
   * @returns {Promise<Array<Object>>} List of discovered ModelProfiles
   */
  async discover(forceRefresh = false) {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.cachedModels.length > 0 &&
      now - this.lastDiscoveredAt < this.refreshMs
    ) {
      return this.cachedModels;
    }

    const discoveredMap = new Map();

    // 1. Discover from Ollama if configured or default local port
    const ollamaModels = await this.#discoverOllamaModels();
    for (const model of ollamaModels) {
      discoveredMap.set(model.id, model);
    }

    // 2. Discover from OpenAI-compatible local endpoints (LM Studio, LocalAI, vLLM)
    const genericModels = await this.#discoverOpenAiCompatibleModels();
    for (const model of genericModels) {
      discoveredMap.set(model.id, model);
    }

    // 3. Load user / admin overrides and definitions from storage/models/model-profiles.json
    const configuredModels = this.#loadConfiguredProfiles();
    for (const config of configuredModels) {
      if (!config.id) continue;
      if (discoveredMap.has(config.id)) {
        // Merge configuration over discovered telemetry
        const existing = discoveredMap.get(config.id);
        discoveredMap.set(config.id, {
          ...existing,
          ...config,
          capabilities: { ...existing.capabilities, ...config.capabilities },
          resourceRequirements: {
            ...existing.resourceRequirements,
            ...config.resourceRequirements,
          },
        });
      } else {
        // Custom user-defined model profile
        discoveredMap.set(config.id, this.normalizeProfile(config));
      }
    }

    this.cachedModels = Array.from(discoveredMap.values());
    this.lastDiscoveredAt = now;

    return this.cachedModels;
  }

  /**
   * Discovers models from Ollama runtime.
   */
  async #discoverOllamaModels() {
    try {
      const { Ollama } = require("ollama");
      const basePath = process.env.OLLAMA_BASE_PATH || "http://127.0.0.1:11434";
      const authToken = process.env.OLLAMA_AUTH_TOKEN;

      const client = new Ollama({
        host: basePath,
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });

      // Quick timeout to avoid hanging if Ollama is offline
      const listPromise = client.list().catch(() => ({ models: [] }));
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve({ models: [] }), 2000),
      );
      const { models = [] } = await Promise.race([listPromise, timeoutPromise]);

      if (!Array.isArray(models) || models.length === 0) return [];

      const profiles = [];
      for (const m of models) {
        if (!m.name) continue;
        let showInfo = {};
        try {
          showInfo = await client.show({ model: m.name });
        } catch {
          // ignore individual show failures
        }

        const profile = this.inferProfile({
          name: m.name,
          size: m.size,
          details: m.details || showInfo.details,
          capabilities: showInfo.capabilities || [],
          model_info: showInfo.model_info || {},
          runtime: "ollama",
        });

        profiles.push(profile);
      }

      return profiles;
    } catch {
      return [];
    }
  }

  /**
   * Discovers models from OpenAI-compatible local runtimes (LM Studio, LocalAI, vLLM).
   */
  async #discoverOpenAiCompatibleModels() {
    const endpoints = [
      {
        url: process.env.LMSTUDIO_BASE_PATH,
        runtime: "lmstudio",
        provider: "lmstudio",
      },
      {
        url: process.env.LOCAL_AI_BASE_PATH,
        runtime: "localai",
        provider: "localai",
      },
      {
        url: process.env.GENERIC_OPEN_AI_BASE_PATH,
        runtime: "generic-openai",
        provider: "generic-openai",
      },
    ].filter((e) => Boolean(e.url));

    const profiles = [];

    for (const ep of endpoints) {
      try {
        const baseUrl = ep.url.replace(/\/+$/, "");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        const res = await fetch(`${baseUrl}/models`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) continue;
        const json = await res.json();
        const modelList = Array.isArray(json.data) ? json.data : [];

        for (const item of modelList) {
          const id = item.id || item.name;
          if (!id) continue;
          profiles.push(
            this.inferProfile({
              name: id,
              runtime: ep.runtime,
              provider: ep.provider,
            }),
          );
        }
      } catch {
        // ignore offline endpoints
      }
    }

    return profiles;
  }

  /**
   * Loads custom profiles and overrides from JSON file if present.
   */
  #loadConfiguredProfiles() {
    const storageDir =
      process.env.STORAGE_DIR || path.resolve(__dirname, "../../../../storage");
    const filePath =
      process.env.ROUTER_MODEL_PROFILES_PATH ||
      path.resolve(storageDir, "models", "model-profiles.json");

    if (!fs.existsSync(filePath)) return [];

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Automatically infers capabilities, resource requirements, context length,
   * and taxonomy affinity from model name, metadata, and Ollama show inspection.
   *
   * @param {Object} input
   * @returns {Object} Normalized ModelProfile
   */
  inferProfile({
    name,
    size = 0,
    details = {},
    capabilities = [],
    model_info = {},
    runtime = "ollama",
    provider = "ollama",
  }) {
    const nameLower = String(name).toLowerCase();
    const family = String(details.family || "").toLowerCase();
    const families = Array.isArray(details.families)
      ? details.families.map((f) => String(f).toLowerCase())
      : [];

    // 1. Capabilities Inference
    const hasVision =
      capabilities.includes("vision") ||
      /\b(vl|vision|llava|bakllava|moondream|minicpm-v|pixtral|qwen2-vl)\b/i.test(
        nameLower,
      ) ||
      families.includes("clip") ||
      family.includes("mllama");

    const hasCode =
      /\b(coder|code|starcoder|codellama|deepseek-coder|dev)\b/i.test(
        nameLower,
      ) ||
      family.includes("starcoder") ||
      family.includes("code");

    const hasReasoning =
      capabilities.includes("thinking") ||
      /\b(r1|qwq|reason|deepseek-r1|thinking)\b/i.test(nameLower);

    const hasToolUse =
      capabilities.includes("tools") ||
      /\b(instruct|tool|function|hermes|command)\b/i.test(nameLower);

    // 2. Context Length Discovery
    let contextLength = 8192;
    const contextKey = Object.keys(model_info || {}).find((k) =>
      k.endsWith(".context_length"),
    );
    if (contextKey && Number(model_info[contextKey]) > 0) {
      contextLength = Number(model_info[contextKey]);
    } else if (hasReasoning || hasCode || hasVision) {
      contextLength = 32768;
    }

    const hasLongContext = contextLength >= 32768;

    // 3. Parameter Size & Resource Requirements Estimation
    const paramMatch =
      (details.parameter_size && String(details.parameter_size)) ||
      nameLower.match(/\b(\d+)[bB]\b/)?.[0] ||
      "";
    const paramNum = parseFloat(paramMatch);

    let minRamGb = 8;
    let minVramGb = 5;

    if (!isNaN(paramNum) && paramNum > 0) {
      if (paramNum <= 3) {
        minRamGb = 4;
        minVramGb = 2;
      } else if (paramNum <= 8) {
        minRamGb = 8;
        minVramGb = 5;
      } else if (paramNum <= 14) {
        minRamGb = 12;
        minVramGb = 8;
      } else if (paramNum <= 35) {
        minRamGb = 24;
        minVramGb = 16;
      } else {
        minRamGb = 48;
        minVramGb = 32;
      }
    } else if (size > 0) {
      const sizeGb = size / 1024 ** 3;
      if (sizeGb <= 3) {
        minRamGb = 4;
        minVramGb = 2;
      } else if (sizeGb <= 6) {
        minRamGb = 8;
        minVramGb = 5;
      } else if (sizeGb <= 10) {
        minRamGb = 12;
        minVramGb = 8;
      } else {
        minRamGb = 24;
        minVramGb = 16;
      }
    }

    // 4. Inferred Category
    let category = "general";
    if (hasVision) category = "vision";
    else if (hasCode) category = "code";
    else if (hasReasoning) category = "reasoning";

    // 5. Inferred Task Affinity
    const taskAffinity = {
      [TASK_TYPES.TEXT_QA]: 0.85,
      [TASK_TYPES.DOCUMENT_SUMMARY]: 0.85,
    };
    if (hasVision) taskAffinity[TASK_TYPES.MULTIMODAL_ANALYSIS] = 1.0;
    if (hasCode) {
      taskAffinity[TASK_TYPES.CODE_GENERATION] = 1.0;
      taskAffinity[TASK_TYPES.CODE_REVIEW] = 1.0;
    }
    if (hasReasoning) {
      taskAffinity[TASK_TYPES.GENERAL_REASONING] = 1.0;
      taskAffinity[TASK_TYPES.CALCULATION] = 0.95;
    }

    // Dynamic priority calculation based on capability richness
    let priority = 75;
    if (hasVision) priority += 10;
    if (hasCode) priority += 10;
    if (hasReasoning) priority += 10;

    return {
      id: String(name),
      displayName: `${name} (${category.toUpperCase()})`,
      runtime,
      provider,
      model: String(name),
      category,
      capabilities: {
        text: true,
        vision: hasVision,
        code: hasCode,
        toolUse: hasToolUse,
        reasoning: hasReasoning,
        longContext: hasLongContext,
      },
      contextLength,
      resourceRequirements: {
        minRamGb,
        minVramGb,
        recommendedVramGb: minVramGb + 2,
      },
      sensitivityAccess: ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"],
      allowedRoles: ["default", "admin", "manager"],
      trustStatus: TRUST_STATUS.APPROVED,
      enabled: true,
      priority,
      taskAffinity,
      discoveredAt: new Date().toISOString(),
    };
  }

  normalizeProfile(profile) {
    return {
      id: String(profile.id),
      displayName: profile.displayName || profile.id,
      runtime: profile.runtime || "ollama",
      provider: profile.provider || profile.runtime || "ollama",
      model: profile.model || profile.id,
      category: profile.category || "general",
      capabilities: {
        text: profile.capabilities?.text ?? true,
        vision: profile.capabilities?.vision ?? false,
        code: profile.capabilities?.code ?? false,
        toolUse: profile.capabilities?.toolUse ?? false,
        reasoning: profile.capabilities?.reasoning ?? false,
        longContext: profile.capabilities?.longContext ?? false,
      },
      contextLength: Number(profile.contextLength) || 8192,
      resourceRequirements: {
        minRamGb: Number(profile.resourceRequirements?.minRamGb) || 8,
        minVramGb: Number(profile.resourceRequirements?.minVramGb) || 0,
        recommendedVramGb:
          Number(profile.resourceRequirements?.recommendedVramGb) ||
          Number(profile.resourceRequirements?.minVramGb) ||
          0,
      },
      sensitivityAccess: Array.isArray(profile.sensitivityAccess)
        ? profile.sensitivityAccess.map((s) => String(s).toUpperCase())
        : ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"],
      allowedRoles: Array.isArray(profile.allowedRoles)
        ? profile.allowedRoles
        : ["default", "admin", "manager"],
      trustStatus: profile.trustStatus || TRUST_STATUS.APPROVED,
      enabled: profile.enabled !== false,
      priority: Number(profile.priority) || 75,
      taskAffinity: profile.taskAffinity || {},
    };
  }
}

module.exports = { ModelDiscovery };
