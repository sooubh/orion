# Orion System-Wide Forensic Audit & Comprehensive Remediation Plan (`fix.md`)

> **Platform:** Orion — Sovereign Intelligence Platform  
> **Repository Root:** `/data/data/com.termux/files/home/orion`  
> **Audit Status:** Complete  
> **Version:** 1.0.0-PROD-AUDIT  

---

## Table of Contents

1. [Executive Summary & Core Root Causes](#1-executive-summary--core-root-causes)
2. [AI Response & Chat Streaming Pipeline](#2-ai-response--chat-streaming-pipeline)
3. [Document Ingestion, Processing & Collector Pipeline](#3-document-ingestion-processing--collector-pipeline)
4. [RAG, Embeddings & Vector Store Architecture](#4-rag-embeddings--vector-store-architecture)
5. [Frontend UI, Color Mismatches & Visual Glitches](#5-frontend-ui-color-mismatches--visual-glitches)
6. [Dynamic Model Routing, Verification & Policy Systems](#6-dynamic-model-routing-verification--policy-systems)
7. [System Architecture, Security, Prisma & Code Cleanliness](#7-system-architecture-security-prisma--code-cleanliness)
8. [Antigravity Customization System Alignment (`agy-customizations`)](#8-antigravity-customization-system-alignment-agy-customizations)
9. [Prioritized Implementation Roadmap & Action Checklist](#9-prioritized-implementation-roadmap--action-checklist)

---

## 1. Executive Summary & Core Root Causes

A comprehensive multi-agent forensic audit was conducted across the entire Orion platform codebase (`server/`, `frontend/`, `collector/`, and root configurations). The audit verified all runtime execution paths, database models, API contracts, streaming protocols, UI theme engines, and security boundaries.

### Why AI Responses & Document Features Were Malfunctioning:
1. **Inverted Vector Similarity Filter:** Vector distance-to-similarity conversion in `lance`, `chroma`, and `pgvector` contained `if (distance >= 1.0) return 1`. Because cosine distance is bounded in $[0, 2]$, completely orthogonal or opposite documents were scored as **1.0 (100% relevant)** and injected into the prompt, while relevant documents were discarded.
2. **Catastrophic Chat History Reversal:** In `server/utils/helpers/chat/index.js`, in-place `rawHistory.reverse()` calls mutated the conversation array multiple times during context assembly. Combined with an arbitrary 3-iteration break, the LLM was fed only the **3 oldest messages** of the chat, discarding all recent conversation turns.
3. **Hybrid Search Overfitting & False Abort:** `HybridSearch` only extracted hardcoded equipment codes (`C-204`, `TK-01`) and pressure/vibration units (`mm/s`, `bar`). Standard natural language queries scored 0 lexical matches, dropped below similarity thresholds, and returned a truthy message that caused `stream.js` to **abort the chat** instead of responding.
4. **Catastrophic Cross-Workspace Document Purge:** In `server/endpoints/workspaces.js`, clicking "Delete" or "Unembed" in a single workspace called `purgeDocument()`, which iterated through **every workspace in the entire database** and deleted the document and its embeddings globally.
5. **Cross-Model Vector Dimension Poisoning:** `cachedVectorInformation` generated cache keys using only `uuidv5(filename)` without encoding the embedding engine, model, or dimension. Switching models caused 384-d vectors to load into 1536-d tables, crashing vector queries.
6. **Fatal Protocol & Import Mismatches:** Backend emitted `{ id: uuid }` while frontend expected `{ uuid }`. `server/endpoints/chat.js` leaked SSE connections when quotas were hit by failing to call `response.end()`. In `WorkspaceChat/index.jsx`, `safeJsonParse` was not imported, causing instant runtime crashes.
7. **Destructive Global `.text-white` CSS Override:** In `src/index.css`, `[data-theme="light"] .text-white { color: #181b1f !important; }` forced all white text to dark gray, turning solid colored buttons (sky, indigo, red) into black text on dark backgrounds (< 2.1:1 contrast) and tooltips into black text on black backgrounds.

---

## 2. AI Response & Chat Streaming Pipeline

### Root Causes & Defects

#### Defect 2.1: In-Place Chat History Mutation & Truncation
- **Files & Lines:** `server/utils/helpers/chat/index.js:132, 246, 410`
- **Root Cause:**
  - `fillSourceWindow` (line 410) invokes `history.reverse()`. Because JavaScript arrays are passed by reference, this mutates `rawHistory` in-place.
  - `rerankMemories` then grabs the 3 oldest messages instead of recent ones.
  - `messageArrayCompressor` (line 132) calls `rawHistory.reverse()` again and executes:
    ```javascript
    for (let i = 0; i < rawHistory.length; i++) {
      if (i > 2) break; // Hard breaks after 3 iterations!
    }
    ```
  - Result: Only 3 historical messages reach the LLM, and in inverted chronological order.

#### Defect 2.2: SSE Event Identifier Mismatch (`id` vs `uuid`)
- **Files & Lines:**
  - `server/endpoints/chat.js:34, 52, 93, 121, 139, 199`
  - `server/utils/chats/stream.js:73, 107, 207, 280`
  - `frontend/src/utils/chat/index.js:16`
- **Root Cause:**
  - Backend writes `{ id: uuid, type: "abort", ... }`.
  - Frontend destructures `const { uuid, textResponse, type, sources, error, close } = data;`.
  - Because `uuid` is undefined, frontend message tracking and error status indicators fail.

#### Defect 2.3: Connection Leaks on Quota Limit Exceeded
- **Files & Lines:** `server/endpoints/chat.js:50–60, 137–147`
- **Root Cause:**
  ```javascript
  if (multiUserMode(response) && !(await User.canSendChat(user))) {
    writeResponseChunk(response, { ... });
    return; // MISSING: response.end()!
  }
  ```
  The HTTP request remains open indefinitely, consuming file descriptors and keeping browser spinners active.

#### Defect 2.4: Automatic Agent Hijacking of Standard Workspace Chats
- **Files & Lines:** `server/utils/chats/agents.js:51–55`, `server/models/workspace.js:673–715`
- **Root Cause:**
  Workspaces default to `chatMode: "automatic"`. If any provider reports native tool calling capabilities (e.g. Ollama, Foundry, LM Studio), `grepAgents` intercepts every regular user chat message, terminates HTTP streaming, and redirects to WebSocket agent routines.

#### Defect 2.5: Prisma Schema Violation in `WorkspaceChats.upsert`
- **File & Lines:** `server/models/workspaceChats.js:367–371`
- **Root Cause:**
  `prisma.workspace_chats.upsert({ where: { id: Number(chatId), user_id: ... } })` violates Prisma's requirement that composite keys in `where` must be explicitly defined as `@unique` in `schema.prisma`. Furthermore, `const { chat } = await prisma...` destructures a non-existent property (`chat` is undefined).

#### Defect 2.6: Provider-Specific Streaming Failures
- **Foundry (`server/utils/AiProviders/foundry/index.js:379`):** Hardcoded 500ms inactivity timeout (`diffMs >= 500`) abruptly kills response streams if token generation pauses for half a second.
- **Generic OpenAI (`server/utils/AiProviders/genericOpenAi/index.js:38`):** Hardcodes `max_tokens: 1024`, truncating long responses. Breaks loop on `finish_reason`, dropping the final `usage` telemetry chunk.
- **KoboldCPP (`server/utils/AiProviders/koboldCPP/index.js:206–244`):** Missing try/catch around stream chunk parsing; hangs indefinitely if `finish_reason` is omitted.
- **TextGenWebUI (`server/utils/AiProviders/textGenWebUI/index.js:11, 24`):** Constructor omits `modelPreference` and sends `model: null` to OpenAI client.
- **Reasoning Models (Ollama `<think>` tags):** When a model outputs within `<think>` and finishes without outside text, `reasoningText` is discarded, resolving `completeText` to an empty string.

---

### Step-by-Step Fixes for Section 2

```diff
--- a/server/utils/helpers/chat/index.js
+++ b/server/utils/helpers/chat/index.js
@@ -128,7 +128,7 @@ async function messageArrayCompressor(
   messageArray = [],
   rawHistory = []
 ) {
-  const history = [...rawHistory].reverse();
+  const history = [...rawHistory]; // Preserve chronological order without mutating original
   const compressedHistory = [];
-  for (let i = 0; i < history.length; i++) {
-    if (i > 2) break;
+  for (let i = history.length - 1; i >= 0; i--) {
     const message = history[i];
     // compress tokens appropriately

--- a/server/endpoints/chat.js
+++ b/server/endpoints/chat.js
@@ -34,7 +34,8 @@ function chatEndpoints(app) {
         if (typeof message !== "string" || message.trim().length === 0) {
           response.status(400).json({
-            id: uuidv4(),
+            uuid: uuidv4(),
+            id: uuidv4(),
             type: "abort",
             textResponse: null,
@@ -58,6 +59,7 @@ function chatEndpoints(app) {
             error: `You have met your maximum 24 hour chat quota of ${user.dailyMessageLimit} chats. Try again later.`,
           });
+          response.end();
           return;
         }
```

---

## 3. Document Ingestion, Processing & Collector Pipeline

### Root Causes & Defects

#### Defect 3.1: Global Cross-Workspace Purge in `remove-and-unembed`
- **Files & Lines:** `server/endpoints/workspaces.js:878–915`, `server/utils/files/purgeDocument.js:40–47`
- **Root Cause:**
  When a user removes an embedded document from a specific workspace, line 915 calls `await purgeDocument(docLocation)`. In `purgeDocument.js`:
  ```javascript
  const workspaces = await Workspace.where();
  for (const workspace of workspaces) {
    await Document.removeDocuments(workspace, [resolvedLocation, forwardNormalized, bareFilename]);
  }
  await purgeSourceDocument(resolvedLocation);
  ```
  This unlinks the file from storage and purges it from **every other workspace** where it was embedded.

#### Defect 3.2: LanceDB Un-scoped `title = '...'` Vector Deletions
- **Files & Lines:** `server/models/documents.js:248–253`, `server/utils/vectorDbProviders/lance/index.js:335–338`
- **Root Cause:**
  `Document.removeDocuments` executes:
  ```javascript
  await VectorDb.deleteDocumentFromNamespace(workspace.slug, document.docId, cleanTitle ? `title = '${cleanTitle}'` : null);
  ```
  LanceDB deletes all rows matching `title = 'cleanTitle'` without scoping by `docId`. If multiple documents share a generic name (e.g. `README.md`, `data.csv`), all vectors for all documents sharing that title are wiped.

#### Defect 3.3: 50% Token Count Undercount in Collector
- **File & Lines:** `collector/utils/tokenizer/index.js:4–5, 47`
- **Root Cause:**
  For any text $>10\text{KB}$, the tokenizer skips `cl100k_base` and computes:
  ```javascript
  return Math.ceil(input.length / 8); // DIVISOR = 8
  ```
  English text averages 3.8 to 4 characters per token. Dividing by 8 produces half the actual token count, causing context window overflows downstream.

#### Defect 3.4: Inverted PDF Metadata & Missing Whitespace
- **Files & Lines:**
  - `collector/processSingleFile/convert/asPDF/index.js:55, 59–67`
  - `collector/processSingleFile/convert/asPDF/PDFLoader/index.js:33–44`
  - `collector/processSingleFile/convert/asDocx.js:38`
- **Root Cause:**
  - `pageContent.join("")` joins pages with an empty string, fusing words across page splits.
  - In `asPDF/index.js`, `pdf.info.Title` is saved into metadata as `description`, while `title` falls back to the raw file name.
  - In `PDFLoader`, text tokens on the same horizontal line (`lastY === item.transform[5]`) are concatenated without spaces.

#### Defect 3.5: Ingestion of Raw HTML/RTF Markup as Text
- **File & Lines:** `collector/utils/constants.js:136, 145–147`
- **Root Cause:**
  `.html`, `.htm`, `.xhtml`, and `.rtf` files are mapped directly to `asTxt.js`. Raw tags (`<html>`, `<script>`, `<style>`) and RTF control words (`{\rtf1\ansi...}`) are directly embedded into vector tables.

#### Defect 3.6: Production Integrity Verification Bug
- **Files & Lines:** `collector/middleware/verifyIntegrity.js:20`, `collector/utils/comKey/index.js:32–39`
- **Root Cause:**
  Express `bodyParser.json()` parses the request body into a JavaScript object. `verifyPayloadIntegrity` calls `comKey.verify(JSON.stringify(request.body))`. Key re-serialization order is non-deterministic in V8, causing valid requests to fail in production (`NODE_ENV=production`) with HTTP 400 "Failed integrity signature check".

---

### Step-by-Step Fixes for Section 3

```diff
--- a/server/endpoints/workspaces.js
+++ b/server/endpoints/workspaces.js
@@ -908,8 +908,10 @@ function workspaceEndpoints(app) {
         if (!currWorkspace) return response.sendStatus(404).end();

         const docLocation = body?.documentLocation || body?.filename || body?.docpath;
-        await purgeDocument(docLocation);
+        // Only remove document from the current workspace, do not nuke globally!
+        await Document.removeDocuments(currWorkspace, [docLocation]);
         return response.status(200).json({ message: "Document removed from workspace" });

--- a/collector/utils/tokenizer/index.js
+++ b/collector/utils/tokenizer/index.js
@@ -46,3 +46,3 @@ function approxTokenCount(input = "") {
   if (!input || input.length === 0) return 0;
-  return Math.ceil(input.length / 8);
+  return Math.ceil(input.length / 3.8); // Standard character-to-token ratio for multilingual/code

--- a/collector/processSingleFile/convert/asPDF/index.js
+++ b/collector/processSingleFile/convert/asPDF/index.js
@@ -55,3 +55,3 @@ async function asPDF({ fullFilePath, filename, options = {}, metadata = {} }) {
-    const content = pageContent.join("");
+    const content = pageContent.join("\n\n");
```

---

## 4. RAG, Embeddings & Vector Store Architecture

### Root Causes & Defects

#### Defect 4.1: Inverted Cosine Distance-to-Similarity Conversion
- **Files & Lines:**
  - `server/utils/vectorDbProviders/lance/index.js:43–48`
  - `server/utils/vectorDbProviders/chroma/index.js:112–117`
  - `server/utils/vectorDbProviders/pgvector/index.js:340–345`
- **Root Cause:**
  ```javascript
  distanceToSimilarity(distance = null) {
    if (distance === null || typeof distance !== "number") return 0.0;
    if (distance >= 1.0) return 1; // <--- FATAL INVERSION
    if (distance < 0) return 1 - Math.abs(distance);
    return 1 - distance;
  }
  ```
  Cosine distance is $d = 1 - \cos(\theta) \in [0, 2]$. Orthogonal vectors ($d = 1.0$) and opposite vectors ($d > 1.0$) returned $1.0$ (100% relevant). Irrelevant chunks passed the similarity filter and pushed valid context out of prompt budgets.

#### Defect 4.2: HybridSearch Memory Dump & Regex Overfitting
- **File & Lines:** `server/utils/retrieval/hybridSearch.js:59–92, 251–258, 444`
- **Root Cause:**
  - L251–258: Runs `table.query().toArray()` on LanceDB on every query, dumping the entire table into Node.js heap memory.
  - L59–92: Only recognizes hardcoded equipment patterns (`[A-Z]{1,3}-\d{2,4}`) and units (`mm/s|bar|A|C|°C`). General queries receive zero lexical score.
  - L444: When no chunks pass the threshold, returns `message: "No relevant document was found in the current workspace."`. In `stream.js:205–215`, this triggers an immediate `type: "abort"` SSE event instead of allowing the model to answer generally.

#### Defect 4.3: Unkeyed Vector Cache Dimension Poisoning
- **File & Lines:** `server/utils/files/index.js:256–286`
- **Root Cause:**
  Cache files are named `uuidv5(filename, uuidv5.URL)`. When the user switches embedding providers (e.g. from 384-d `all-MiniLM-L6-v2` to 1536-d `text-embedding-3-small`), cached 384-d vectors are inserted into 1536-d tables, causing unrecoverable dimension mismatch crashes.

#### Defect 4.4: Qdrant Cached Vector Ingestion Failure
- **File & Lines:** `server/utils/vectorDbProviders/qdrant/index.js:201–211`
- **Root Cause:**
  Ingestion checks `if (chunk?.payload?.hasOwnProperty("id"))`. Because chunk IDs are stored at `vectorRecord.id`, `chunk.payload.id` is undefined. 100% of cached vectors are skipped, resulting in empty Qdrant collections.

#### Defect 4.5: TextSplitter Double-Splitting
- **File & Lines:** `server/utils/TextSplitter/index.js:173–203`
- **Root Cause:**
  Splits text to `chunkSize`, then calls LangChain `createDocuments` with `chunkHeader`. The prepended header pushes each chunk over `chunkSize`, causing LangChain to recursively split chunks into tiny micro-slivers.

---

### Step-by-Step Fixes for Section 4

```diff
--- a/server/utils/vectorDbProviders/lance/index.js
+++ b/server/utils/vectorDbProviders/lance/index.js
@@ -43,6 +43,4 @@ class LanceDb extends VectorDatabase {
   distanceToSimilarity(distance = null) {
-    if (distance === null || typeof distance !== "number") return 0.0;
-    if (distance >= 1.0) return 1;
-    if (distance < 0) return 1 - Math.abs(distance);
-    return 1 - distance;
+    if (distance === null || typeof distance !== "number" || isNaN(distance)) return 0.0;
+    return Math.max(0.0, Math.min(1.0, 1.0 - distance));
   }

--- a/server/utils/retrieval/hybridSearch.js
+++ b/server/utils/retrieval/hybridSearch.js
@@ -443,4 +443,4 @@ class HybridSearch {
       return {
         contextTexts: [],
         sources: [],
-        message: "No relevant document was found in the current workspace.",
+        message: null, // Allow conversational LLM fallback when 0 chunks match
       };

--- a/server/utils/files/index.js
+++ b/server/utils/files/index.js
@@ -257,5 +257,7 @@ function cachedVectorInformation(filename = null) {
   if (!filename) return null;
+  const engine = process.env.EMBEDDING_ENGINE || "native";
+  const model = process.env.EMBEDDING_MODEL_PREF || "default";
   const vectorCachePath = path.resolve(vectorCacheDir);
-  const cacheFilename = `${uuidv5(filename, uuidv5.URL)}.json`;
+  const cacheFilename = `${uuidv5(`${filename}:${engine}:${model}`, uuidv5.URL)}.json`;
   const cacheFilePath = path.resolve(vectorCachePath, cacheFilename);
```

---

## 5. Frontend UI, Color Mismatches & Visual Glitches

### Root Causes & Defects

#### Defect 5.1: Fatal Runtime Crash in `WorkspaceChat`
- **File & Lines:** `frontend/src/pages/WorkspaceChat/index.jsx:39–41`
- **Root Cause:** Calls `safeJsonParse(localStorage.getItem(LAST_VISITED_WORKSPACE))` without importing `safeJsonParse`. Accessing `/workspace` without a slug crashes the app immediately.

#### Defect 5.2: Mobile Navigation Lockout (Dead Hamburger Menu)
- **File & Lines:** `frontend/src/components/Sidebar/index.jsx:255–278`
- **Root Cause:** Main pages render `{!isMobile ? <Sidebar /> : <SidebarMobileHeader />}`. The hamburger button in `SidebarMobileHeader` toggles a local `useState(false)` that is never connected to any navigation drawer. Mobile users cannot open the sidebar.

#### Defect 5.3: Destructive Global `.text-white` Override in Light Mode
- **File & Lines:** `frontend/src/index.css:1450–1453`
- **Root Cause:**
  `body.light .text-white, [data-theme="light"] .text-white { color: #181b1f !important; }`
  Forces all elements with `.text-white` to dark charcoal `#181b1f`. Solid colored buttons (`bg-sky-600 text-white`, `bg-indigo-600 text-white`) become illegible black text on dark buttons (< 2.1:1 contrast). Tooltips (`.tooltip` with `bg-black text-white`) render black text on a black background.

#### Defect 5.4: Amber Warning Buttons Hijacked to Blue
- **File & Lines:** `frontend/src/index.css:1298–1299, 1545–1548`
- **Root Cause:**
  `button.bg-amber-500, a.bg-amber-500` forces the background color to `#3b6998 !important` (dark) and `#2c527a !important` (light), stripping warning colors from `HumanReviewCard` and alerts.

#### Defect 5.5: Inverted Tailwind Pseudo-Variant Syntax (`hover:light:`)
- **Occurrences:** 20 instances across the codebase (e.g. `SettingsSidebar/index.jsx:237`, `ThreadItem/index.jsx:92`, `UserRow/index.jsx:71`).
- **Root Cause:** Written as `hover:light:` instead of `light:hover:`. Tailwind cannot parse this order, causing hover styles in light mode to fail completely.

#### Defect 5.6: Nested Double Modal Cards in `DocumentsPage`
- **File & Lines:** `frontend/src/pages/Documents/index.jsx:603–605, 713–715`
- **Root Cause:**
  The `Modal` component already provides a themed card shell. `Documents/index.jsx` nests a second `<div className="p-6 space-y-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-white">` inside preview and review modals. In light mode, this renders a pitch-black inner card inside a white modal shell with double padding (48px).

#### Defect 5.7: Missing Core Asset `public/favicon.svg` (HTTP 404)
- **Files & Lines:** `frontend/index.html:6, 23, 24`, `public/manifest.json:9`
- **Root Cause:** `favicon.svg` is referenced in the document head and PWA manifest but does not exist in `public/`.

---

### Step-by-Step Fixes for Section 5

```diff
--- a/frontend/src/pages/WorkspaceChat/index.jsx
+++ b/frontend/src/pages/WorkspaceChat/index.jsx
@@ -8,6 +8,7 @@ import PasswordModal, {
 } from "@/components/Modals/Password";
 import { useParams } from "react-router-dom";
 import { LAST_VISITED_WORKSPACE } from "@/utils/constants";
+import { safeJsonParse } from "@/utils/request";

--- a/frontend/src/index.css
+++ b/frontend/src/index.css
@@ -1450,4 +1450,0 @@
-body.light .text-white,
-[data-theme="light"] .text-white {
-  color: #181b1f !important;
-}

--- a/frontend/src/pages/Documents/index.jsx
+++ b/frontend/src/pages/Documents/index.jsx
@@ -603,3 +603,3 @@ export default function DocumentsPage() {
       <Modal isOpen={!!selectedDocForPreview} close={() => setSelectedDocForPreview(null)}>
-        <div className="p-6 space-y-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-white">
+        <div className="space-y-4 text-theme-text-primary">
```

---

## 6. Dynamic Model Routing, Verification & Policy Systems

### Root Causes & Defects

#### Defect 6.1: External `uuid` & Static Prisma Crashes
- **Files & Lines:**
  - `server/utils/modelRouting/index.js:1`
  - `server/utils/modelRouting/adapter/OrionContextAdapter.js:1`
  - `server/utils/checkpoints/manager.js:1`
  - `server/utils/helpers/chat/responses.js:2` (`moment`)
- **Root Cause:** External package `uuid` and `moment` are required in runtime paths where native `crypto.randomUUID()` and native `Intl` should be used. Furthermore, pure domain logic (`PolicyEngine`, `repair.js`, `checkpoints`) imports Prisma models statically, crashing when Prisma engine binaries are not pre-generated.

#### Defect 6.2: TaskClassifier Modality Overrides Functional Intent
- **File & Lines:** `server/utils/modelRouting/classifier/TaskClassifier.js:55–70`, `taxonomy.js:64–67`
- **Root Cause:**
  - Prompts mentioning "chart" or attaching an image are forced to `MULTIMODAL_ANALYSIS`, skipping `DOCUMENT_EXTRACTION` or `DOCUMENT_SUMMARY`.
  - Prompts with words like "class", "function", or "import" are forced to `CODE_GENERATION`, misclassifying prompts like *"Summarize this Python script"* or regular English queries containing "class".

#### Defect 6.3: Verification Infinite Loop on Missing `stepId`
- **File & Lines:** `server/utils/verification/index.js:180–183`, `repair.js:42–139`
- **Root Cause:**
  If `step.stepId` is missing, `index.js` assigns `step_${Date.now()}` on each attempt. `this.attempts.get(stepId)` is always 0, so the max retry threshold (2) is never reached. Additionally, `repair.js` appends feedback without stripping previous `[SELF-REPAIR INSTRUCTION ...]` headers, recursively bloating prompt context.

#### Defect 6.4: Cloud Provider Detection Bypass in `evaluateKnowledgePolicy`
- **File & Lines:** `server/utils/policy/index.js:338`
- **Root Cause:**
  `evaluateModelPolicy` uses `.some(cp => normTarget.includes(cp))`, but `evaluateKnowledgePolicy` uses strict equality `CLOUD_PROVIDERS.includes(String(provider).toLowerCase())`. Providers formatted like `"openai/gpt-4o"` bypass the cloud knowledge filter.

---

### Step-by-Step Fixes for Section 6

```diff
--- a/server/utils/modelRouting/index.js
+++ b/server/utils/modelRouting/index.js
@@ -1,2 +1,2 @@
-const { v4: uuidv4 } = require("uuid");
+const { randomUUID: uuidv4 } = require("crypto");

--- a/server/utils/verification/index.js
+++ b/server/utils/verification/index.js
@@ -180,3 +180,4 @@ class VerificationManager {
     const stepId = step.stepId || `step_${Date.now()}`;
+    if (!step.stepId) step.stepId = stepId; // Persist stepId to prevent infinite repair loops
     const currentAttempts = this.attempts.get(stepId) || 0;
```

---

## 7. System Architecture, Security, Prisma & Code Cleanliness

### Root Causes & Defects

#### Defect 7.1: Missing Root Workspaces & Broken Build Pipelines
- **Files:** `/package.json`, `.github/workflows/run-tests.yaml`
- **Root Cause:** Root lacks `"workspaces": ["frontend", "server", "collector"]`. Running `npm install` at root skips sub-packages. CI workflows reference nonexistent `yarn setup:envs` and `yarn prisma:setup` scripts.

#### Defect 7.2: Six Tables Missing from `schema.prisma`
- **File:** `server/prisma/schema.prisma` vs `server/prisma/migrations/`
- **Root Cause:** The following migration tables are missing from `schema.prisma`:
  1. `document_sync_queues`
  2. `document_sync_executions` (referenced in `server/models/documentSyncRun.js`)
  3. `desktop_mobile_devices`
  4. `external_communication_connectors`
  5. `scheduled_jobs`
  6. `scheduled_job_runs`
  Running `prisma migrate dev` drops these tables and destroys data.

#### Defect 7.3: Security Vulnerabilities & Middleware Bypasses
- **`validatedRequest.js:14–31`:** Bypasses authentication in development mode or whenever `AUTH_TOKEN` is unset in single-user mode.
- **`server/index.js:149–176` (`/v/:command`):** Exposes direct execution of arbitrary methods on `VectorDb` with zero authentication in dev mode.
- **`server/endpoints/system.js:88–93` (`/api/env-dump`):** Unauthenticated endpoint in production that dumps in-memory environment variables to the `.env` file on disk.
- **`server/endpoints/system.js:215–251`:** Leaks invalid username (`[001]`) vs invalid password (`[002]`), enabling user enumeration.
- **Plaintext API Keys:** `api_keys.secret` and `browser_extension_api_keys.key` are stored in SQLite in plaintext without cryptographic hashing.
- **Unbounded Memory Leaks:** `responseCache = new Map()` in `workspaces.js:42` and `reviewsStore = new Map()` in `review.js:11` store binary audio and specialist reviews indefinitely without TTL or size limits.

#### Defect 7.4: Legacy Branding Residue
- 198+ occurrences of `anythingllm` and 73 occurrences of `mintplex` remain in localStorage keys, export file headers, and agent manifests.

---

## 8. Antigravity Customization System Alignment (`agy-customizations`)

To align the project with Google Antigravity standards as specified in the `agy-customizations` and `antigravity-guide` skills:

### 1. Workspace Configuration Structure
Establish project-level rules and agent definitions under `.agents/`:
```
/data/data/com.termux/files/home/orion/
├── .agents/
│   ├── rules/
│   │   ├── code-style.md
│   │   ├── security-boundaries.md
│   │   └── testing-standards.md
│   └── skills/
│       └── orion-runtime/
│           └── SKILL.md
├── GEMINI.md
└── AGENTS.md
```

### 2. `GEMINI.md` Project Specification
Create `GEMINI.md` in the repository root to define architectural boundaries, prohibit cloud telemetry leaks, and enforce safe retrieval patterns.

---

## 9. Prioritized Implementation Roadmap & Action Checklist

### Phase 1: Critical Fixes (P0) — Immediate Execution
- [ ] **RAG / Vector Math:** Fix `distanceToSimilarity` in `lance`, `chroma`, `pgvector` (`Math.max(0, 1 - distance)`).
- [ ] **Chat Pipeline:** Fix `rawHistory` in-place mutation in `helpers/chat/index.js`; align `uuid` in SSE payloads.
- [ ] **Document Purge:** Restrict `remove-and-unembed` to current workspace; fix LanceDB un-scoped title deletion.
- [ ] **Frontend Crash:** Import `safeJsonParse` in `pages/WorkspaceChat/index.jsx`.
- [ ] **Theme Contrast:** Remove blanket `[data-theme="light"] .text-white` override from `index.css`.
- [ ] **Dependencies:** Replace external `uuid` with `crypto.randomUUID()` in `modelRouting` and `checkpoints`.

### Phase 2: High Priority (P1)
- [ ] **Hybrid Search:** Implement proper Reciprocal Rank Fusion (RRF); remove full table dump from LanceDB.
- [ ] **Vector Cache:** Encode engine and model in cache key in `server/utils/files/index.js`.
- [ ] **Collector Tokenizer:** Correct `DIVISOR = 8` to `3.8` in `collector/utils/tokenizer/index.js`.
- [ ] **Prisma Schema:** Add the 6 missing migration tables to `schema.prisma` and run `npx prisma generate`.
- [ ] **Security:** Patch `validatedRequest.js` authentication bypass and remove `/api/env-dump`.

### Phase 3: Medium Priority (P2)
- [ ] **Mobile Sidebar:** Wire `SidebarMobileHeader` to a functional mobile navigation drawer.
- [ ] **Tailwind Syntax:** Invert all `hover:light:` classes to `light:hover:`.
- [ ] **Double Modals:** Clean up nested container cards in `Documents/index.jsx`.
- [ ] **Directory Widths:** Make Directory tables responsive with `max-w-[560px] w-full`.
- [ ] **Memory Leaks:** Replace unbounded Map caches in `workspaces.js` and `review.js` with LRU caches.

### Phase 4: Polish & Standards (P3)
- [ ] **Branding:** Sanitize remaining `anythingllm_*` localStorage keys and export headers.
- [ ] **Workspaces:** Add `"workspaces": ["server", "frontend", "collector"]` to root `package.json`.
- [ ] **Assets:** Copy `orion.svg` to `public/favicon.svg`.
- [ ] **Antigravity Customizations:** Initialize `.agents/` and `GEMINI.md`.
