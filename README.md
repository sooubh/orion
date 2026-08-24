# Sovereign AI

> **Private AI for confidential work.**

Sovereign AI is a self-contained, enterprise-grade local AI product designed for high-confidentiality environments. It guarantees zero data egress, 100% on-premise execution, traceable evidence grounding, and multi-specialist AI review with disagreement detection.

---

## Key Pillars

1. **100% Local & Air-Gapped Ready**:
   - Outbound telemetry permanently disabled (`External connections: 0`).
   - Local LLM inference (Ollama, LMStudio, LocalAI, Native) and embedded vector stores (LanceDB, SQLite).
2. **Evidence-First Answers**:
   - Every key conclusion is grounded with exact document excerpts, semantic similarity scores, and section identifiers.
3. **Specialist AI Review & Conflict Resolution**:
   - Multi-agent review workflow across Technical, Policy/SOP, and Risk domains.
   - Dedicated **AI Review Conflict** highlighting when specialists disagree.
4. **Deliverables & Artifact Hub**:
   - Automated generation and export of DOCX, XLSX, PPTX, PDF, and Code deliverables.
5. **Security Center**:
   - Real-time hardware telemetry, process memory audit, and cryptographic event logs.

---

## Main Sections

- **Dashboard**: Executive health monitor, local model readiness, and quick operation launchers.
- **Workspace**: Focused multi-turn AI workspace with document grounding and tool execution.
- **Documents**: Local multi-format ingestion engine (PDF, DOCX, XLSX, PPTX, CSV, TXT, Markdown).
- **Knowledge**: Vector retrieval inspector and interactive semantic search tester.
- **AI Review**: Specialist review workflow with automated AI disagreement resolution.
- **Deliverables**: Generated artifact registry and download portal.
- **Security Center**: Isolation verification, system vitals, and immutable audit logs.

---

## Getting Started

### Prerequisites
- Node.js >= 18
- Yarn or npm

### Quick Setup

```bash
# Install dependencies
yarn setup

# Start local server, collector, and frontend
yarn dev
```

- **Frontend**: `http://localhost:3000` (or `http://localhost:5173`)
- **Backend API**: `http://localhost:3001`
- **Collector Engine**: `http://localhost:8888`

---

## License

This software is distributed under the MIT License. See [LICENSE](LICENSE) for details.
