# ORION — Detailed Website Content Plan
## Single-Page Website | Max 6 Sections | Existing UI Preserved

**Project:** ORION — AI That Lives in Your Environment  
**Problem Statement:** SIH26117 — Sovereign On-Premise Agentic AI Workbench using Open-Weight Multimodal LLMs for Confidential Industrial Work  
**Website constraint:** Keep the existing single-page UI, visual language, typography, spacing system, cards, navigation, and overall design unchanged. The work is primarily a content restructuring/replacement exercise.

---

## 0. Website Content Direction

### Primary objective

The website should make one idea immediately understandable:

> Organizations do not only need a local AI model. They need a controlled AI work environment where confidential data, model choice, tool access, execution, verification, and audit remain under organizational control.

The page should explain **why ORION exists, what gap it addresses, how it controls AI execution, and what a real organizational workflow looks like.**

### What the website should NOT become

- Do not turn it into a long technical documentation page.
- Do not add 10–15 separate feature sections.
- Do not show generic claims such as “faster, smarter, safer” without explaining what changes operationally.
- Do not make “AI chatbot” the visual or messaging center of the page.
- Do not claim absolute security merely because the system is local.
- Do not present roadmap concepts as already-completed capabilities.
- Do not add a competitor ranking, score, or “better than everyone” messaging.
- Do not redesign the current UI just to fit the new copy.

### Messaging hierarchy

The copy should progress in this order:

**Confidential work cannot freely move to cloud AI → local inference alone is not enough → ORION adds control around local AI → the control is enforced during execution → the output becomes a verifiable work product.**

### Writing style

Use:
- Short headings.
- Explanatory body copy.
- Concrete industrial examples.
- Technical terms only when immediately understandable.
- Text-led presentation instead of decorative feature tiles.
- Strong nouns and verbs.
- No hype-heavy adjectives.
- No repetitive “secure / smart / powerful / seamless” marketing language.

---

# SECTION 1 — HERO / THE CORE PROBLEM

## Purpose

The first screen should communicate the problem and ORION’s answer in a few seconds.

The current UI should remain visually unchanged. Only the messaging hierarchy should be improved.

## Eyebrow

**CONFIDENTIAL INDUSTRIAL AI**

## Main heading

**AI assistance should not require sending confidential work outside the organization.**

## Supporting copy

Industrial teams work with inspection reports, engineering drawings, P&IDs, financial documents, internal code, vendor communications, approval notes, and unreleased designs.

For many organizations, that data cannot simply be sent to an external AI service.

This creates a practical gap:

**keep the work manual, or use AI without organizational control.**

## ORION statement

**ORION brings agentic AI into the organization’s own environment — with local models, local data, controlled tools, and auditable execution.**

## Small supporting line

**On-premise. Open-weight. Multimodal. Policy-controlled.**

## Optional CTA copy

Primary CTA:
**See How ORION Works**

Secondary CTA:
**View the Workflow**

## Hero micro-copy

**Designed for confidential knowledge work inside industrial and enterprise environments.**

---

# SECTION 2 — THE GAP

## Purpose

This section is important because it explains the gap identified during the problem analysis.

Do not present the gap as a generic “old way vs new way” marketing comparison. Explain the actual missing layer around AI.

## Section heading

**The gap is bigger than “cloud vs local.”**

## Intro paragraph

Running an open-weight model on an organization’s own hardware addresses where inference happens.

It does **not by itself answer** the questions that matter when AI starts working with confidential enterprise data:

- Which model is allowed to see this document?
- Can this user give the model access to that data?
- Which tools can the model call?
- What happens when a document contains an instruction meant to manipulate the agent?
- How is a long task verified before its output is delivered?
- What gets recorded for audit?
- How are new models introduced without bypassing existing controls?

**ORION is designed around this missing control layer.**

## Four gap blocks

### 01 — Local AI without execution control

A local model can keep inference inside the environment, but the surrounding workflow still needs rules for data access, tools, approvals, and actions.

**ORION:** policy checks happen during execution, not only at login or upload time.

### 02 — One model is not the right model for every task

A coding task, a scanned engineering report, and a simple document summary have different capability and resource requirements.

**ORION:** routes a task using task type, data sensitivity, model capability, available hardware, and permissions.

### 03 — A generated answer is not automatically a verified work product

Long agentic workflows can fail in the middle, retrieve incomplete evidence, or produce an output that does not satisfy the required policy.

**ORION:** checks evidence, policy constraints, and consistency before delivery, with retry/repair and human review paths.

### 04 — “Offline” must be demonstrable

A sovereign system should not depend only on a claim that the model is local.

**ORION:** is designed around deny-by-default network egress, local services, controlled tools, and visible audit/network evidence.

## Closing line

**The goal is not simply to run an LLM locally. The goal is to make AI usable inside a controlled organizational environment.**

---

# SECTION 3 — HOW ORION WORKS

## Purpose

Explain the actual mechanism without exposing the entire technical architecture.

This is the main explanatory section.

## Section heading

**From document to verified work — under organizational control.**

## Intro copy

ORION treats every AI task as a controlled execution flow.

The system evaluates the user, the data, the task, the available models, the tools, and the organization’s policies before deciding how the task should run.

## Core flow

### 01 — Data is classified

When a document enters ORION, it can be tagged by sensitivity, department, project, and document type.

**Example:**  
Maintenance Report → Confidential → Plant Maintenance → Inspection

### 02 — The task is understood

ORION identifies what the user is asking the system to do.

**Examples:**  
Summarize a report.  
Extract failure causes.  
Review code.  
Create an approval note.  
Prepare an Excel calculation.

### 03 — A suitable local model is selected

The router evaluates:

**Task + Sensitivity + Capability + Hardware + Permission → Model**

This prevents the system from treating every request as a generic “send to the biggest model” problem.

### 04 — Tool access is checked

Before an action runs, the permission layer decides whether the selected model and user are allowed to use the requested tool with that data.

**Examples:**  
Read a file → allowed  
Search confidential knowledge base → allowed  
Execute code → sandbox required  
Destructive action → human approval required

### 05 — The agent executes and iterates

The task can be broken into steps such as:

**Plan → Retrieve → Generate → Execute → Check → Repair → Continue**

A failed step does not necessarily require restarting the entire workflow.

### 06 — The result is verified before delivery

ORION can check:

- Evidence and citation coverage.
- Retrieved context against the generated answer.
- Policy and permission compliance.
- Basic consistency and sanity conditions.

If a check fails, the workflow can retry with corrected context or route the result for human review.

## Important implementation note

Keep this section conceptual on the main page.

Do **not** expose every runtime, database, OCR package, or framework here. Those details belong in technical documentation or the pitch deck.

---

# SECTION 4 — WHAT THE WORK LOOKS LIKE

## Purpose

Move the website from abstract architecture to actual organizational usage.

Use real workflow examples instead of a generic list of benefits.

## Section heading

**Built around the work people already do.**

## Intro copy

ORION is intended for workflows where the AI needs access to internal knowledge, files, calculations, or tools — but the work still needs to remain inside the organization’s environment.

## Use Case 1 — Inspection report → approval note

**Input**

A scanned maintenance inspection report containing typed pages, tables, and handwritten observations.

**ORION workflow**

Classifies the document → extracts text and visual information → retrieves relevant internal SOP content → identifies key findings → drafts the approval note → attaches source references → saves the final document locally.

**Output**

A usable Word document rather than only a chat response.

**Example evidence**

`Inspection_Report_2026.pdf — Page 4 — Section 2.1`

---

## Use Case 2 — Engineering data → calculation workbook

**Input**

Pump or equipment data provided in an internal document or spreadsheet.

**ORION workflow**

Reads the inputs → generates the calculation logic → executes the code inside an isolated sandbox → verifies the result → creates an Excel workbook.

**Output**

`efficiency_results.xlsx`

The calculation can be inspected instead of relying only on a model-generated number.

---

## Use Case 3 — Internal document question answering

**Input**

A question about an internal SOP, manual, or past report.

**ORION workflow**

Searches the organization’s local knowledge base → retrieves relevant passages → generates a grounded response → checks citation coverage → returns the answer with its source.

**Output**

A concise answer with traceable internal evidence.

---

## Optional Use Case 4 — Regulation / policy impact review

Use this only when the existing website has enough space.

**Input**

A new regulation or policy document.

**ORION workflow**

Extracts relevant clauses → matches them against labelled organizational policies and workflows → identifies potentially affected documents or processes → produces an impact report for human compliance/legal review.

**Important wording**

Use:

**“Identifies potential impact areas for review.”**

Do not use:

**“Provides final legal interpretation.”**

---

# SECTION 5 — CONTROL, TRUST & AUDIT

## Purpose

This section translates “security” into concrete controls.

Do not use the broad claim “100% secure.”

## Section heading

**Control is part of the execution — not an afterthought.**

## Intro copy

Confidential AI requires more than keeping a model on a local machine.

ORION is designed so that data access, model choice, tool usage, execution, and output handling can be governed and recorded.

## Control 1 — Data-aware access

A document’s sensitivity label can influence which models, tools, knowledge sources, and actions are available to it.

**Data carries policy from storage into execution.**

## Control 2 — Runtime permissioning

Access is evaluated when an action is about to happen:

**User + Data + Model + Tool + Permission → Allow / Block**

This makes permissions part of the workflow rather than a one-time configuration.

## Control 3 — Tool isolation

Code execution and other sensitive actions can run through isolated, allowlisted tooling.

Potentially destructive actions can require human approval.

## Control 4 — Verification and repair

The system can validate evidence coverage and policy conditions before delivering the result.

**Fail → Repair / Retry → Re-check → Human Review when required**

## Control 5 — Audit trail

The system can record:

- Who initiated the task.
- Which data was involved.
- Which model was selected.
- Which tools were called.
- Which policy decision was made.
- What verification step occurred.

## Control 6 — Air-gap / network boundary

The deployment can use:

- Deny-by-default outbound network access.
- Local-only services.
- Restricted internal networking.
- Offline dependencies or internal mirrors.
- Network monitoring during validation/demo.

## Important wording

Prefer:

**“ORION reduces data exposure through on-premise execution, policy-controlled access, isolated tools, and auditable workflows.”**

Avoid:

**“ORION makes the organization completely secure.”**

---

# SECTION 6 — DEPLOYMENT, PROOF & CLOSING

## Purpose

End the page with feasibility and proof instead of a generic “future of AI” statement.

## Section heading

**AI that can be deployed where the work already lives.**

## Main copy

ORION is designed for organizations that want modern AI capabilities without moving confidential working data to an external AI environment.

It can be deployed on organizational infrastructure using open-weight models and local inference runtimes, with the option to operate inside tightly controlled or air-gapped environments.

## Deployment statement

**Local infrastructure → Local models → Local knowledge → Controlled tools → Auditable outputs**

## Proof statement

A credible ORION deployment should demonstrate more than a chatbot screen.

The working proof should show:

**1. A confidential document stays inside the environment.**  
**2. The system classifies the data.**  
**3. A suitable model is selected for the task.**  
**4. Tool access is checked before execution.**  
**5. The agent completes a multi-step workflow.**  
**6. The final work product includes evidence or verification.**  
**7. Network logs show that the workflow did not make unintended external calls.**

## Closing headline

**Bring AI to the work. Not the work to the AI provider.**

## Closing copy

**ORION is a sovereign AI workbench for organizations where confidentiality is not an optional setting, but a requirement of the work itself.**

## Final CTA

Primary:
**Explore the ORION Workflow**

Secondary:
**View Technical Architecture**

---

# 7. Content That Should NOT Be Put on the Main Page

The source analysis contains several valuable technical details that are better kept out of the main single-page website.

Move these into the PPT, technical document, GitHub README, or demo:

### Detailed hardware matrix

Examples such as:
- GTX 1660 / RTX 3060
- RTX 3080 / 4070
- RTX 3090 / 4090

These are useful for technical proof but make the website feel like documentation.

### Full technology inventory

Avoid showing every package on the page:

- Ollama
- llama.cpp
- vLLM
- Qdrant / LanceDB / Milvus
- Tesseract / PaddleOCR / EasyOCR
- Qwen2.5-VL / LLaVA / InternVL
- bge-m3 / e5-mistral
- OPA
- FastAPI / Node.js
- python-docx / openpyxl / python-pptx

A compact technology strip can remain elsewhere in the existing UI if one already exists.

### Full threat matrix

The threat table is useful for the PPT/technical report but too dense for the landing page.

### Full model-admission process

Model regression testing, benchmark criteria, security checks, tool behavior testing, and resource requirements should be technical documentation.

### Business model details

License, setup fee, support plan, and enterprise pricing are useful in a pitch/business section, but are not necessary on the core landing page unless the current site already has such a section.

### Full competitor comparison

Do not turn the website into a competitor battle. Use the website to explain the missing control layer and show what ORION actually does.

---

# 8. Final Six-Section Structure

The final page should contain exactly these six content sections:

1. **Hero — AI assistance should not require sending confidential work outside the organization.**
2. **The Gap — The gap is bigger than “cloud vs local.”**
3. **How ORION Works — From document to verified work — under organizational control.**
4. **Real Workflows — Built around the work people already do.**
5. **Control, Trust & Audit — Control is part of the execution — not an afterthought.**
6. **Deployment, Proof & Closing — AI that can be deployed where the work already lives.**

The existing navigation can be mapped to these sections without changing its visual design.

---

# 9. UI Preservation Rules for the Coding Agent

The website implementation agent must treat the existing UI as a fixed design system.

### Do not change

- Overall page layout.
- Navigation style.
- Typography system unless required for content fit.
- Existing color palette.
- Existing buttons.
- Existing animations.
- Existing card style.
- Existing spacing rhythm.
- Existing responsive behavior.
- Existing branding.
- Existing technical stack.

### Allowed changes

- Replace or rewrite existing text.
- Reorder content within existing section containers.
- Remove redundant text blocks.
- Consolidate multiple feature blocks into explanatory text.
- Adjust text lengths so the current layout remains clean.
- Rename section labels where necessary.
- Add only minimal structural wrappers when needed to support the six-section content plan.

### If current UI has more than six sections

Do not create a completely new design.

Instead:
- Merge related sections.
- Remove repeated content.
- Move dense technical details out of the landing page.
- Preserve the visual system.
- Keep the result as a single-page site.

---

# 10. Accuracy / Claim Guardrails

The agent must not silently convert planned/future functionality into a current capability.

Use wording such as:

- **“designed to”**
- **“can”**
- **“intended for”**
- **“supports the architecture for”**
- **“prototype demonstrates”**

when implementation status is not established.

Only use:

- **“implemented”**
- **“working”**
- **“demonstrated”**
- **“tested”**

when the existing code/repo actually proves it.

Do not claim:
- perfect security,
- zero hallucinations,
- complete legal compliance,
- guaranteed offline behavior,
- universal model compatibility,
- production readiness,

unless the implementation and evidence support those claims.

---

# 11. The Core Narrative in One Paragraph

This is the mental model the website should communicate from top to bottom:

**Confidential industrial teams need AI, but they cannot treat external cloud AI as a default destination for sensitive work. Moving a model on-premise addresses only one part of the problem. ORION adds the missing execution layer: it classifies data, evaluates the task, routes work to suitable local models, controls tool access at runtime, executes multi-step workflows, verifies the resulting work product, and maintains an audit trail. The result is not merely a local chatbot, but an AI workbench designed to operate within the organization’s own data and control boundary.**

---

# 12. Source Basis

This content plan is derived from the supplied ORION master problem/solution document, including:

- Official SIH problem statement and context.
- ORION vision and core capabilities.
- Technical architecture.
- Identified weak points and concrete fixes.
- Security/threat-model corrections.
- Verification pipeline.
- Multimodal proof requirements.
- Compliance scope correction.
- Hardware/deployment considerations.
- User flow and end-to-end demo requirements.

See the supplied source for the underlying detailed rationale and implementation notes.
