# ORION — Adaptive / Task-Based Model Routing
## Existing Codebase Integration Plan (Isolated Feature)

### Objective

Add **Adaptive / Task-Based Model Routing** to the existing ORION codebase without changing unrelated functionality, UI, APIs, authentication, database behavior, or existing workflows.

The feature must implement the ORION routing principle already defined in the PPT:

> **Task + Sensitivity + Capability + Hardware + Permission → Best Model**

The PPT describes ORION as selecting an appropriate local model according to task type, data sensitivity, model capability, available hardware, and permissions. It also shows the intended flow as **Understand Task → Check Data Sensitivity → Select Best Model → Route to Agent**, with local model categories such as reasoning, vision, code, and domain-specific models. fileciteturn1file0L23-L28 fileciteturn1file0L49-L50

---

# 1. NON-NEGOTIABLE SCOPE

## Only add this feature

The implementation scope is:

**Adaptive / Task-Based Model Routing**

Everything else is protected.

Do NOT redesign or rewrite:

- Existing frontend/UI.
- Existing authentication.
- Existing database schema unless a tiny isolated registry table is genuinely required.
- Existing RAG pipeline.
- Existing agent workflow.
- Existing tool execution system.
- Existing file upload system.
- Existing policy engine.
- Existing OCR/vision pipeline.
- Existing API contracts unless an additive, backward-compatible field is required.
- Existing model execution logic unless the router needs a thin adapter.
- Existing dependencies unless required for hardware detection.
- Existing environment configuration unrelated to routing.

The router must be added as a **new isolated layer/service/module** and integrated through the smallest possible integration point.

---

# 2. FIRST STEP — CODEBASE DISCOVERY

Before writing code, inspect the existing repository.

Do not assume the architecture.

Identify:

1. Existing model configuration.
2. Where model names/providers are defined.
3. Where an AI request enters the backend.
4. Where task/intent is currently detected, if anywhere.
5. Where uploaded-file metadata is available.
6. Where sensitivity/classification information already exists.
7. Where user roles/permissions are checked.
8. Where model inference is invoked.
9. Where local runtimes are connected.
10. Where agent planning starts.
11. Existing logging/audit mechanism.
12. Existing environment/config mechanism.
13. Existing TypeScript/Python types/interfaces.
14. Existing test framework.
15. Existing dependency management.

Create a short internal mapping before implementation:

```text
Request Entry
    ↓
Existing Task/Intent Logic
    ↓
Existing Security/Data Classification
    ↓
[NEW] Model Router
    ↓
Existing Agent / Inference Layer
```

If one of these existing layers does not exist, the router should use the smallest safe fallback rather than redesigning the application.

---

# 3. FEATURE POSITION IN ORION

The router belongs between task/security understanding and model execution.

Target conceptual flow:

```text
User Request
    ↓
Task Understanding
    ↓
Data Sensitivity
    ↓
Permission Check
    ↓
[ADAPTIVE MODEL ROUTER]
    ├── Task requirements
    ├── Data sensitivity
    ├── Model capability
    ├── Hardware availability
    └── Permission constraints
    ↓
Selected Local Model
    ↓
Existing Agent / Inference Pipeline
```

Important:

The router should **select** a model/resource.

It should not become a new agent framework.

---

# 4. CORE ROUTING SPECIFICATION

## 4.1 Inputs

The router must accept a normalized `RoutingContext`.

Proposed interface:

```ts
interface RoutingContext {
  task: {
    type: TaskType;
    complexity: TaskComplexity;
    requiresVision: boolean;
    requiresCode: boolean;
    requiresLongContext: boolean;
    requiresTools: boolean;
  };

  data: {
    sensitivity: SensitivityLevel;
    types: DataType[];
    sourceIds?: string[];
  };

  user: {
    userId?: string;
    role?: string;
  };

  hardware: {
    cpuCores?: number;
    systemRamGb?: number;
    gpuName?: string;
    gpuVramGb?: number;
    availableVramGb?: number;
  };

  permissions: {
    allowedModelIds?: string[];
    deniedModelIds?: string[];
    allowedCapabilities?: string[];
  };
}
```

Do not duplicate information that already exists elsewhere in the codebase.

If the existing project already has equivalent types, create an adapter instead of creating duplicate models.

---

# 5. TASK TAXONOMY

Use a controlled, extensible task taxonomy.

Initial task types:

```text
TEXT_QA
DOCUMENT_SUMMARY
DOCUMENT_EXTRACTION
MULTIMODAL_ANALYSIS
CODE_GENERATION
CODE_REVIEW
DATA_ANALYSIS
CALCULATION
REPORT_GENERATION
GENERAL_REASONING
```

The taxonomy must be extensible.

Do not hard-code routing logic throughout the application.

Bad:

```ts
if (prompt.includes("code")) {
   useModel("...");
}
```

Preferred:

```text
User Request
    ↓
Task Classifier
    ↓
Normalized TaskType
    ↓
Router
```

The classifier can initially be deterministic/rules-based if the existing codebase does not already have a suitable classifier.

It must be replaceable later.

---

# 6. TASK COMPLEXITY

Use a small controlled scale:

```text
LOW
MEDIUM
HIGH
```

Example signals:

### LOW
- Simple summary.
- Short extraction.
- Basic factual question.

### MEDIUM
- Multi-document reasoning.
- Structured analysis.
- Moderate code review.

### HIGH
- Multi-step reasoning.
- Complex technical analysis.
- Long-context synthesis.
- Multimodal technical interpretation.

Do not pretend that complexity prediction is perfectly accurate.

It is a routing signal, not ground truth.

---

# 7. DATA SENSITIVITY

The PPT expects sensitivity to be a routing input and also connects it to the broader policy-controlled architecture. fileciteturn1file0L23-L26

Use the project's existing classification system if it already exists.

Otherwise define:

```text
PUBLIC
INTERNAL
CONFIDENTIAL
RESTRICTED
```

Rules:

- Router must never lower a document's sensitivity.
- Unknown sensitivity should use the safer/default restrictive path.
- Sensitive data must not automatically become eligible for every local model.
- Sensitivity is a **constraint**, not merely a scoring bonus.

Example:

```text
CONFIDENTIAL
    ↓
Eligible models = only locally approved models
    ↓
Apply task/capability/hardware checks
```

---

# 8. MODEL REGISTRY

Do not scatter model metadata across code.

Create a central model registry.

Proposed model definition:

```ts
interface ModelProfile {
  id: string;
  displayName: string;

  runtime: "ollama" | "llama.cpp" | "vllm" | "other";

  capabilities: {
    text: boolean;
    vision: boolean;
    code: boolean;
    toolUse: boolean;
    reasoning: boolean;
    longContext: boolean;
  };

  contextLength: number;

  resourceRequirements: {
    minRamGb?: number;
    minVramGb?: number;
  };

  sensitivityAccess: SensitivityLevel[];

  allowedRoles?: string[];

  trustStatus: "approved" | "disabled" | "testing";

  enabled: boolean;

  priority?: number;
}
```

The exact runtime enum must be adapted to what already exists in the repository.

---

# 9. MODEL REGISTRY EXAMPLES

These are examples for the architecture, not claims about the current implementation.

```text
Model A
Type: Reasoning
Supports: Text + reasoning
Sensitivity: Internal/Confidential
Resource: 8–12 GB VRAM

Model B
Type: Vision
Supports: Text + image
Sensitivity: Internal/Confidential
Resource: 10–16 GB VRAM

Model C
Type: Code
Supports: Code generation/review
Sensitivity: Internal/Confidential
Resource: 8–12 GB VRAM

Model D
Type: Domain-specific
Supports: Organization-specific workload
Sensitivity: Depends on approval
Resource: Defined by registry
```

The PPT architecture explicitly separates **reasoning, vision, code, and domain-specific models** in the local model pool. fileciteturn1file0L35-L36

---

# 10. HARDWARE PROFILING

The router must know whether a selected model can realistically run.

Initial hardware signals:

```text
CPU
System RAM
GPU name
GPU VRAM
Available GPU VRAM
```

Do NOT perform expensive hardware detection for every request.

Preferred:

```text
Application Startup
    ↓
Hardware Profiler
    ↓
Cached Hardware Profile
    ↓
Router
```

Refresh the hardware profile only when necessary.

The PPT explicitly identifies hardware resource requirements and adaptive routing as the mitigation for GPU/RAM constraints. fileciteturn1file0L61-L65

---

# 11. PERMISSION FILTER

The router must never override the existing permission/policy layer.

Recommended order:

```text
Candidate Models
      ↓
Permission Filter
      ↓
Sensitivity Filter
      ↓
Capability Filter
      ↓
Hardware Filter
      ↓
Scoring
      ↓
Selected Model
```

If an existing policy engine already performs permission checks, reuse it.

Do not create a second independent authorization system.

Important rule:

**Permission should be a hard constraint, not just a score.**

Example:

```text
Model X
Task match = 95
Hardware fit = 95
Capability = 100
Permission = DENIED

Result:
Model X is NOT eligible.
```

---

# 12. ROUTING ALGORITHM

The routing algorithm should have two stages.

## Stage A — Hard filtering

Remove models that cannot or must not run the task.

Filter by:

1. Enabled status.
2. Approval status.
3. Permission.
4. Sensitivity.
5. Required modality.
6. Required task capability.
7. Hardware/resource feasibility.

Conceptual:

```ts
eligibleModels = models.filter(model =>
  model.enabled &&
  model.trustStatus === "approved" &&
  permissionAllows(model) &&
  sensitivityAllows(model) &&
  capabilityMatches(model) &&
  hardwareSupports(model)
);
```

---

## Stage B — Suitability scoring

Score remaining eligible models.

Suggested weighted model:

```text
Task Fit             30%
Capability Fit       25%
Sensitivity Fit      20%
Hardware Fit         15%
Context Fit          5%
Model Priority       5%
```

Final score:

```text
score =
  taskFit * 0.30 +
  capabilityFit * 0.25 +
  sensitivityFit * 0.20 +
  hardwareFit * 0.15 +
  contextFit * 0.05 +
  priority * 0.05
```

Important:

These weights are an implementation starting point, not a claim that this is the mathematically optimal formula.

Keep them configurable.

---

# 13. HARDWARE FIT SCORING

Possible logic:

### Full fit

Model comfortably fits available VRAM/RAM.

```text
1.0
```

### Marginal fit

Model fits but leaves limited headroom.

```text
0.7
```

### Not feasible

Model does not satisfy minimum requirements.

```text
0.0
```

Do not select a model when hardware feasibility is below the required threshold.

---

# 14. CAPABILITY FIT

Examples:

### Text summary

```text
Text model = high
Vision model = unnecessary
Code model = low
```

### Scanned document

```text
Vision support = required
OCR integration = required
Long context = depending on document
```

### Code review

```text
Code support = required
Tool use = optional/required depending on workflow
```

### Engineering drawing analysis

```text
Vision = required
Reasoning = high
```

---

# 15. SENSITIVITY FIT

The router must distinguish:

```text
Can technically run
```

from

```text
Is allowed to run
```

A model may be technically excellent but still not be eligible for a sensitive document.

Therefore:

```text
Technical capability ≠ authorization
```

This distinction is central to the ORION concept.

---

# 16. FALLBACK BEHAVIOR

The router must define what happens when no eligible model exists.

Never silently fall back to an unauthorized or external model.

Recommended behavior:

```text
No eligible local model
        ↓
Return structured routing failure
        ↓
Explain why
        ↓
Suggest an allowed action
```

Example:

```json
{
  "status": "NO_ELIGIBLE_MODEL",
  "reason": "No approved local model satisfies vision + confidential-data + hardware constraints.",
  "externalFallbackAllowed": false
}
```

Fallback options can be:

- Ask the user to choose a simpler task.
- Request human/admin approval.
- Wait for a compatible model.
- Use a lower-capability approved model only if policy allows it.

---

# 17. ROUTING DECISION OBJECT

Every routing decision should return a structured result.

Example:

```ts
interface RoutingDecision {
  status: "SELECTED" | "NO_ELIGIBLE_MODEL";

  selectedModel?: {
    id: string;
    score: number;
  };

  task: {
    type: TaskType;
    complexity: TaskComplexity;
  };

  constraints: {
    sensitivity: SensitivityLevel;
    requiredCapabilities: string[];
  };

  reasoning: {
    taskFit: number;
    capabilityFit: number;
    sensitivityFit: number;
    hardwareFit: number;
    contextFit: number;
    priority: number;
  };

  alternatives?: Array<{
    modelId: string;
    score: number;
    rejectedBecause?: string;
  }>;

  timestamp: string;
}
```

The reasoning should be safe to show to admins/debug logs without exposing sensitive document contents.

---

# 18. AUDIT / ROUTING LOGGING

The PPT includes auditability as part of the architecture and describes model selection/permission decisions as controlled workflow elements. fileciteturn1file0L49-L50

Log:

```text
requestId
userId / role when appropriate
taskType
complexity
sensitivity
selectedModel
candidateModels
decision scores
permission result
hardware profile summary
fallback/rejection reason
timestamp
routerVersion
```

Do NOT log raw confidential document content just to explain a routing decision.

Example:

```text
[ROUTER]
Task: MULTIMODAL_ANALYSIS
Sensitivity: CONFIDENTIAL
Required: vision, reasoning
Hardware: 16 GB VRAM
Selected: local-vision-model
Score: 0.91
Reason: capability + sensitivity + hardware fit
```

---

# 19. UI INTEGRATION

This feature should not require a new UI redesign.

If the existing application already exposes the selected model, update it minimally.

Preferred small information:

```text
Selected Model
Qwen Vision 7B

Why
Multimodal task • Confidential data • 16 GB VRAM available
```

Optional expandable details:

```text
Task fit
Capability fit
Hardware fit
Permission status
```

Do not expose a huge routing dashboard unless the existing UI already has one.

The primary user experience should remain unchanged.

---

# 20. API INTEGRATION

Prefer an internal service:

```text
ModelRouter.route(context)
```

or:

```text
POST /internal/routing/resolve
```

Only expose an API endpoint if the existing architecture requires API boundaries.

Do not break the existing inference endpoint.

Preferred compatibility:

```text
Existing request
      ↓
Existing controller
      ↓
Router.resolve(...)
      ↓
Existing inference service(selectedModel)
```

This means older callers can continue working.

---

# 21. CONFIGURATION

Keep routing configuration externalized.

Example:

```env
ROUTER_ENABLED=true
ROUTER_MIN_SCORE=0.60
ROUTER_DEFAULT_MODEL=...
ROUTER_HARDWARE_REFRESH_SECONDS=...
```

Or use the project's existing config format.

Do not hard-code:

- Model IDs.
- VRAM thresholds.
- Score weights.
- Sensitivity rules.

unless the repository already uses hard-coded configuration consistently.

---

# 22. MODEL ADD / REMOVE SAFETY

The router must fail safely when:

- model is unavailable,
- runtime is offline,
- model metadata is invalid,
- hardware is insufficient,
- model is disabled,
- permission is denied.

Never choose a model merely because its ID exists.

Eligibility must depend on its current registry metadata/status.

---

# 23. PERFORMANCE REQUIREMENTS

Routing should be lightweight compared with actual model inference.

Target:

```text
Routing decision: milliseconds-scale
Model inference: normal inference latency
```

Do not introduce another LLM call just to select a model unless the repository already uses one and the benefit is justified.

Prefer deterministic routing first.

Possible future extension:

```text
Rules
  ↓
Lightweight classifier
  ↓
Complex routing reasoning only when needed
```

---

# 24. TEST PLAN

The router is not complete until routing behavior is tested.

## Test 1 — Text summary

Input:

```text
Task: summarize internal report
Sensitivity: INTERNAL
Hardware: adequate
```

Expected:

Text/reasoning-capable eligible model.

---

## Test 2 — Code review

Input:

```text
Task: review Python code
RequiresCode: true
```

Expected:

Code-capable local model.

---

## Test 3 — Scanned document

Input:

```text
Task: analyze scanned inspection report
RequiresVision: true
Sensitivity: CONFIDENTIAL
```

Expected:

Approved vision-capable local model.

---

## Test 4 — Permission denial

Model is otherwise suitable but permission is denied.

Expected:

Model excluded.

---

## Test 5 — Insufficient VRAM

Model needs more VRAM than currently available.

Expected:

Model excluded.

---

## Test 6 — Sensitive data

Restricted document with model that only supports internal data.

Expected:

Model excluded.

---

## Test 7 — No eligible model

No model satisfies requirements.

Expected:

`NO_ELIGIBLE_MODEL`

No unauthorized fallback.

---

## Test 8 — Model disabled

Disabled model must never be selected.

---

## Test 9 — Deterministic behavior

Same routing context should produce the same decision when registry/hardware/policy state is unchanged.

---

## Test 10 — Existing workflow regression

Requests that do not use the new router path must continue to work exactly as before.

---

# 25. OBSERVABILITY / DEBUG MODE

For development/admin use, provide a structured routing trace:

```text
Task detected: DOCUMENT_ANALYSIS
Sensitivity: CONFIDENTIAL
Required capabilities: TEXT + REASONING
Hardware: RTX / available VRAM
Candidates: 4
Rejected:
  Model A → no vision capability
  Model B → insufficient VRAM
  Model C → permission denied
Selected:
  Model D → score 0.91
```

Never show sensitive document contents in the trace.

---

# 26. SECURITY RULES

The router must follow these rules:

1. No external model fallback.
2. No network call just to select a model.
3. No model may bypass permissions.
4. No sensitivity downgrade.
5. No disabled/unapproved model selection.
6. No raw confidential prompt logging.
7. No secrets in routing logs.
8. Hardware information should be summarized, not unnecessarily stored permanently.
9. Router must fail closed for authorization failures.
10. Routing must remain within the organization’s local inference architecture.

---

# 27. FILE / MODULE ORGANIZATION

The exact paths must be determined after repository inspection.

Preferred conceptual structure:

```text
src/
  routing/
    ModelRouter
    TaskClassifier
    ModelRegistry
    HardwareProfiler
    RoutingScorer
    RoutingTypes
    RoutingPolicyAdapter
    RoutingLogger
```

Or, if the existing repository is feature-based:

```text
features/
  model-routing/
    router
    registry
    classifier
    profiler
    scorer
    types
    tests
```

Do not create this exact structure blindly.

Use the repository's existing organization style.

---

# 28. INTEGRATION RULE

The router should depend on existing services through interfaces/adapters.

Preferred:

```text
ModelRouter
    ├── ModelRegistry
    ├── HardwareProfiler
    ├── PolicyAdapter
    └── TaskClassifier
             ↓
        RoutingDecision
             ↓
Existing Model Service
```

Avoid:

```text
ModelRouter directly imports
    database
    frontend
    auth internals
    agent internals
    model runtime internals
    every existing service
```

Keep coupling low.

---

# 29. BACKWARD COMPATIBILITY

Existing behavior must remain unchanged unless routing is explicitly enabled.

Recommended feature flag:

```text
adaptiveModelRouting = true
```

If disabled:

```text
Existing model-selection behavior continues.
```

This gives a safe rollback path.

---

# 30. IMPLEMENTATION PHASES

## Phase 1 — Discovery

- Inspect repository.
- Map current AI flow.
- Identify existing model configuration.
- Identify policy/sensitivity/hardware sources.
- Select minimal integration point.

## Phase 2 — Core router

Implement:

- RoutingContext.
- ModelProfile.
- ModelRegistry.
- Task taxonomy.
- Candidate filtering.
- Scoring.
- RoutingDecision.

## Phase 3 — Existing-system adapters

Connect:

- Existing task classifier.
- Existing sensitivity labels.
- Existing permission engine.
- Existing model runner.
- Existing audit/logging.

## Phase 4 — Hardware profile

Add local hardware detection and cache.

## Phase 5 — Integration

Insert router before current model invocation.

## Phase 6 — Observability

Add routing decision logs/debug trace.

## Phase 7 — Tests

Add unit + integration + regression tests.

## Phase 8 — Validation

Test:

- text,
- code,
- multimodal,
- confidential,
- permission denial,
- insufficient hardware,
- no eligible model.

---

# 31. DEFINITION OF DONE

The feature is complete only when:

- [ ] Existing application still runs.
- [ ] Existing UI remains unchanged apart from optional minimal selected-model information.
- [ ] Existing authentication remains unchanged.
- [ ] Existing database behavior remains unchanged.
- [ ] Router exists as an isolated module/service.
- [ ] Models are represented through a central registry.
- [ ] Task type is normalized.
- [ ] Data sensitivity is considered.
- [ ] Model capabilities are considered.
- [ ] Hardware availability is considered.
- [ ] Permissions are a hard eligibility constraint.
- [ ] Unapproved/disabled models cannot be selected.
- [ ] No external fallback is introduced.
- [ ] Router returns a structured decision.
- [ ] Routing decision is auditable without logging sensitive content.
- [ ] No-eligible-model case fails safely.
- [ ] Existing inference service receives the selected model through the existing path.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] Existing workflows still pass.
- [ ] No unrelated files/features were changed.

---

# 32. IMPORTANT IMPLEMENTATION PRINCIPLE

Do not build a complicated “AI deciding which AI to use” system for the first version.

The first implementation should be:

**deterministic + policy-aware + hardware-aware + capability-aware + observable.**

That gives ORION a clear, explainable routing mechanism.

Later, the routing engine can evolve toward learned routing or benchmark-based model selection without changing the core contract.

---

# 33. FINAL TARGET ARCHITECTURE

```text
                    USER REQUEST
                          │
                          ▼
                 Existing Task Analysis
                          │
                          ▼
                 Existing Data Labels
                          │
                          ▼
                 Existing Permission Layer
                          │
                          ▼
              ┌─────────────────────────┐
              │   ORION MODEL ROUTER    │
              │                         │
              │  Task Requirements      │
              │  Data Sensitivity       │
              │  Model Capability       │
              │  Hardware Availability  │
              │  Permissions            │
              └────────────┬────────────┘
                           │
                    Candidate Filtering
                           │
                       Scoring
                           │
                           ▼
                  SELECTED LOCAL MODEL
                           │
                           ▼
                 Existing Agent / LLM
                           │
                           ▼
                    Existing Output
```

The router is therefore a **decision layer**, not a replacement for the rest of ORION.

---

# 34. PRODUCT MESSAGE TO PRESERVE

The PPT's USP describes this capability as **Risk-Aware AI Model Routing**: selecting the suitable local model by considering task complexity, data sensitivity, model trust, hardware, and permissions. fileciteturn1file0L91-L97

For implementation and demo language, use:

> **ORION selects the appropriate local model for each task while respecting the data's sensitivity, available hardware, model capabilities, and organizational permissions.**

This is the feature that should be implemented first before adding more sophisticated routing intelligence.
