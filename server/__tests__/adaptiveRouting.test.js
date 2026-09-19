const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  AdaptiveModelRouter,
  OrionContextAdapter,
  ModelRegistry,
  ModelDiscovery,
  HardwareProfiler,
} = require("../utils/modelRouting");
const { TASK_TYPES, TRUST_STATUS } = require("../utils/modelRouting/contracts/types");
const { CandidateFilter } = require("../utils/modelRouting/filter/CandidateFilter");
const { TaskClassifier } = require("../utils/modelRouting/classifier/TaskClassifier");

describe("ORION Adaptive Model Router — Dynamic Model Routing Test Suite", () => {
  let router;
  let registry;

  const ADEQUATE_HARDWARE = {
    cpuCores: 16,
    cpuModel: "Mock CPU",
    systemRamGb: 32,
    availableRamGb: 24,
    isGpuAvailable: true,
    gpuName: "NVIDIA RTX 4090",
    gpuVramGb: 24,
    availableVramGb: 18,
    source: "mock",
  };

  const CONSTRAINED_VRAM_HARDWARE = {
    cpuCores: 8,
    cpuModel: "Mock CPU",
    systemRamGb: 16,
    availableRamGb: 10,
    isGpuAvailable: true,
    gpuName: "NVIDIA RTX 3060",
    gpuVramGb: 6,
    availableVramGb: 4,
    source: "mock",
  };

  const ZERO_GPU_HARDWARE = {
    cpuCores: 4,
    cpuModel: "Mock CPU",
    systemRamGb: 8,
    availableRamGb: 4,
    isGpuAvailable: false,
    gpuName: "None (CPU Only)",
    gpuVramGb: 0,
    availableVramGb: 0,
    source: "mock",
  };

  beforeEach(() => {
    registry = ModelRegistry.getInstance();
    registry.reset();
    router = AdaptiveModelRouter.getInstance();
  });

  // ─── TEST 1: Text Summary (Validating capabilities & eligibility) ──────────
  it("Test 1 — Text summary on internal data routes to an eligible text-capable model", async () => {
    const routingContext = {
      task: {
        type: TASK_TYPES.DOCUMENT_SUMMARY,
        complexity: "LOW",
        requiresVision: false,
        requiresCode: false,
        requiresLongContext: false,
        requiresTools: false,
        estimatedTokens: 2000,
      },
      data: { sensitivity: "INTERNAL" },
      user: { userId: "user-1", role: "default" },
      hardware: ADEQUATE_HARDWARE,
      permissions: { allowedModelIds: null, deniedModelIds: [] },
    };

    const decision = await router.route(routingContext);
    assert.strictEqual(decision.status, "SELECTED");
    assert.ok(decision.selectedModel, "Selected model must exist");

    // Validate capability & clearance dynamically rather than hardcoding names
    const profile = registry.get(decision.selectedModel.id);
    assert.ok(profile, "Selected profile must exist in registry");
    assert.strictEqual(profile.capabilities.text, true, "Model must support text");
    assert.ok(
      profile.sensitivityAccess.includes("INTERNAL"),
      "Model must have INTERNAL clearance"
    );
    assert.strictEqual(profile.trustStatus, "approved");
    assert.strictEqual(profile.enabled, true);
    assert.ok(decision.selectedModel.score > 0.7);
    assert.strictEqual(decision.externalFallbackAllowed, false);
  });

  // ─── TEST 2: Code Review (Validating code capability) ──────────────────────
  it("Test 2 — Code review task strictly selects an eligible code-capable model", async () => {
    const routingContext = {
      task: {
        type: TASK_TYPES.CODE_REVIEW,
        complexity: "MEDIUM",
        requiresVision: false,
        requiresCode: true,
        requiresLongContext: false,
        requiresTools: false,
        estimatedTokens: 3500,
      },
      data: { sensitivity: "INTERNAL" },
      user: { userId: "dev-1", role: "default" },
      hardware: ADEQUATE_HARDWARE,
      permissions: { allowedModelIds: null, deniedModelIds: [] },
    };

    const decision = await router.route(routingContext);
    assert.strictEqual(decision.status, "SELECTED");

    // Validate code capability
    const profile = registry.get(decision.selectedModel.id);
    assert.ok(profile, "Selected profile must exist");
    assert.strictEqual(
      profile.capabilities.code,
      true,
      "Selected model must have code capability"
    );
    assert.ok(
      profile.sensitivityAccess.includes("INTERNAL"),
      "Selected model must have INTERNAL clearance"
    );

    // Verify non-code models were rejected
    assert.ok(
      decision.alternatives.some((a) => a.rejectedBecause?.includes("code")),
      "Models without code capability must be rejected"
    );
  });

  // ─── TEST 3: Scanned Document (Validating vision capability) ───────────────
  it("Test 3 — Scanned document with vision requirement routes to approved vision-capable model", async () => {
    const routingContext = {
      task: {
        type: TASK_TYPES.MULTIMODAL_ANALYSIS,
        complexity: "MEDIUM",
        requiresVision: true,
        requiresCode: false,
        requiresLongContext: false,
        requiresTools: false,
        estimatedTokens: 2500,
      },
      data: { sensitivity: "CONFIDENTIAL" },
      user: { userId: "analyst-1", role: "default" },
      hardware: ADEQUATE_HARDWARE,
      permissions: { allowedModelIds: null, deniedModelIds: [] },
    };

    const decision = await router.route(routingContext);
    assert.strictEqual(decision.status, "SELECTED");

    // Validate vision capability & clearance
    const profile = registry.get(decision.selectedModel.id);
    assert.ok(profile, "Selected profile must exist");
    assert.strictEqual(
      profile.capabilities.vision,
      true,
      "Selected model must have vision capability"
    );
    assert.ok(
      profile.sensitivityAccess.includes("CONFIDENTIAL"),
      "Selected model must support CONFIDENTIAL sensitivity"
    );
  });

  // ─── TEST 4: Permission Denial (Validating permission enforcement) ────────
  it("Test 4 — Model explicitly denied by permission policy is excluded from selection", async () => {
    // Add a high-priority candidate
    const deniedModelId = "org-specialized-coder-test";
    registry.register({
      id: deniedModelId,
      displayName: "Org Specialized Coder",
      runtime: "ollama",
      capabilities: { text: true, code: true, reasoning: true },
      contextLength: 16384,
      resourceRequirements: { minRamGb: 8, minVramGb: 4 },
      sensitivityAccess: ["INTERNAL", "CONFIDENTIAL"],
      trustStatus: TRUST_STATUS.APPROVED,
      enabled: true,
      priority: 99, // Highest priority
    });

    const routingContext = {
      task: {
        type: TASK_TYPES.CODE_GENERATION,
        complexity: "MEDIUM",
        requiresVision: false,
        requiresCode: true,
      },
      data: { sensitivity: "INTERNAL" },
      user: { userId: "user-restricted", role: "default" },
      hardware: ADEQUATE_HARDWARE,
      permissions: {
        allowedModelIds: null,
        deniedModelIds: [deniedModelId], // Explicit denial
      },
    };

    const decision = await router.route(routingContext);
    assert.strictEqual(decision.status, "SELECTED");
    assert.notStrictEqual(decision.selectedModel.id, deniedModelId);

    const deniedTrace = decision.alternatives.find(
      (a) => a.modelId === deniedModelId
    );
    assert.ok(
      deniedTrace && deniedTrace.rejectedBecause.includes("permission policy")
    );
  });

  // ─── TEST 5: Insufficient VRAM (Hardware feasibility) ──────────────────────
  it("Test 5 — Model requiring more VRAM than available is excluded to prevent OOM", async () => {
    registry.clear();
    registry.register({
      id: "ultra-dense-model:70b",
      displayName: "Ultra Dense 70B",
      runtime: "ollama",
      capabilities: { text: true, vision: true, code: true, reasoning: true },
      contextLength: 32768,
      resourceRequirements: { minRamGb: 32, minVramGb: 24 },
      sensitivityAccess: ["CONFIDENTIAL"],
      trustStatus: TRUST_STATUS.APPROVED,
      enabled: true,
    });

    const routingContext = {
      task: {
        type: TASK_TYPES.MULTIMODAL_ANALYSIS,
        requiresVision: true,
      },
      data: { sensitivity: "CONFIDENTIAL" },
      user: { userId: "user-1", role: "default" },
      hardware: CONSTRAINED_VRAM_HARDWARE, // 4GB available VRAM
    };

    const decision = await router.route(routingContext);
    assert.strictEqual(decision.status, "NO_ELIGIBLE_MODEL");
    assert.strictEqual(decision.externalFallbackAllowed, false);
    assert.strictEqual(decision.selectedModel, undefined);
  });

  // ─── TEST 6: Sensitive Data Exclusion (Zero downgrade rule) ───────────────
  it("Test 6 — Restricted data excludes models that only support Public/Internal", async () => {
    registry.clear();
    registry.register({
      id: "unclassified-internal-model",
      displayName: "Internal Only Model",
      runtime: "ollama",
      capabilities: { text: true, vision: false, code: false, reasoning: false },
      contextLength: 8192,
      resourceRequirements: { minRamGb: 4, minVramGb: 0 },
      sensitivityAccess: ["PUBLIC", "INTERNAL"],
      trustStatus: TRUST_STATUS.APPROVED,
      enabled: true,
    });

    const routingContext = {
      task: { type: TASK_TYPES.TEXT_QA },
      data: { sensitivity: "RESTRICTED" },
      user: { userId: "user-1", role: "default" },
      hardware: ADEQUATE_HARDWARE,
    };

    const decision = await router.route(routingContext);
    assert.strictEqual(decision.status, "NO_ELIGIBLE_MODEL");
    assert.ok(
      decision.alternatives.some(
        (a) => a.modelId === "unclassified-internal-model" && a.rejectedBecause.includes("sensitivity")
      )
    );
  });

  // ─── TEST 7: No Eligible Model (Fail-closed guarantee) ─────────────────────
  it("Test 7 — When no model meets requirements, router fails closed with structured error and no external fallback", async () => {
    registry.clear();

    const routingContext = {
      task: {
        type: TASK_TYPES.MULTIMODAL_ANALYSIS,
        requiresVision: true,
        requiresCode: true,
      },
      data: { sensitivity: "RESTRICTED" },
      user: { userId: "user-1", role: "default" },
      hardware: ZERO_GPU_HARDWARE,
    };

    const decision = await router.route(routingContext);
    assert.strictEqual(decision.status, "NO_ELIGIBLE_MODEL");
    assert.strictEqual(decision.externalFallbackAllowed, false);
    assert.strictEqual(decision.selectedModel, undefined);
    assert.ok(typeof decision.reason === "string" && decision.reason.length > 0);
  });

  // ─── TEST 8: Model Disabled ────────────────────────────────────────────────
  it("Test 8 — Administratively disabled model is never selected", async () => {
    registry.clear();
    registry.register({
      id: "disabled-test-model",
      displayName: "Disabled Test Model",
      runtime: "ollama",
      capabilities: { text: true, vision: true, code: true, reasoning: true },
      contextLength: 8192,
      resourceRequirements: { minRamGb: 4, minVramGb: 2 },
      sensitivityAccess: ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"],
      trustStatus: TRUST_STATUS.DISABLED,
      enabled: false,
    });

    const routingContext = {
      task: { type: TASK_TYPES.TEXT_QA },
      data: { sensitivity: "INTERNAL" },
      user: { userId: "user-1", role: "default" },
      hardware: ADEQUATE_HARDWARE,
    };

    const decision = await router.route(routingContext);
    assert.strictEqual(decision.status, "NO_ELIGIBLE_MODEL");
    assert.notStrictEqual(decision.selectedModel?.id, "disabled-test-model");
  });

  // ─── TEST 9: Deterministic Behavior ────────────────────────────────────────
  it("Test 9 — Identical routing contexts yield identical decisions across 20 iterations", async () => {
    const routingContext = {
      task: {
        type: TASK_TYPES.DOCUMENT_SUMMARY,
        complexity: "LOW",
        requiresVision: false,
        requiresCode: false,
        estimatedTokens: 1500,
      },
      data: { sensitivity: "INTERNAL" },
      user: { userId: "user-1", role: "default" },
      hardware: ADEQUATE_HARDWARE,
    };

    const initial = await router.route(routingContext);
    assert.strictEqual(initial.status, "SELECTED");

    for (let i = 0; i < 20; i++) {
      const run = await router.route(routingContext);
      assert.strictEqual(run.status, initial.status);
      assert.strictEqual(run.selectedModel.id, initial.selectedModel.id);
      assert.strictEqual(run.selectedModel.score, initial.selectedModel.score);
      assert.deepStrictEqual(run.reasoning, initial.reasoning);
    }
  });

  // ─── TEST 10: Existing Workflow Regression ─────────────────────────────────
  it("Test 10 — Standard workspaces without routing remain unaffected (backward compatibility)", () => {
    const legacyWorkspace = {
      chatProvider: "openai",
      chatModel: "gpt-4o",
      router_id: null,
    };

    const isRouted =
      legacyWorkspace.chatProvider === "orion-router" ||
      legacyWorkspace.chatProvider === "adaptive-router";

    assert.strictEqual(isRouted, false);
    const result = {
      provider: legacyWorkspace.chatProvider,
      model: legacyWorkspace.chatModel,
      routingMetadata: null,
    };
    assert.strictEqual(result.routingMetadata, null);
    assert.strictEqual(result.provider, "openai");
  });

  // ─── TEST 11: Dynamic Addition & Removal of Models ─────────────────────────
  it("Test 11 — Adding and removing local models dynamically changes selection without modifying router logic", async () => {
    registry.clear();

    // Model 1: General lightweight model
    registry.register({
      id: "general-fast-worker:3b",
      displayName: "General Fast Worker 3B",
      runtime: "ollama",
      capabilities: { text: true, code: false, vision: false, reasoning: false },
      contextLength: 8192,
      resourceRequirements: { minRamGb: 4, minVramGb: 2 },
      sensitivityAccess: ["INTERNAL"],
      trustStatus: TRUST_STATUS.APPROVED,
      enabled: true,
      priority: 60,
    });

    const codeContext = {
      task: { type: TASK_TYPES.CODE_REVIEW, requiresCode: true },
      data: { sensitivity: "INTERNAL" },
      user: { role: "default" },
      hardware: ADEQUATE_HARDWARE,
    };

    // Before code model is added: must fail closed because no model has code capability
    const initialDecision = await router.route(codeContext);
    assert.strictEqual(initialDecision.status, "NO_ELIGIBLE_MODEL");

    // Dynamically pull / register a new code model into local runtime
    const newCodeModelId = "enterprise-security-coder:7b";
    registry.register({
      id: newCodeModelId,
      displayName: "Enterprise Security Coder 7B",
      runtime: "ollama",
      capabilities: { text: true, code: true, reasoning: true },
      contextLength: 32768,
      resourceRequirements: { minRamGb: 8, minVramGb: 5 },
      sensitivityAccess: ["INTERNAL", "CONFIDENTIAL"],
      trustStatus: TRUST_STATUS.APPROVED,
      enabled: true,
      priority: 95,
    });

    // Re-evaluate: router immediately discovers and selects the new model
    const secondDecision = await router.route(codeContext);
    assert.strictEqual(secondDecision.status, "SELECTED");
    assert.strictEqual(secondDecision.selectedModel.id, newCodeModelId);

    // Dynamically remove / unload the model
    registry.unregister(newCodeModelId);

    // Re-evaluate: router fails closed again without needing any code or configuration change
    const thirdDecision = await router.route(codeContext);
    assert.strictEqual(thirdDecision.status, "NO_ELIGIBLE_MODEL");
  });

  // ─── TEST 12: Model Discovery & Dynamic Profile Inference ──────────────────
  it("Test 12 — ModelDiscovery automatically infers capabilities, VRAM, and context length from arbitrary metadata", () => {
    const discovery = ModelDiscovery.getInstance();

    // Vision model inference from name & capabilities
    const visionProfile = discovery.inferProfile({
      name: "custom-inspection-vision:8b",
      size: 4.8 * 1024 ** 3,
      capabilities: ["vision"],
      details: { parameter_size: "8B", family: "mllama" },
    });
    assert.strictEqual(visionProfile.capabilities.vision, true);
    assert.strictEqual(visionProfile.capabilities.code, false);
    assert.strictEqual(visionProfile.category, "vision");
    assert.strictEqual(visionProfile.resourceRequirements.minVramGb, 5);

    // Code model inference
    const codeProfile = discovery.inferProfile({
      name: "custom-starcoder-dev:14b",
      details: { parameter_size: "14B", family: "starcoder" },
    });
    assert.strictEqual(codeProfile.capabilities.code, true);
    assert.strictEqual(codeProfile.category, "code");
    assert.strictEqual(codeProfile.resourceRequirements.minVramGb, 8);

    // Reasoning model inference
    const reasoningProfile = discovery.inferProfile({
      name: "deep-thinker-r1:32b",
      capabilities: ["thinking"],
      details: { parameter_size: "32B" },
    });
    assert.strictEqual(reasoningProfile.capabilities.reasoning, true);
    assert.strictEqual(reasoningProfile.category, "reasoning");
    assert.strictEqual(reasoningProfile.resourceRequirements.minVramGb, 16);
  });

  // ─── INTEGRATION TESTS: resolveProviderConnector ───────────────────────────
  it("resolveProviderConnector returns unrouted connector for legacy workspace", async () => {
    process.env.OLLAMA_BASE_PATH = process.env.OLLAMA_BASE_PATH || "http://127.0.0.1:11434";
    const { resolveProviderConnector } = require("../utils/helpers");
    const legacyWorkspace = {
      id: 999,
      slug: "legacy-test-space",
      chatProvider: "ollama",
      chatModel: "llama3:latest",
    };

    const result = await resolveProviderConnector({
      workspace: legacyWorkspace,
      prompt: "Hello legacy space",
    });

    assert.ok(result.connector, "Connector must be returned");
    assert.strictEqual(result.routingMetadata, null);
  });

  it("resolveProviderConnector dynamically routes when chatProvider is 'adaptive-router'", async () => {
    process.env.OLLAMA_BASE_PATH = process.env.OLLAMA_BASE_PATH || "http://127.0.0.1:11434";
    process.env.ROUTER_HW_OVERRIDE_GPU_VRAM_GB = "24";
    process.env.ROUTER_HW_OVERRIDE_SYSTEM_RAM_GB = "32";
    await HardwareProfiler.getInstance().getProfile(true);

    const { resolveProviderConnector } = require("../utils/helpers");
    const adaptiveWorkspace = {
      id: 998,
      slug: "adaptive-test-space",
      chatProvider: "adaptive-router",
      defaultSensitivity: "INTERNAL",
    };

    const result = await resolveProviderConnector({
      workspace: adaptiveWorkspace,
      prompt: "Review Python code for memory leaks: def leaky(): pass",
      chatHistoryOverride: { rawHistory: [], chatHistory: [] },
      messageCountOverride: 1,
    });

    assert.ok(result.connector, "Connector must be returned");
    assert.ok(result.routingMetadata, "Routing metadata must exist");
    assert.strictEqual(result.routingMetadata.routedTo.ruleType, "adaptive");
    assert.strictEqual(result.routingMetadata.decision.status, "SELECTED");

    // Validate capability & eligibility dynamically
    const selectedProfile = registry.get(result.routingMetadata.decision.selectedModel.id);
    assert.ok(selectedProfile, "Selected model profile must exist");
    assert.strictEqual(selectedProfile.capabilities.code, true, "Selected model must be code capable");
    assert.ok(selectedProfile.sensitivityAccess.includes("INTERNAL"));
  });
});
