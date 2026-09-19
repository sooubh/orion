const { ModelRouterService } = require("../../router");
const { getLLMProvider } = require("../../helpers");

class OrionModelRouter {
  constructor(workspace, embedder = null) {
    this.className = "OrionModelRouter";
    this.workspace = workspace;
    this.embedder = embedder;
    this.routerService = ModelRouterService.getInstance();
    this.router = null;
    this.resolvedRoute = null;
    this._routeKey = null;
    this.delegateProvider = null;
    this.defaultTemp = 0.7;
    this.routerService.log(
      `Initialized for workspace "${workspace?.name || workspace?.slug}"`
    );
  }

  /**
   * Resolve the route and instantiate the delegate LLM provider.
   * Must be called before any chat methods.
   *
   * Flow:
   * 1. Evaluate calculated rules (always — they're free)
   * 2. Evaluate LLM rules (uses cache to avoid expensive calls)
   * 3. If nothing matched, use the sticky route (previous model stays)
   * 4. If sticky expired, fall back to the default model
   *
   * @param {Object} context - { prompt, conversationHistory, conversationTokenCount }
   * @param {Object} opts - { user, thread }
   */
  async resolve(context = {}, { user = null, thread = null } = {}) {
    this.router = await this.routerService.resolveRouterForWorkspace(
      this.workspace
    );
    if (!this.router)
      throw new Error("No model router found for this workspace.");

    const rules = this.router.rules || [];
    const stickyMs = (this.router.cooldown_seconds ?? 300) * 1000;
    this._routeKey = this.routerService.routeCacheKey(
      user?.id,
      this.workspace.slug,
      thread?.slug
    );

    this.routerService.logRoutingContext(this.router, rules, context);

    const { ClassificationService, CLASSIFICATION_LEVELS } = require("../../classification");
    const { PolicyEngine } = require("../../policy");
    const { EventLogs } = require("../../../models/eventLogs");

    const promptClassification = context.prompt
      ? ClassificationService.classifyDocument({
          content: context.prompt,
          filename: "prompt.txt",
        }).classification
      : CLASSIFICATION_LEVELS.INTERNAL;

    const attachmentSensitivities = (context.attachments || []).map(
      (a) => a.classification || a.sensitivity
    );

    this.effectiveSensitivity = ClassificationService.resolveSupremum([
      promptClassification,
      ...attachmentSensitivities,
      this.workspace?.classification,
    ]);

    this.routerService.log(
      `[ModelRouter] Context sensitivity resolved as '${this.effectiveSensitivity}'`
    );

    // Helper to evaluate policy on a candidate route
    const isRouteAllowed = (candidate) => {
      if (!candidate) return false;
      const policyResult = PolicyEngine.evaluatePolicy({
        requestedCapability: "model",
        model: candidate,
        classification: this.effectiveSensitivity,
        user,
        workspace: this.workspace,
      });

      if (policyResult.decision !== "ALLOW") {
        this.routerService.log(
          `[Policy Engine] Candidate route ${candidate.provider}/${candidate.model} rejected: ${policyResult.reason}`
        );
        EventLogs.logEvent(
          "model_blocked",
          {
            provider: candidate.provider,
            model: candidate.model,
            classification: this.effectiveSensitivity,
            reason: policyResult.reason,
            policyRule: policyResult.policyRule,
          },
          user?.id ? Number(user.id) : null
        );
        return false;
      }
      return true;
    };

    // Step 1: Calculated rules (always re-evaluated, they're instant)
    const calcResult = this.routerService.evaluateCalculatedRules(
      rules,
      context
    );
    if (calcResult && isRouteAllowed(calcResult)) {
      this.resolvedRoute = calcResult;
      this.routerService.setStickyRoute(this._routeKey, calcResult);
      this.#finalize(user);
      return;
    }

    // Step 2: LLM rules (cached to avoid expensive re-classification)
    const { route: llmResult } = await this.routerService.evaluateLLMRules(
      this._routeKey,
      rules,
      context,
      this.router,
      stickyMs
    );
    if (llmResult && isRouteAllowed(llmResult)) {
      this.resolvedRoute = llmResult;
      this.routerService.setStickyRoute(this._routeKey, llmResult);
      this.#finalize(user);
      return;
    }

    // Step 3: No rule matched — check sticky route
    const sticky = this.routerService.getStickyRoute(this._routeKey, stickyMs);
    if (sticky && isRouteAllowed(sticky)) {
      this.resolvedRoute = sticky;
      this.routerService.log(
        `No rules matched → Sticky route active: ${sticky.provider}/${sticky.model} (rule: ${sticky.ruleTitle || "unknown"})`
      );
      this.#finalize(user);
      return;
    }

    // Step 4: If adaptive routing is enabled, route via AdaptiveModelRouter
    if (process.env.ADAPTIVE_ROUTING_ENABLED === "true") {
      try {
        const { AdaptiveModelRouter, OrionContextAdapter } = require("../../modelRouting");
        const routingContext = await OrionContextAdapter.fromRequest({
          workspace: this.workspace,
          prompt: context.prompt,
          user,
          thread,
          attachments: context.attachments || [],
          conversationTokenCount: context.conversationTokenCount,
        });

        const decision = await AdaptiveModelRouter.getInstance().route(routingContext);
        if (decision.status === "SELECTED" && isRouteAllowed(decision.selectedModel)) {
          this.resolvedRoute = {
            provider: decision.selectedModel.provider,
            model: decision.selectedModel.model,
            ruleTitle: `Adaptive: ${decision.selectedModel.displayName}`,
            ruleType: "adaptive",
            isFallback: false,
            score: decision.selectedModel.score,
          };
          this.routerService.log(
            `No rules matched → Adaptive Model Router selected: ${this.resolvedRoute.provider}/${this.resolvedRoute.model} (score: ${decision.selectedModel.score})`
          );
          this.#finalize(user);
          return;
        }
      } catch (err) {
        this.routerService.log(`Adaptive Model Router evaluation error: ${err.message}`);
      }
    }

    // Step 5: Sticky expired or rejected — use fallback (with sovereign local enforcement)
    const rawFallback = {
      provider: this.router.fallback_provider,
      model: this.router.fallback_model,
      ruleTitle: null,
      ruleType: null,
      isFallback: true,
    };

    if (isRouteAllowed(rawFallback)) {
      this.resolvedRoute = rawFallback;
      this.routerService.log(
        `No rules matched, sticky expired → Fallback: ${this.router.fallback_provider}/${this.router.fallback_model}`
      );
    } else {
      // Security Policy: Fallback was cloud/unauthorized for protected data!
      // Fail safely to on-premise local sovereign model.
      const safeLocalProvider = process.env.LOCAL_LLM_PROVIDER || "ollama";
      const safeLocalModel = process.env.OLLAMA_MODEL_PREF || process.env.LOCAL_AI_MODEL_PREF || "llama3.2";
      this.resolvedRoute = {
        provider: safeLocalProvider,
        model: safeLocalModel,
        ruleTitle: "Sovereign Air-Gap Local Fallback",
        ruleType: "policy_override",
        isFallback: true,
      };
      this.routerService.log(
        `[Policy Engine] Configured fallback was blocked for ${this.effectiveSensitivity} data. Enforced on-premise sovereign local fallback: ${safeLocalProvider}/${safeLocalModel}`
      );
    }

    this.#finalize(user);
  }

  #finalize(user = null) {
    const { EventLogs } = require("../../../models/eventLogs");
    this.delegateProvider = this._instrumentProvider(
      getLLMProvider({
        provider: this.resolvedRoute.provider,
        model: this.resolvedRoute.model,
      })
    );

    EventLogs.logEvent(
      "model_allowed",
      {
        provider: this.resolvedRoute.provider,
        model: this.resolvedRoute.model,
        classification: this.effectiveSensitivity,
        ruleTitle: this.resolvedRoute.ruleTitle,
        isFallback: this.resolvedRoute.isFallback,
      },
      user?.id ? Number(user.id) : null
    );
  }

  /**
   * Every chat flow ends inference through one of two methods on the connector -
   * `handleStream` once the stream is drained, or `getChatCompletion` when it
   * resolves. Wrapping them means the cooldown is measured from the end of the
   * reply without any caller needing to know the router exists.
   * @param {BaseLLMProvider} provider
   * @returns {BaseLLMProvider} the same instance, with both methods wrapped
   */
  _instrumentProvider(provider) {
    for (const method of ["getChatCompletion", "handleStream"]) {
      if (typeof provider?.[method] !== "function") continue;
      const original = provider[method].bind(provider);
      provider[method] = async (...args) => {
        try {
          return await original(...args);
        } finally {
          this.onInferenceComplete();
        }
      };
    }
    return provider;
  }

  /**
   * Re-stamp the sticky route when inference stops so the cooldown window is
   * measured from the end of the response, not from rule detection. Without
   * this a long reply eats its own cooldown and the next message can reroute.
   *
   * Chat flows get this automatically via the wrapped delegate provider (see
   * `#finalize`). Agent flows call it from the `model-router-cooldown` plugin,
   * since aibitat instantiates its own providers from the resolved route.
   */
  onInferenceComplete() {
    if (!this._routeKey || !this.resolvedRoute || this.resolvedRoute.isFallback)
      return;
    this.routerService.setStickyRoute(this._routeKey, this.resolvedRoute);
  }

  get routingMetadata() {
    if (!this.resolvedRoute) return null;
    return {
      routedTo: {
        provider: this.resolvedRoute.provider,
        model: this.resolvedRoute.model,
        ruleTitle: this.resolvedRoute.ruleTitle,
        ruleType: this.resolvedRoute.ruleType,
        isFallback: this.resolvedRoute.isFallback,
        shouldNotify: this.routerService.shouldNotify(
          this._routeKey,
          this.resolvedRoute
        ),
        routerName: this.router?.name,
        fallbackProvider: this.router?.fallback_provider,
        fallbackModel: this.router?.fallback_model,
      },
    };
  }

  streamingEnabled() {
    return this.delegateProvider?.streamingEnabled?.() ?? false;
  }

  promptWindowLimit() {
    return this.delegateProvider?.promptWindowLimit?.() ?? 4096;
  }

  async isValidChatCompletionModel() {
    return true;
  }

  async constructPrompt(args) {
    return this.delegateProvider.constructPrompt(args);
  }

  async getChatCompletion(messages, opts = {}) {
    return this.delegateProvider.getChatCompletion(messages, opts);
  }

  async streamGetChatCompletion(messages, opts = {}) {
    return this.delegateProvider.streamGetChatCompletion(messages, opts);
  }

  async handleStream(response, stream, opts = {}) {
    return this.delegateProvider.handleStream(response, stream, opts);
  }

  async embedTextInput(textInput) {
    return this.delegateProvider.embedTextInput(textInput);
  }

  async embedChunks(textChunks) {
    return this.delegateProvider.embedChunks(textChunks);
  }

  async compressMessages(promptArgs, rawHistory) {
    return this.delegateProvider.compressMessages(promptArgs, rawHistory);
  }
}

const AnythingLLMModelRouter = OrionModelRouter;

module.exports = { OrionModelRouter, AnythingLLMModelRouter };
