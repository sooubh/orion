const { DEFAULT_MODEL_PROFILES } = require("./defaultProfiles");
const { ModelDiscovery } = require("../discovery/ModelDiscovery");
const { TRUST_STATUS } = require("../contracts/types");

class ModelRegistry {
  static instance = null;

  constructor() {
    if (ModelRegistry.instance) return ModelRegistry.instance;
    ModelRegistry.instance = this;

    this.models = new Map();
    this.discoveryService = ModelDiscovery.getInstance();
    this.hasDiscovered = false;
    this.initDefaults();
  }

  static getInstance() {
    if (!ModelRegistry.instance) new ModelRegistry();
    return ModelRegistry.instance;
  }

  initDefaults() {
    for (const profile of DEFAULT_MODEL_PROFILES) {
      this.register(profile);
    }
  }

  /**
   * Register or update a model profile.
   * @param {Object} profile
   * @returns {boolean}
   */
  register(profile) {
    if (!profile || !profile.id) {
      throw new Error("Model profile must have a valid 'id'.");
    }

    const normalized = {
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
      source: profile.source || "registry",
    };

    this.models.set(normalized.id, normalized);
    return true;
  }

  unregister(id) {
    return this.models.delete(id);
  }

  get(id) {
    return this.models.get(id) || null;
  }

  getAll() {
    return Array.from(this.models.values());
  }

  getApprovedEnabled() {
    return this.getAll().filter(
      (m) => m.enabled && m.trustStatus === TRUST_STATUS.APPROVED,
    );
  }

  /**
   * Refreshes model pool from active local runtime and storage config.
   * If local runtime returns models, they are registered as active candidates.
   * @param {boolean} [force=false]
   * @returns {Promise<Array<Object>>}
   */
  async refreshFromRuntime(force = false) {
    const discovered = await this.discoveryService.discover(force);
    if (Array.isArray(discovered) && discovered.length > 0) {
      for (const model of discovered) {
        this.register(model);
      }
      this.hasDiscovered = true;
    }
    return this.getAll();
  }

  /**
   * Returns all available candidate models, querying runtime if not yet discovered.
   * @param {Object} [opts]
   * @param {boolean} [opts.forceRefresh=false]
   * @returns {Promise<Array<Object>>}
   */
  async getAvailableModels({ forceRefresh = false } = {}) {
    if (!this.hasDiscovered || forceRefresh) {
      await this.refreshFromRuntime(forceRefresh);
    }
    return this.getAll();
  }

  clear() {
    this.models.clear();
    this.hasDiscovered = true;
  }

  reset() {
    this.models.clear();
    this.hasDiscovered = false;
    this.initDefaults();
  }
}

module.exports = { ModelRegistry };
