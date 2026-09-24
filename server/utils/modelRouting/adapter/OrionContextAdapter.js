const { randomUUID: uuidv4 } = require("crypto");
const { TaskClassifier } = require("../classifier/TaskClassifier");
const { HardwareProfiler } = require("../profiler/HardwareProfiler");
const { SENSITIVITY_LEVELS, SENSITIVITY_ORDER } = require("../contracts/types");

class OrionContextAdapter {
  /**
   * Resolves effective sensitivity as supremum (max) across all context sources.
   * Guarantees that sensitivity is never downgraded.
   */
  static resolveEffectiveSensitivity({
    promptSensitivity = null,
    attachments = [],
    pinnedDocs = [],
    parsedFiles = [],
    workspaceDefault = "INTERNAL",
  } = {}) {
    const candidates = [
      promptSensitivity,
      ...attachments.map((a) => a?.sensitivity || a?.classification),
      ...pinnedDocs.map(
        (d) =>
          d?.metadata?.sensitivity ||
          d?.metadata?.classification ||
          d?.sensitivity,
      ),
      ...parsedFiles.map(
        (f) =>
          f?.metadata?.sensitivity ||
          f?.metadata?.classification ||
          f?.sensitivity,
      ),
      workspaceDefault,
    ].filter(Boolean);

    let maxLevel = SENSITIVITY_LEVELS.INTERNAL;

    for (const item of candidates) {
      const normalized = String(item).toUpperCase().trim();
      if (SENSITIVITY_LEVELS.hasOwnProperty(normalized)) {
        const val = SENSITIVITY_LEVELS[normalized];
        if (val > maxLevel) {
          maxLevel = val;
        }
      } else {
        // Unknown or unparseable sensitivity defaults conservatively
        maxLevel = Math.max(maxLevel, SENSITIVITY_LEVELS.CONFIDENTIAL);
      }
    }

    return SENSITIVITY_ORDER[maxLevel] || "INTERNAL";
  }

  /**
   * Converts ORION request context into normalized RoutingContext.
   */
  static async fromRequest({
    workspace = {},
    prompt = "",
    user = null,
    thread = null,
    attachments = [],
    pinnedDocs = [],
    parsedFiles = [],
    conversationTokenCount = 0,
    allowedModelIds = null,
    deniedModelIds = [],
    hardwareProfiler = null,
  } = {}) {
    const requestId = uuidv4();
    const profiler = hardwareProfiler || HardwareProfiler.getInstance();

    // 1. Classify Task
    const task = TaskClassifier.classify({
      prompt,
      attachments,
      conversationTokenCount,
    });

    // 2. Resolve Data Sensitivity
    const effectiveSensitivity = this.resolveEffectiveSensitivity({
      attachments,
      pinnedDocs,
      parsedFiles,
      workspaceDefault:
        workspace?.defaultSensitivity ||
        workspace?.sensitivity ||
        process.env.ROUTER_DEFAULT_SENSITIVITY ||
        "INTERNAL",
    });

    // 3. Obtain Hardware Telemetry (cached non-blocking)
    const hardware = await profiler.getProfile();

    // 4. Resolve User and Role
    const userRole = user?.role || (user ? "default" : "default");

    return {
      requestId,
      task,
      data: {
        sensitivity: effectiveSensitivity,
        types: attachments.map((a) => a?.mime || "unknown"),
      },
      user: {
        userId: user?.id ?? null,
        role: userRole,
      },
      hardware,
      permissions: {
        allowedModelIds: allowedModelIds || null,
        deniedModelIds: deniedModelIds || [],
      },
      workspace: {
        id: workspace?.id,
        slug: workspace?.slug,
        name: workspace?.name,
      },
      thread: thread ? { id: thread.id, slug: thread.slug } : null,
    };
  }
}

module.exports = { OrionContextAdapter };
