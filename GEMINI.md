# Orion Project Guidelines (Antigravity Rules)

## Project Overview
Orion is a sovereign, on-premise AI intelligence platform consisting of:
- `server/`: Node.js Express API, Prisma ORM, Vector DB adapters, Model Router, and streaming SSE pipeline.
- `frontend/`: React + Vite + Tailwind CSS SPA with theme switching and document management.
- `collector/`: Document parsing service converting PDF, DOCX, XLSX, audio, and web links to structured JSON chunks.

## Architectural & Coding Standards
1. **Zero Cloud Leaks:** All models and vector stores default to local/on-premise providers (Ollama, LanceDB). Do not introduce unvetted external telemetry or unauthenticated endpoints.
2. **Deterministic Retrieval:** When computing cosine vector similarity, never allow $distance \ge 1.0$ to return similarity $1.0$. Bound similarity strictly between $0.0$ and $1.0$.
3. **Workspace Isolation:** Document operations (unembedding, deletion, search) must be strictly scoped to the active workspace. Never perform global database purges from workspace-scoped endpoints.
4. **Theme Integrity:** Never use destructive global CSS overrides (`!important` on `.text-white` or amber warning buttons). Always pair text and background colors with explicit light and dark variants or use semantic theme variables (`text-theme-text-primary`).
5. **Native Node.js APIs:** Prefer built-in Node.js modules (`crypto.randomUUID()`, `Intl.DateTimeFormat`) over unneeded external micro-dependencies (`uuid`, `moment`).
6. **Strict Authentication:** Never disable request authentication based on `NODE_ENV === "development"`. Maintain strict role checks across all production and development routes.
