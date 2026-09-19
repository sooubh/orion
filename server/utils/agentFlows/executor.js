const { FLOW_TYPES } = require("./flowTypes");
const executeApiCall = require("./executors/api-call");
const executeLLMInstruction = require("./executors/llm-instruction");
const executeWebScraping = require("./executors/web-scraping");
const { Telemetry } = require("../../models/telemetry");
const { safeJsonParse } = require("../http");

class FlowExecutor {
  constructor() {
    this.variables = {};
    this.introspect = (...args) => console.log("[introspect] ", ...args);
    this.logger = console.info;
    this.aibitat = null;
  }

  attachLogging(introspectFn = null, loggerFn = null) {
    this.introspect =
      introspectFn || ((...args) => console.log("[introspect] ", ...args));
    this.logger = loggerFn || console.info;
  }

  /**
   * Resolves nested values from objects using dot notation and array indices
   * Supports paths like "data.items[0].name" or "response.users[2].address.city"
   * Returns undefined for invalid paths or errors
   * @param {Object|string} obj - The object to resolve the value from
   * @param {string} path - The path to the value
   * @returns {string} The resolved value
   */
  getValueFromPath(obj = {}, path = "") {
    if (typeof obj === "string") obj = safeJsonParse(obj, {});

    if (
      !obj ||
      !path ||
      typeof obj !== "object" ||
      Object.keys(obj).length === 0 ||
      typeof path !== "string"
    )
      return "";

    // First split by dots that are not inside brackets
    const parts = [];
    let currentPart = "";
    let inBrackets = false;

    for (let i = 0; i < path.length; i++) {
      const char = path[i];
      if (char === "[") {
        inBrackets = true;
        if (currentPart) {
          parts.push(currentPart);
          currentPart = "";
        }
        currentPart += char;
      } else if (char === "]") {
        inBrackets = false;
        currentPart += char;
        parts.push(currentPart);
        currentPart = "";
      } else if (char === "." && !inBrackets) {
        if (currentPart) {
          parts.push(currentPart);
          currentPart = "";
        }
      } else {
        currentPart += char;
      }
    }

    if (currentPart) parts.push(currentPart);
    let current = obj;

    for (const part of parts) {
      if (current === null || typeof current !== "object") return undefined;

      // Handle bracket notation
      if (part.startsWith("[") && part.endsWith("]")) {
        const key = part.slice(1, -1);
        const cleanKey = key.replace(/^['"]|['"]$/g, "");

        if (!isNaN(cleanKey)) {
          if (!Array.isArray(current)) return undefined;
          current = current[parseInt(cleanKey)];
        } else {
          if (!(cleanKey in current)) return undefined;
          current = current[cleanKey];
        }
      } else {
        // Handle dot notation
        if (!(part in current)) return undefined;
        current = current[part];
      }

      if (current === undefined || current === null) return undefined;
    }

    return typeof current === "object" ? JSON.stringify(current) : current;
  }

  /**
   * Replaces variables in the config with their values
   * @param {Object} config - The config to replace variables in
   * @returns {Object} The config with variables replaced
   */
  replaceVariables(config) {
    const deepReplace = (obj) => {
      if (typeof obj === "string") {
        return obj.replace(/\${([^}]+)}/g, (match, varName) => {
          const value = this.getValueFromPath(this.variables, varName);
          return value !== undefined ? value : match;
        });
      }

      if (Array.isArray(obj)) return obj.map((item) => deepReplace(item));

      if (obj && typeof obj === "object") {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = deepReplace(value);
        }
        return result;
      }
      return obj;
    };

    return deepReplace(config);
  }

  /**
   * Executes a single step of the flow
   * @param {Object} step - The step to execute
   * @returns {Promise<Object>} The result of the step
   */
  async executeStep(step) {
    const config = this.replaceVariables(step.config);
    let result;
    // Create execution context with introspect
    const context = {
      introspect: this.introspect,
      variables: this.variables,
      logger: this.logger,
      aibitat: this.aibitat,
    };

    switch (step.type) {
      case FLOW_TYPES.START.type:
        // For start blocks, we just initialize variables if they're not already set
        if (config.variables) {
          config.variables.forEach((v) => {
            if (v.name && !this.variables[v.name]) {
              this.variables[v.name] = v.value || "";
            }
          });
        }
        result = this.variables;
        break;
      case FLOW_TYPES.API_CALL.type:
        result = await executeApiCall(config, context);
        break;
      case FLOW_TYPES.LLM_INSTRUCTION.type:
        result = await executeLLMInstruction(config, context);
        break;
      case FLOW_TYPES.WEB_SCRAPING.type:
        result = await executeWebScraping(config, context);
        break;
      default:
        throw new Error(`Unknown flow type: ${step.type}`);
    }

    // Store result in variable if specified
    if (config.resultVariable || config.responseVariable) {
      const varName = config.resultVariable || config.responseVariable;
      this.variables[varName] = result;
    }

    // If directOutput is true, mark this result for direct output
    if (config.directOutput) result = { directOutput: true, result };
    return result;
  }

  /**
   * Execute entire flow
   * @param {Object} flow - The flow to execute
   * @param {Object} initialVariables - Initial variables for the flow
   * @param {Object} aibitat - The aibitat instance from the agent handler
   */
  async executeFlow(flow, initialVariables = {}, aibitat) {
    await Telemetry.sendTelemetry("agent_flow_execution_started");

    // Initialize variables with both initial values and any passed-in values
    this.variables = {
      ...(
        flow.config.steps.find((s) => s.type === "start")?.config?.variables ||
        []
      ).reduce((acc, v) => ({ ...acc, [v.name]: v.value }), {}),
      ...initialVariables, // This will override any default values with passed-in values
    };

    this.aibitat = aibitat;
    this.attachLogging(aibitat?.introspect, aibitat?.handlerProps?.log);
    const results = [];
    let directOutputResult = null;
    const taskId = flow.uuid || `flow_${Date.now()}`;
    const { CheckpointManager } = require("../checkpoints");

    for (let i = 0; i < flow.config.steps.length; i++) {
      const step = flow.config.steps[i];
      const stepOrder = i + 1;
      try {
        const result = await this.executeStep(step);

        // Record validated checkpoint for flow step
        try {
          await CheckpointManager.onStepVerified({
            taskId,
            workflowId: flow.uuid || null,
            step: {
              stepId: step.id || `step_${stepOrder}`,
              stepOrder,
              stepTitle: step.name || `Flow Step ${stepOrder}: ${step.type}`,
              type: step.type,
              input: step.config,
            },
            output: result,
            verificationResult: {
              status: "PASSED",
              confidence: 1.0,
              method: "FlowStepExecutionVerifier",
              reason: `Flow step ${stepOrder} (${step.type}) executed successfully.`,
            },
            context: {
              variables: this.variables,
              classification: aibitat?.handlerProps?.classification || "INTERNAL",
              user: aibitat?.handlerProps?.user || null,
              workspace: aibitat?.handlerProps?.workspace || null,
            },
            socket: aibitat?.socket,
          });
        } catch (cpErr) {
          console.warn("[FlowExecutor] Checkpoint creation warning:", cpErr.message);
        }

        // If the step has directOutput, stop processing and return the result
        // so that no other steps are executed or processed
        if (result?.directOutput) {
          directOutputResult = result.result;
          break;
        }

        results.push({ success: true, result });
      } catch (error) {
        // Step failed: attempt checkpoint recovery
        try {
          const recovery = await CheckpointManager.handleStepFailure({
            taskId,
            failedStep: {
              stepId: step.id || `step_${stepOrder}`,
              stepOrder,
              type: step.type,
              input: step.config,
            },
            verificationResult: {
              status: "FAILED",
              confidence: 1.0,
              reason: error.message,
            },
            context: {
              variables: this.variables,
              classification: aibitat?.handlerProps?.classification || "INTERNAL",
              user: aibitat?.handlerProps?.user || null,
              workspace: aibitat?.handlerProps?.workspace || null,
            },
            socket: aibitat?.socket,
          });

          if (recovery.status === "RECOVERED") {
            // Restore variable state from checkpoint
            this.variables = { ...(recovery.restoredContext?.variables || this.variables) };
            this.logger?.(
              `[Checkpoint Recovery] Resumed flow from Step ${recovery.lastValidCheckpoint?.stepOrder}: ${recovery.lastValidCheckpoint?.stepTitle}`
            );
          }
        } catch (recErr) {
          console.warn("[FlowExecutor] Checkpoint recovery error:", recErr.message);
        }

        results.push({ success: false, error: error.message });
        break;
      }
    }

    return {
      success: results.every((r) => r.success),
      results,
      variables: this.variables,
      directOutput: directOutputResult,
    };
  }
}

module.exports = {
  FlowExecutor,
  FLOW_TYPES,
};
