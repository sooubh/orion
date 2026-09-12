# Master Implementation Plan: Complete Rebranding to Orion

**Target Codebase:** `/data/data/com.termux/files/home/vision`  
**Target Identity:** **Orion** (`orion` / `orion-ai`)  
**Objective:** Fully rebrand the platform from AnythingLLM and Sovereign AI to **Orion**, achieving 100% white-label consistency, privacy air-gapping, asset modernization, and zero legacy telemetry leakage without breaking runtime functionality.

---

## Architecture & Rebranding Map

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              REBRANDING TAXONOMY                              │
├───────────────────────┬──────────────────────────┬────────────────────────────┤
│ Dimension             │ Current State            │ Target State (Orion)       │
├───────────────────────┼──────────────────────────┼────────────────────────────┤
│ Brand Name            │ Sovereign AI / AnythingLLM│ Orion                      │
│ Monorepo Package Name │ sovereign-ai             │ orion                      │
│ Browser Tab / Title   │ Sovereign AI / AnythingLLM│ Orion                      │
│ SQLite DB File        │ storage/anythingllm.db   │ storage/orion.db           │
│ Agent File Sandbox    │ storage/anythingllm-fs   │ storage/orion-fs           │
│ MCP Servers Registry  │ anythingllm_mcp_servers  │ orion_mcp_servers.json     │
│ PGVector Table        │ anythingllm_vectors      │ orion_vectors              │
│ Chroma Prefix         │ anythingllm-*            │ orion-*                    │
│ Milvus Prefix         │ anythingllm_*            │ orion_*                    │
│ Model Router Slug     │ anythingllm-router       │ orion-router               │
│ Document Attachment   │ application/anythingllm-*│ application/orion-document │
│ User-Agent String     │ AnythingLLM/${version}   │ Orion/${version}           │
│ LocalStorage Prefix   │ anythingllm_*            │ orion_*                    │
│ Telemetry Survey      │ onboarding.anythingllm   │ DELETED / DISABLED         │
│ Env Var Prefix        │ ANYTHINGLLM_*            │ ORION_* (with fallback)    │
└───────────────────────┴──────────────────────────┴────────────────────────────┘
```

---

## Phase 0: Compatibility & Data Migration Strategy (Pre-requisites)

To ensure zero downtime and prevent data loss for existing instances during the transition:

1. **Database Migration Shim:**
   - Detect if `storage/anythingllm.db` exists while `storage/orion.db` does not.
   - Automatically copy/symlink or migrate `anythingllm.db` -> `orion.db` on initial boot if present.
   - Keep `process.env.DATABASE_URL` capable of overriding the path.
2. **Vector DB Backwards Compatibility:**
   - For PGVector, Chroma, and Milvus: check for legacy `anythingllm_*` collections/tables if `orion_*` returns empty, allowing seamless in-place schema upgrades without re-indexing.
3. **Model Router Provider Fallback:**
   - In `server/models/workspace.js`, normalize any stored workspace with `chatProvider === "anythingllm-router"` to automatically map to `"orion-router"`.
4. **Browser LocalStorage Migration Shim:**
   - Include a one-time client-side migration helper in `frontend/src/utils/storageMigration.js`:
     If `localStorage.getItem("anythingllm_authToken")` exists and `orion_authToken` does not, migrate keys with prefix `anythingllm_` to `orion_` to avoid forcing users to re-login.

---

## Phase 1: Privacy Air-Gap Hardening & Telemetry Removal

**Goal:** Eliminate all external telemetry, beacons, and identity leakage.

### 1.1 Frontend Remote Telemetry
- [ ] [`frontend/src/utils/constants.js`](frontend/src/utils/constants.js):
  - Remove `export const ONBOARDING_SURVEY_URL = "https://onboarding.anythingllm.com";` or set to `null`.
- [ ] [`frontend/src/pages/OnboardingFlow/Steps/Survey/index.jsx`](frontend/src/pages/OnboardingFlow/Steps/Survey/index.jsx):
  - Remove `navigator.sendBeacon(ONBOARDING_SURVEY_URL, data);` and telemetry `sourceId`.
- [ ] [`frontend/src/pages/OnboardingFlow/Steps/LLMPreference/index.jsx`](frontend/src/pages/OnboardingFlow/Steps/LLMPreference/index.jsx):
  - Remove `useanything.com` domain sniffing check.
- [ ] [`frontend/src/pages/GeneralSettings/ChatEmbedWidgets/EmbedConfigs/EmbedRow/CodeSnippetModal/index.jsx`](frontend/src/pages/GeneralSettings/ChatEmbedWidgets/EmbedConfigs/EmbedRow/CodeSnippetModal/index.jsx):
  - Clean `<!-- AnythingLLM (https://anythingllm.com) -->` and replace `anythingllm-chat-widget.min.js` with `orion-chat-widget.min.js`.

### 1.2 Backend Outbound Network Headers & Identification
- [ ] [`server/endpoints/utils.js`](server/endpoints/utils.js):
  - Rename `getAnythingLLMUserAgent()` to `getOrionUserAgent()`.
  - Return `Orion/${version}` instead of `AnythingLLM/${version}`.
- [ ] [`server/utils/AiProviders/genericOpenAi/index.js`](server/utils/AiProviders/genericOpenAi/index.js) & [`server/utils/agents/aibitat/providers/genericOpenAi.js`](server/utils/agents/aibitat/providers/genericOpenAi.js):
  - Update `User-Agent` header to `getOrionUserAgent()`.
- [ ] [`server/utils/agents/aibitat/plugins/web-browsing.js`](server/utils/agents/aibitat/plugins/web-browsing.js):
  - Change `"X-SearchApi-Source": "AnythingLLM"` -> `"Orion"`.
  - Change `"User-Agent": "anything-llm"` -> `"User-Agent": "orion"`.
- [ ] [`server/utils/agents/aibitat/plugins/gmail/lib.js`](server/utils/agents/aibitat/plugins/gmail/lib.js) & [`google-calendar/lib.js`](server/utils/agents/aibitat/plugins/google-calendar/lib.js):
  - Change `"X-AnythingLLM-UA"` -> `"X-Orion-UA": "Orion-Agent/1.0"`.
- [ ] [`server/utils/ImageGenerators/openRouter/index.js`](server/utils/ImageGenerators/openRouter/index.js):
  - Update `"HTTP-Referer"` and `"X-Title": "Orion"`.
- [ ] [`server/utils/database/index.js`](server/utils/database/index.js):
  - Remove Mintplex Labs telemetry log lines (L88, L101).

---

## Phase 2: Visual Identity, Logos & Vector Graphics

**Goal:** Provide a modern, cohesive constellation/celestial theme for Orion.

### 2.1 Logo & Vector Artwork
- [ ] **Orion Constellation Crest:**
  - Create [`frontend/src/media/logo/orion.svg`](frontend/src/media/logo/) and update `favicon.svg`.
  - Design an elegant constellation / Orion belt geometric star-cluster mark.
- [ ] **Onboarding Wordmark SVGs:**
  - Replace [`frontend/src/pages/OnboardingFlow/Steps/Home/wordmark.svg`](frontend/src/pages/OnboardingFlow/Steps/Home/wordmark.svg) with clean SVG vector geometry spelling **"ORION"**.
  - Replace [`frontend/src/pages/OnboardingFlow/Steps/Home/wordmark-light.svg`](frontend/src/pages/OnboardingFlow/Steps/Home/wordmark-light.svg) with light-mode variant.
- [ ] **Onboarding Hero Emblem Component:**
  - Rewrite [`frontend/src/pages/OnboardingFlow/Steps/Home/components/OnboardingLogoSVG.jsx`](frontend/src/pages/OnboardingFlow/Steps/Home/components/OnboardingLogoSVG.jsx) to render Orion's celestial star emblem instead of the legacy interlocking hexagons.
- [ ] **Storage Logo Assets:**
  - Replace [`server/storage/assets/anything-llm.png`](server/storage/assets/anything-llm.png) and `anything-llm-invert.png` with `orion.png` and `orion-invert.png`.
- [ ] **Clean Orphaned Legacy Assets:**
  - Delete `frontend/src/media/illustrations/community-hub.png` and unused sovereign/anything-llm SVGs.

---

## Phase 3: Document Generation Watermarks & Output Sanitization

**Goal:** Ensure all user-exported and agent-generated documents carry Orion branding.

- [ ] **DOCX Generator:**
  - [`server/utils/agents/aibitat/plugins/create-files/docx/create-docx-file.js`](server/utils/agents/aibitat/plugins/create-files/docx/create-docx-file.js#L250-L251):
    - `creator: Orion ${getDeploymentVersion()}`
    - `description: Word Document generated by Orion ${getDeploymentVersion()}`
  - [`server/utils/agents/aibitat/plugins/create-files/docx/utils.js`](server/utils/agents/aibitat/plugins/create-files/docx/utils.js#L1013):
    - Watermark text: `"Generated by Orion"`
- [ ] **PDF Generator & Chat Exports:**
  - [`server/utils/agents/aibitat/plugins/create-files/pdf/utils.js`](server/utils/agents/aibitat/plugins/create-files/pdf/utils.js#L54):
    - `const fallbackText = "Created with Orion";`
  - [`server/utils/chats/exportChatToFile.js`](server/utils/chats/exportChatToFile.js#L193):
    - HTML export footer: `"Exported from Orion"`
- [ ] **PowerPoint (PPTX) Generator:**
  - [`server/utils/agents/aibitat/plugins/create-files/pptx/create-presentation.js`](server/utils/agents/aibitat/plugins/create-files/pptx/create-presentation.js#L254):
    - `pptx.company = "Orion";`
  - [`server/utils/agents/aibitat/plugins/create-files/pptx/utils.js`](server/utils/agents/aibitat/plugins/create-files/pptx/utils.js#L47):
    - Slide text: `"Orion"`
- [ ] **Excel (XLSX) Generator:**
  - [`server/utils/agents/aibitat/plugins/create-files/xlsx/create-excel-file.js`](server/utils/agents/aibitat/plugins/create-files/xlsx/create-excel-file.js#L224):
    - `workbook.creator = "Orion";`
  - [`server/utils/agents/aibitat/plugins/create-files/xlsx/utils.js`](server/utils/agents/aibitat/plugins/create-files/xlsx/utils.js#L205):
    - `brandingCell.value = "Created with Orion";`
- [ ] **Export Filename Conventions:**
  - [`frontend/src/pages/GeneralSettings/Chats/index.jsx`](frontend/src/pages/GeneralSettings/Chats/index.jsx): Return `orion-chats-${date}`.
  - [`frontend/src/components/WorkspaceChat/ChatContainer/ChatSettingsMenu/Export/index.jsx`](frontend/src/components/WorkspaceChat/ChatContainer/ChatSettingsMenu/Export/index.jsx): Default to `Orion Export - ${stamp}.${format.ext}`.

---

## Phase 4: Frontend UI, State & LocalStorage

### 4.1 Browser LocalStorage Keys Refactoring
Update [`frontend/src/utils/constants.js`](frontend/src/utils/constants.js) with migration wrapper:
```javascript
export const AUTH_USER = "orion_user";
export const AUTH_TOKEN = "orion_authToken";
export const AUTH_TIMESTAMP = "orion_authTimestamp";
export const COMPLETE_QUESTIONNAIRE = "orion_completed_questionnaire";
export const SEEN_DOC_PIN_ALERT = "orion_pinned_document_alert";
export const LAST_VISITED_WORKSPACE = "orion_last_visited_workspace";
export const USER_PROMPT_INPUT_MAP = "orion_user_prompt_input_map";
export const PENDING_HOME_MESSAGE = "orion_pending_home_message";
export const APPEARANCE_SETTINGS = "orion_appearance_settings";
```
And across components:
- `SIDEBAR_TOGGLE_STORAGE_KEY`: `"orion_sidebar_toggle"`
- `SHOW_METRICS_KEY`: `"orion_show_chat_metrics"`
- `SEEN_COPY_LINK_CHAT_ALERT`: `"orion_seen_copy_link_chat_alert"`
- `TEXT_SIZE_KEY`: `"orion_text_size"`
- `workspaceOrderStorageKey`: `"orion-workspace-order"`

### 4.2 Fallbacks & Dialog Messages
- [ ] [`frontend/public/service-workers/push-notifications.js`](frontend/public/service-workers/push-notifications.js#L15):
  - Fallback notification title: `'Orion'`.
- [ ] [`frontend/src/components/Modals/Password/MultiUserAuth.jsx`](frontend/src/components/Modals/Password/MultiUserAuth.jsx) & [`SingleUserAuth.jsx`](frontend/src/components/Modals/Password/SingleUserAuth.jsx):
  - Change default app fallback to `"Orion"`.
- [ ] [`frontend/src/pages/GeneralSettings/Settings/components/CustomSiteSettings/index.jsx`](frontend/src/pages/GeneralSettings/Settings/components/CustomSiteSettings/index.jsx):
  - Default title placeholder: `Orion | Private Intelligence Platform`.
- [ ] [`frontend/src/pages/GeneralSettings/Settings/components/CustomAppName/index.jsx`](frontend/src/pages/GeneralSettings/Settings/components/CustomAppName/index.jsx):
  - Placeholder: `Orion`.
- [ ] [`frontend/src/pages/Admin/Users/UserRow/index.jsx`](frontend/src/pages/Admin/Users/UserRow/index.jsx):
  - Confirmation dialogs: `...unable to use this instance of Orion.`
- [ ] [`frontend/src/pages/Admin/Workspaces/WorkspaceRow/index.jsx`](frontend/src/pages/Admin/Workspaces/WorkspaceRow/index.jsx):
  - Confirmation dialog: `...unavailable in this instance of Orion.`
- [ ] [`frontend/src/pages/Security/index.jsx`](frontend/src/pages/Security/index.jsx#L166):
  - Update label: `Stored in SQLite (orion.db)`.
- [ ] [`frontend/src/components/TextToSpeech/PiperTTSOptions/index.jsx`](frontend/src/components/TextToSpeech/PiperTTSOptions/index.jsx#L152):
  - Audible voice test string: `"Hello, welcome to Orion!"`.

---

## Phase 5: Localization & Internationalization Refactoring

**Goal:** Clean all language bundles so no locale displays "AnythingLLM" or "Sovereign".

- [ ] **English (`frontend/src/locales/en/common.js`):**
  - Update all 22 identified keys:
    - `"mobile-app": "Orion Mobile"`
    - `"the benefits of Orion"`
    - `"Orion automatically selects the right skills..."`
    - `"Set your UI preferences for Orion."`
    - `"Protect your Orion instance with a password."`
    - `"Connect your Orion instance to Telegram..."`
    - `"When you pin a document in Orion..."`
- [ ] **Automated Scrub Across 27 Non-English Locales (`frontend/src/locales/*/common.js`):**
  - Execute a comprehensive string replacement script across all 27 directories (`ar`, `ca`, `cs`, `da`, `de`, `es`, `et`, `fa`, `fr`, `he`, `hr`, `id`, `it`, `ja`, `ko`, `lo`, `lt`, `lv`, `nl`, `pl`, `pt_BR`, `ro`, `ru`, `tr`, `vn`, `zh`, `zh_TW`):
    - Replace `"AnythingLLM"` with `"Orion"`.
    - Replace `"Sovereign AI"` with `"Orion"`.
    - Replace `"Sovereign"` with `"Orion"`.

---

## Phase 6: Core Engine, Model Router & Attachment Protocols

### 6.1 Model Router Migration (`anythingllm-router` -> `orion-router`)
- [ ] **Backend Class & Slug:**
  - Rename class [`AnythingLLMModelRouter`](server/utils/AiProviders/modelRouter/index.js) to `OrionModelRouter`.
  - Update provider slug in `server/models/workspace.js`, `server/utils/helpers/index.js`, `server/utils/agents/ephemeral.js`, `server/utils/agents/index.js`, and `server/utils/helpers/updateENV.js`:
    - Accept `"orion-router"` as canonical.
    - Support `"anythingllm-router"` as backwards-compatible alias that auto-migrates.
- [ ] **Frontend Model Pickers:**
  - [`frontend/src/pages/GeneralSettings/LLMPreference/index.jsx`](frontend/src/pages/GeneralSettings/LLMPreference/index.jsx#L42): `value: "orion-router"`.
  - Update `LLMSelector`, `WorkspaceModelPicker`, `ModelRouters`, and `WorkspaceLLMSelection`.

### 6.2 Document Attachment MIME Protocol
- [ ] Update attachment MIME definition across:
  - [`server/utils/chats/apiChatHandler.js`](server/utils/chats/apiChatHandler.js)
  - [`server/endpoints/api/workspace/index.js`](server/endpoints/api/workspace/index.js)
  - [`server/endpoints/api/workspaceThread/index.js`](server/endpoints/api/workspaceThread/index.js)
  - Standardize on `application/orion-document` while accepting `application/anythingllm-document` for legacy API payloads.

### 6.3 MCP Hypervisor Configuration Schema
- [ ] [`server/utils/MCP/hypervisor/index.js`](server/utils/MCP/hypervisor/index.js):
  - Storage path: `storage/plugins/orion_mcp_servers.json` (fallback check for `anythingllm_mcp_servers.json`).
  - Config properties: `server.orion.suppressedTools` and `server.orion.autoStart` (with fallback to `server.anythingllm.*`).
- [ ] Update frontend MCP management panels in `frontend/src/pages/Admin/Agents/MCPServers/`.

---

## Phase 7: Database & Vector Storage Layer

### 7.1 Prisma & SQLite Database
- [ ] [`server/prisma/schema.prisma`](server/prisma/schema.prisma#L15):
  - Change default connection URL: `url = "file:../storage/orion.db"`.
- [ ] Database Boot Hook ([`server/utils/database/index.js`](server/utils/database/index.js)):
  - Add boot check: if `storage/anythingllm.db` exists and `storage/orion.db` does not, automatically copy/rename `anythingllm.db` -> `orion.db`.

### 7.2 Agent Sandboxed Filesystem
- [ ] [`server/utils/agents/aibitat/plugins/filesystem/lib.js`](server/utils/agents/aibitat/plugins/filesystem/lib.js#L56):
  - Update sandboxed folder path to `storage/orion-fs` (auto-migrating existing files from `storage/anythingllm-fs` if present).

### 7.3 Vector Database Providers
- [ ] **PGVector** ([`server/utils/vectorDbProviders/pgvector/index.js`](server/utils/vectorDbProviders/pgvector/index.js#L49)):
  - Default table: `process.env.PGVECTOR_TABLE_NAME || "orion_vectors"`.
- [ ] **Chroma** ([`server/utils/vectorDbProviders/chroma/index.js`](server/utils/vectorDbProviders/chroma/index.js#L40-L53)):
  - Prefix collections with `orion-`.
- [ ] **Milvus** ([`server/utils/vectorDbProviders/milvus/index.js`](server/utils/vectorDbProviders/milvus/index.js#L31-L64)):
  - Prefix collections with `orion_`.
- [ ] **Weaviate** ([`server/utils/vectorDbProviders/weaviate/index.js`](server/utils/vectorDbProviders/weaviate/index.js#L226)):
  - Description: `Class created by Orion named ${camelCase(workspace.slug)}`.

---

## Phase 8: Environment Variables, Package Manifests & Scripts

### 8.1 Environment Variables
Support new `ORION_*` variables with backward compatibility fallbacks:
- `ORION_RUNTIME` (fallback: `ANYTHING_LLM_RUNTIME`)
- `ORION_CHROMIUM_ARGS` (fallback: `ANYTHINGLLM_CHROMIUM_ARGS`)
- `ORION_FETCH_TIMEOUT` (fallback: `ANYTHINGLLM_FETCH_TIMEOUT`)
- `ORION_MAX_RETRIES` (fallback: `ANYTHINGLLM_MAX_RETRIES`)
- Update `server/.env.example` and `server/utils/helpers/updateENV.js`.

### 8.2 Package Manifests
- [ ] Root [`package.json`](package.json):
  - `"name": "orion"`, `"description": "Private AI for confidential work."`
- [ ] [`frontend/package.json`](frontend/package.json):
  - `"name": "orion-frontend"`
- [ ] [`server/package.json`](server/package.json):
  - `"name": "orion-server"`

---

## Phase 9: Documentation, Root Files & Repository Cleanup

- [ ] [`README.md`](README.md):
  - Rewrite project title: `# Orion — Private Intelligence Platform`.
  - Maintain respectful open-source foundation credit: `Built on the AnythingLLM foundation by Mintplex Labs, transformed into Orion.`
  - Update all architecture diagrams, endpoint tables, and folder descriptions.
- [ ] [`.gitignore`](.gitignore) & [`server/.gitignore`](server/.gitignore):
  - Add ignore rules for `orion.db`, `orion-fs`, `orion_mcp_servers.json`, `storage/assets/orion.png`.
  - Retain legacy ignore rules for safety.
- [ ] [`.vscode/settings.json`](.vscode/settings.json):
  - Add `orion`, `orionai` to cSpell dictionary.

---

## Phase 10: Verification & Build Validation Matrix

| Test Scope | Target Criteria | Validation Method |
| :--- | :--- | :--- |
| **Grep Residuals Check** | 0 unapproved instances of "anythingllm" or "sovereign" in user-facing code | Automated grep check across `frontend/src/` and `server/` |
| **Telemetry Egress Test** | Zero requests to `onboarding.anythingllm.com` or external beacons | Inspect network requests during onboarding step |
| **Frontend Build** | Vite production build passes with 0 errors or broken asset imports | Run `npm run build:frontend` |
| **Database Generation** | Prisma generates client and runs migrations targeting `orion.db` | Run `npx prisma generate` |
| **Server Startup** | Express server boots on port 3001, binds `orion.db` cleanly | Run `node index.js` |
| **Agent File Generation** | Exported DOCX/PDF/PPTX/XLSX carry Orion creator and watermarks | Trigger agent file creation in test workspace |
| **Vector DB Query** | PGVector/Chroma/Milvus connects using `orion_*` prefix | Run vector similarity test |
| **Model Router Chat** | `orion-router` functions properly across configured models | Run chat query using router |
