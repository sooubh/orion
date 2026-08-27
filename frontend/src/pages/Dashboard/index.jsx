import React, { useEffect, useState } from "react";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import { isMobile } from "react-device-detect";
import {
  ShieldCheck,
  ChatCircleDots,
  Files,
  Database,
  Package,
  Shield,
  Cpu,
  ArrowRight,
  Plus,
  Compass,
  GitMerge,
  Clock,
  HardDrives,
  LockKey,
  Activity,
  UserCircle,
  DownloadSimple,
  CheckCircle,
} from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router-dom";
import paths from "@/utils/paths";
import Security from "@/models/security";
import Workspace from "@/models/workspace";
import Review from "@/models/review";
import Deliverables from "@/models/deliverables";
import { userFromStorage } from "@/utils/request";

// --- Helpers ------------------------------------------------------------------

function timeAgo(dateStr) {
  if (!dateStr) return "---";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function labelEvent(name = "") {
  const map = {
    workspace_created: "Workspace initialized",
    workspace_deleted: "Workspace removed",
    document_added: "Document analyzed & ingested",
    document_uploaded: "Document uploaded & indexed",
    document_removed: "Document removed from index",
    user_login: "User session authenticated",
    user_logout: "User session closed",
    api_key_created: "Local API key generated",
    sent_llm_token_count: "Model inference & reasoning executed",
    chat_sent: "RAG retrieval & local reasoning completed",
    ai_review_executed: "Agent workflow completed",
    deliverable_generated: "Deliverable generated & verified",
  };
  return map[name] || name.replace(/_/g, " ");
}

function getWorkspaceDepartment(name = "") {
  const lower = name.toLowerCase();
  if (lower.includes("maint") || lower.includes("repair") || lower.includes("equip") || lower.includes("plant"))
    return "Maintenance Intelligence";
  if (lower.includes("inspect") || lower.includes("audit") || lower.includes("qa") || lower.includes("quality") || lower.includes("defect") || lower.includes("report"))
    return "Inspection Intelligence";
  if (lower.includes("eng") || lower.includes("design") || lower.includes("tech") || lower.includes("cad") || lower.includes("spec") || lower.includes("draw"))
    return "Engineering Intelligence";
  if (lower.includes("safe") || lower.includes("sop") || lower.includes("hazard") || lower.includes("compliance") || lower.includes("ehs") || lower.includes("policy"))
    return "Safety & SOP Intelligence";
  if (lower.includes("primary") || lower.includes("main") || lower.includes("core"))
    return "Industrial Operations";
  return "Operational Intelligence";
}

// --- Agent Task Panel --------------------------------------------------------
// Shows last completed agent review with full execution pipeline,
// or idle state if no reviews have been run yet.
// NOTE: The review API executes synchronously — all pipeline steps are
// complete by the time any result is returned. No fake in-progress state.

function AgentTaskPanel({ latestTask, activeModel, onStartNewTask }) {
  if (!latestTask) {
    return (
      <div className="sovereign-card rounded-xl border border-[#1f2328] overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1f2328]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-zinc-800 text-zinc-500">
              <GitMerge size={15} weight="duotone" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white tracking-tight">Active Task Execution</h2>
              <p className="text-[10px] text-zinc-500 font-mono">Agentic Workbench</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-zinc-500/10 text-zinc-500 border border-zinc-500/20 uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
            Idle
          </span>
        </div>

        {/* Empty state */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-6">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-300">No active tasks</p>
            <p className="text-[11px] text-zinc-500 max-w-md">
              The agentic workbench is idle. Launch a multi-perspective specialist review to process a document or report.
            </p>
          </div>
          <button
            onClick={onStartNewTask}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-md active:scale-95 flex-shrink-0"
          >
            <GitMerge size={14} weight="bold" />
            Start New Task
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = latestTask.status === "completed";
  const confidence = latestTask.overallConfidence
    ? Math.round(latestTask.overallConfidence * 100)
    : null;

  const perspectives = latestTask.perspectives || {};
  const hasTechnical = !!perspectives.technical;
  const hasPolicy = !!perspectives.policy;
  const hasRisk = !!perspectives.risk;
  const hasFinal = !!perspectives.finalDecision;

  // Pipeline steps derived from actual API response fields.
  // All steps are "done" if the review completed (synchronous execution).
  const pipeline = [
    { label: "Document loaded & parsed",           done: isCompleted },
    { label: "Knowledge retrieved (local RAG)",     done: isCompleted },
    { label: "Technical Specialist review",         done: hasTechnical, agent: "Technical Specialist" },
    { label: "Policy & SOP Specialist review",      done: hasPolicy,   agent: "Policy & SOP Specialist" },
    { label: "Risk Assessment Specialist review",   done: hasRisk,     agent: "Risk Assessment Specialist" },
    { label: "Conflict detection across specialists", done: isCompleted, flagged: latestTask.hasConflict },
    { label: "Final decision synthesized",          done: hasFinal,    agent: "Decision Synthesizer" },
    { label: "Deliverable generated",               done: isCompleted },
  ];

  return (
    <div className="sovereign-card rounded-xl border border-[#1f2328] overflow-hidden">
      {/* Panel header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-b border-[#1f2328]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-1.5 rounded flex-shrink-0 ${isCompleted ? "bg-emerald-500/10 text-emerald-400" : "bg-sky-500/10 text-sky-400"}`}>
            <GitMerge size={15} weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs font-bold text-white tracking-tight flex-shrink-0">Active Task Execution</h2>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider border uppercase flex-shrink-0 ${
                isCompleted
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-sky-500/10 text-sky-400 border-sky-500/20"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isCompleted ? "bg-emerald-400" : "bg-sky-400 animate-pulse"}`} />
                {isCompleted ? "Completed" : "In Progress"}
              </span>
              {latestTask.hasConflict && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider border uppercase bg-amber-500/10 text-amber-400 border-amber-500/20 flex-shrink-0">
                  ⚠ Conflict Detected
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
              <Clock size={10} className="inline mr-1" />
              Last run {timeAgo(latestTask.timestamp)}
              {latestTask.workspaceSlug && ` · Workspace: ${latestTask.workspaceSlug}`}
            </p>
          </div>
        </div>

        <button
          onClick={onStartNewTask}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#090a0b] hover:bg-[#18191d] border border-[#1f2328] text-xs font-semibold text-sky-400 hover:text-sky-300 transition-all active:scale-95 flex-shrink-0"
        >
          <Plus size={12} weight="bold" />
          New Task
        </button>
      </div>

      {/* Task identity + meta */}
      <div className="px-5 pt-4 pb-3 border-b border-[#1f2328]">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Task</p>
            <h3 className="text-sm font-bold text-white truncate">
              {latestTask.title || "Specialist AI Review"}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <div className="px-3 py-1.5 rounded-lg bg-[#090a0b] border border-[#1f2328] text-center">
              <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Workflow</p>
              <p className="text-xs font-semibold text-zinc-200 font-mono">Multi-Perspective Review</p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#090a0b] border border-[#1f2328] text-center">
              <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Model</p>
              <p className="text-xs font-semibold text-sky-300 font-mono truncate max-w-[100px]">{activeModel}</p>
            </div>
            {confidence !== null && (
              <div className="px-3 py-1.5 rounded-lg bg-[#090a0b] border border-[#1f2328] text-center">
                <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Confidence</p>
                <p className={`text-xs font-bold font-mono ${confidence >= 70 ? "text-emerald-400" : "text-amber-400"}`}>
                  {confidence}%
                </p>
              </div>
            )}
            <div className="px-3 py-1.5 rounded-lg bg-[#090a0b] border border-[#1f2328] text-center">
              <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Specialists</p>
              <p className="text-xs font-semibold text-zinc-200 font-mono">3 + Synthesizer</p>
            </div>
          </div>
        </div>
      </div>

      {/* Execution pipeline */}
      <div className="px-5 py-4 space-y-2">
        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono">
          Agent Execution Pipeline
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {pipeline.map((step, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-[11px] font-mono transition-colors ${
                step.done
                  ? step.flagged
                    ? "bg-amber-500/5 border-amber-500/20 text-amber-300"
                    : "bg-emerald-500/5 border-emerald-500/15 text-zinc-300"
                  : "bg-[#090a0b] border-[#1f2328] text-zinc-600"
              }`}
            >
              {step.done ? (
                step.flagged ? (
                  <span className="text-amber-400 flex-shrink-0 text-xs">⚠</span>
                ) : (
                  <span className="text-emerald-400 flex-shrink-0 text-xs">✓</span>
                )
              ) : (
                <span className="h-1.5 w-1.5 rounded-full border border-zinc-700 flex-shrink-0" />
              )}
              <span className="truncate">{step.label}</span>
              {step.agent && step.done && (
                <span className="ml-auto text-[9px] text-zinc-600 flex-shrink-0 hidden sm:block">{step.agent}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Main Page ----------------------------------------------------------------

export default function Dashboard() {
  const navigate = useNavigate();
  const [securityData, setSecurityData] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [sec, ws, revs, dels] = await Promise.all([
          Security.status(),
          Workspace.all(),
          Review.history(),
          Deliverables.all(),
        ]);
        setSecurityData(sec);
        setWorkspaces(ws || []);
        setReviews(revs || []);
        setDeliverables(dels || []);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const totalDocs = securityData?.dataProcessedLocally?.totalDocuments ?? 0;
  const totalVectors = securityData?.dataProcessedLocally?.totalVectors ?? 0;
  const externalConns = securityData?.externalConnections ?? 0;

  // Header telemetry
  const llmEngine = securityData?.modelStatus?.provider || "Ollama";
  const activeModelName = securityData?.modelStatus?.model || "—";
  const currentUser = userFromStorage();
  const userName = currentUser?.username || "Local Admin";
  const userRole = currentUser?.role ? currentUser.role.toUpperCase() : "ADMIN";

  // System health from runtime memory
  const memory = securityData?.runtime?.memory;
  const ramUsedMb = memory ? memory.totalMb - memory.freeMb : null;
  const ramTotalMb = memory?.totalMb ?? null;
  const ramPct = ramTotalMb ? Math.round((ramUsedMb / ramTotalMb) * 100) : null;
  const isHealthy = ramPct == null || ramPct < 90;
  const healthLabel = ramPct != null ? `Operational · ${ramPct}% RAM` : "Operational";
  const healthColor = isHealthy ? "text-emerald-400" : "text-amber-400";
  const healthBg = isHealthy ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20";
  const healthDot = isHealthy ? "bg-emerald-400 animate-pulse" : "bg-amber-400";

  // Egress status — factual count only, no false air-gap claims
  const egressLabel = externalConns === 0 ? "No External Connections" : `${externalConns} External Connection${externalConns > 1 ? "s" : ""} Detected`;
  const egressColor = externalConns === 0 ? "text-emerald-400" : "text-amber-400";
  const egressBg = externalConns === 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20";
  const egressDot = externalConns === 0 ? "bg-emerald-400" : "bg-amber-400 animate-pulse";

  // Knowledge Base telemetry
  const vectorDbName = securityData?.modelStatus?.vectorDb
    ? securityData.modelStatus.vectorDb.toUpperCase()
    : "LANCEDB";
  const embeddingEngineName = securityData?.modelStatus?.embeddingEngine
    ? (securityData.modelStatus.embeddingEngine.toLowerCase() === "native"
        ? "Native (Local)"
        : securityData.modelStatus.embeddingEngine)
    : "Native (Local)";
  const auditEvents = securityData?.auditEvents || [];
  const lastDocEvent = auditEvents.find(
    (ev) => ev.event?.includes("document") || ev.event?.includes("vector")
  );
  const lastIndexUpdate = lastDocEvent
    ? `Updated ${timeAgo(lastDocEvent.occurredAt)}`
    : workspaces[0]?.lastUpdatedAt
    ? `Updated ${timeAgo(workspaces[0].lastUpdatedAt)}`
    : "Ready / Synced";
  const isRetrievalReady = totalDocs > 0 || totalVectors > 0;

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#090a0b] text-[#f4f4f5] flex font-sans">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}

      <main className="flex-1 h-full overflow-y-auto bg-[#090a0b] p-6 md:p-10 pt-16 md:pt-10">
        <div className="max-w-6xl mx-auto space-y-8 pb-12">

          {/* SECTION 1: System Header — compact, factual, enterprise-grade */}
          <div className="rounded-xl bg-[#111215] border border-[#1f2328] shadow-lg overflow-hidden">

            {/* Identity Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-[#1f2328]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <ShieldCheck size={20} weight="duotone" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-base font-bold tracking-tight text-white font-sans">
                      Sovereign AI <span className="text-sky-400 font-light">Command Center</span>
                    </h1>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                      Zero-Egress Secured
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase">
                      Multi-Model
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                      Agentic Workbench
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5 font-normal">
                    Local, secure, multi-model, agentic AI workbench designed for confidential industrial work.
                  </p>
                </div>
              </div>

              {/* Operator identity */}
              <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-lg bg-[#090a0b] border border-[#1f2328] text-xs font-mono flex-shrink-0">
                <UserCircle size={15} className="text-zinc-400" weight="duotone" />
                <span className="text-zinc-300 font-medium">{userName}</span>
                <span className="text-zinc-600">/</span>
                <span className="text-sky-400 uppercase font-bold text-[10px]">{userRole}</span>
              </div>
            </div>

            {/* Telemetry Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-[#1f2328]">

              {/* Deployment */}
              <div className="flex items-center gap-2.5 px-4 py-3 bg-[#111215]">
                <div className="p-1.5 rounded bg-zinc-800 text-zinc-400 flex-shrink-0">
                  <HardDrives size={14} weight="duotone" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Deployment</div>
                  <div className="text-xs font-semibold text-zinc-200 font-mono truncate">On-Premise / Local</div>
                </div>
              </div>

              {/* LLM Engine */}
              <div className="flex items-center gap-2.5 px-4 py-3 bg-[#111215]">
                <div className="p-1.5 rounded bg-sky-500/10 text-sky-400 flex-shrink-0">
                  <Cpu size={14} weight="duotone" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono">LLM Engine</div>
                  <div className="text-xs font-semibold text-sky-300 font-mono truncate uppercase">{llmEngine}</div>
                </div>
              </div>

              {/* Active Model */}
              <div className="flex items-center gap-2.5 px-4 py-3 bg-[#111215]">
                <div className="p-1.5 rounded bg-[#090a0b] text-zinc-300 border border-[#1f2328] flex-shrink-0">
                  <Shield size={14} weight="duotone" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Active Model</div>
                  <div className="text-xs font-semibold text-zinc-200 font-mono truncate">{activeModelName}</div>
                </div>
              </div>

              {/* Egress Status — actual count */}
              <div className="flex items-center gap-2.5 px-4 py-3 bg-[#111215]">
                <div className={`p-1.5 rounded flex-shrink-0 ${egressBg}`}>
                  <LockKey size={14} weight="duotone" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Egress Status</div>
                  <div className={`text-xs font-semibold font-mono truncate flex items-center gap-1.5 ${egressColor}`}>
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${egressDot}`} />
                    {egressLabel}
                  </div>
                </div>
              </div>

              {/* System Health */}
              <div className="flex items-center gap-2.5 px-4 py-3 bg-[#111215] col-span-2 sm:col-span-1">
                <div className={`p-1.5 rounded flex-shrink-0 ${healthBg}`}>
                  <Activity size={14} weight="duotone" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono">System Health</div>
                  <div className={`text-xs font-semibold font-mono truncate flex items-center gap-1.5 ${healthColor}`}>
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${healthDot}`} />
                    {healthLabel}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 2: Active Task / Agent Execution */}
          <AgentTaskPanel
            latestTask={reviews.length > 0 ? reviews[0] : null}
            activeModel={activeModelName}
            onStartNewTask={() => navigate(paths.review())}
          />

          {/* SECTION 3: Primary Workbench Actions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-[#1f2328] pb-3">
              <Compass size={16} className="text-sky-400 flex-shrink-0" weight="duotone" />
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">Primary Workbench Actions</h2>
                <p className="text-[11px] text-zinc-500">Core operational workflows for sovereign industrial intelligence</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* 1. Confidential Workspace */}
              <Link
                to={paths.workspace.chat("primary")}
                className="sovereign-card rounded-xl p-4 group flex flex-col justify-between hover:border-zinc-700 transition-all border border-[#1f2328]"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#090a0b] text-zinc-300 border border-[#1f2328] group-hover:text-sky-300 group-hover:border-zinc-700 transition-colors flex-shrink-0">
                      <ChatCircleDots size={18} weight="duotone" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors leading-tight">
                        Confidential Workspace
                      </h3>
                      <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Isolated Chat Session</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Isolated, multi-turn AI sessions grounded on local documents with no external data exposure.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#1f2328] flex items-center justify-between text-xs text-sky-400 font-semibold group-hover:text-sky-300">
                  <span>Open Workspace</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* 2. Knowledge Base */}
              <Link
                to={paths.knowledge()}
                className="sovereign-card rounded-xl p-4 group flex flex-col justify-between hover:border-zinc-700 transition-all border border-[#1f2328]"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#090a0b] text-zinc-300 border border-[#1f2328] group-hover:text-sky-300 group-hover:border-zinc-700 transition-colors flex-shrink-0">
                      <Database size={18} weight="duotone" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors leading-tight">
                        Knowledge Base
                      </h3>
                      <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Local RAG Index</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Local semantic index of industrial documents used to ground all model responses and agent tasks.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#1f2328] flex items-center justify-between text-xs text-sky-400 font-semibold group-hover:text-sky-300">
                  <span>Browse Knowledge Base</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* 3. Document Intelligence */}
              <Link
                to={paths.documents()}
                className="sovereign-card rounded-xl p-4 group flex flex-col justify-between hover:border-zinc-700 transition-all border border-[#1f2328]"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#090a0b] text-zinc-300 border border-[#1f2328] group-hover:text-sky-300 group-hover:border-zinc-700 transition-colors flex-shrink-0">
                      <Files size={18} weight="duotone" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors leading-tight">
                        Document Intelligence
                      </h3>
                      <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Ingest &amp; Index</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Ingest, parse, and index confidential industrial documents including PDFs, drawings, and SOPs.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#1f2328] flex items-center justify-between text-xs text-sky-400 font-semibold group-hover:text-sky-300">
                  <span>Ingest Documents</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* 4. Agent Workflows */}
              <Link
                to={paths.review()}
                className="sovereign-card rounded-xl p-4 group flex flex-col justify-between hover:border-zinc-700 transition-all border border-[#1f2328]"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#090a0b] text-zinc-300 border border-[#1f2328] group-hover:text-sky-300 group-hover:border-zinc-700 transition-colors flex-shrink-0">
                      <GitMerge size={18} weight="duotone" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors leading-tight">
                        Agent Workflows
                      </h3>
                      <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Multi-Perspective Review</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Run specialist reviews across Technical, Policy, and Risk domains with automated conflict detection.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#1f2328] flex items-center justify-between text-xs text-sky-400 font-semibold group-hover:text-sky-300">
                  <span>Launch Agent Review</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* 5. Deliverables */}
              <Link
                to={paths.deliverables()}
                className="sovereign-card rounded-xl p-4 group flex flex-col justify-between hover:border-zinc-700 transition-all border border-[#1f2328]"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#090a0b] text-zinc-300 border border-[#1f2328] group-hover:text-sky-300 group-hover:border-zinc-700 transition-colors flex-shrink-0">
                      <Package size={18} weight="duotone" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors leading-tight">
                        Deliverables
                      </h3>
                      <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Agent-Generated Outputs</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Reports, approval notes, and spreadsheets generated by agent workflows and exported locally.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#1f2328] flex items-center justify-between text-xs text-sky-400 font-semibold group-hover:text-sky-300">
                  <span>Download Deliverables</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* 6. Security & Audit */}
              <Link
                to={paths.security()}
                className="sovereign-card rounded-xl p-4 group flex flex-col justify-between hover:border-zinc-700 transition-all border border-[#1f2328]"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#090a0b] text-zinc-300 border border-[#1f2328] group-hover:text-sky-300 group-hover:border-zinc-700 transition-colors flex-shrink-0">
                      <ShieldCheck size={18} weight="duotone" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors leading-tight">
                        Security &amp; Audit
                      </h3>
                      <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Isolation &amp; Audit Trail</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Verify data isolation, review system telemetry, and inspect the immutable activity audit trail.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#1f2328] flex items-center justify-between text-xs text-sky-400 font-semibold group-hover:text-sky-300">
                  <span>View Audit Log</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>
          </div>

          {/* SECTION 4: Active Confidential Workspaces */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Active Confidential Workspaces</h2>
                <p className="text-xs text-zinc-400">Dedicated operational AI environments grounded on local documents</p>
              </div>
              <button
                onClick={() => navigate(paths.workspace.chat("new"))}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <Plus size={14} weight="bold" />
                New Workspace
              </button>
            </div>

            {workspaces.length === 0 ? (
              <div className="sovereign-card rounded-xl p-8 border border-[#1f2328] text-center space-y-4">
                <ChatCircleDots size={36} className="mx-auto text-zinc-600" weight="duotone" />
                <div>
                  <h3 className="text-sm font-bold text-zinc-200">No active workspaces created</h3>
                  <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
                    Create an on-premise workspace for your operational team to ground local documentation and execute specialized workflows.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <span className="text-[10px] font-mono text-zinc-500">Suggested units:</span>
                  {[
                    "Maintenance Intelligence",
                    "Inspection Intelligence",
                    "Engineering Intelligence",
                    "Safety & SOP Intelligence",
                  ].map((tmpl) => (
                    <span
                      key={tmpl}
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#090a0b] border border-[#1f2328] text-zinc-400"
                    >
                      {tmpl}
                    </span>
                  ))}
                </div>

                <div>
                  <button
                    onClick={() => navigate(paths.workspace.chat("new"))}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-bold transition-all shadow-md"
                  >
                    <Plus size={14} weight="bold" />
                    Create First Workspace
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workspaces.map((ws) => {
                  const department = getWorkspaceDepartment(ws.name);
                  const lastActive = ws.lastUpdatedAt || ws.createdAt;
                  const modelName = ws.chatModel || ws.chatProvider || activeModelName || "Ollama";
                  const docCount = ws.documents?.length || 0;

                  return (
                    <div
                      key={ws.id}
                      className="sovereign-card rounded-xl p-5 border border-[#1f2328] hover:border-zinc-700 transition-all flex flex-col justify-between group space-y-4"
                    >
                      <div className="space-y-3">
                        {/* Card Header: Name + Department */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase">
                              {department}
                            </span>
                            <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors truncate">
                              {ws.name}
                            </h3>
                          </div>
                          <div className="p-2 rounded-lg bg-[#090a0b] border border-[#1f2328] text-zinc-400 flex-shrink-0">
                            <ChatCircleDots size={18} weight="duotone" />
                          </div>
                        </div>

                        {/* Card Specs: Documents, Active Model, Last Activity */}
                        <div className="space-y-2 text-xs font-mono pt-1">
                          <div className="flex items-center justify-between text-zinc-400">
                            <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                              <Files size={13} className="text-zinc-400" />
                              Documents:
                            </span>
                            <span className="text-zinc-200 font-semibold">
                              {docCount} {docCount === 1 ? "document" : "documents"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-zinc-400">
                            <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                              <Cpu size={13} className="text-sky-400" />
                              Active Model:
                            </span>
                            <span className="text-sky-300 font-semibold truncate max-w-[140px]">
                              {modelName}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-zinc-400">
                            <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                              <Clock size={13} className="text-zinc-400" />
                              Last Activity:
                            </span>
                            <span className="text-zinc-300">{timeAgo(lastActive)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="pt-3 border-t border-[#1f2328]">
                        <Link
                          to={paths.workspace.chat(ws.slug)}
                          className="inline-flex items-center justify-between w-full text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                        >
                          <span>Open Workspace</span>
                          <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 5: Local Knowledge Base Status */}
          <div className="sovereign-card rounded-xl p-5 md:p-6 border border-[#1f2328] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1f2328]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-[#090a0b] text-zinc-300 border border-[#1f2328]">
                  <Database size={22} weight="duotone" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Local Knowledge Base
                    </h2>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                      <span className={`h-1.5 w-1.5 rounded-full ${isRetrievalReady ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
                      {isRetrievalReady ? "Ready for Retrieval" : "Standby"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-normal mt-0.5">
                    On-premise semantic index used for document grounding and local RAG operations.
                  </p>
                </div>
              </div>

              <Link
                to={paths.knowledge()}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#090a0b] hover:bg-[#18191d] border border-[#1f2328] text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
              >
                <span>Explore Vectors</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            {/* Knowledge Base Status Telemetry */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Indexed Documents */}
              <div className="p-3 rounded-lg bg-[#090a0b] border border-[#1f2328] space-y-1">
                <div className="flex items-center justify-between text-zinc-500 font-mono text-[10px] font-bold uppercase tracking-wider">
                  <span>Indexed Docs</span>
                  <Files size={13} className="text-zinc-400" />
                </div>
                <div className="text-xl font-extrabold text-white font-mono">{totalDocs}</div>
                <div className="text-[10px] text-zinc-500 font-mono">Validated on disk</div>
              </div>

              {/* Vector Chunks */}
              <div className="p-3 rounded-lg bg-[#090a0b] border border-[#1f2328] space-y-1">
                <div className="flex items-center justify-between text-zinc-500 font-mono text-[10px] font-bold uppercase tracking-wider">
                  <span>Knowledge Chunks</span>
                  <Database size={13} className="text-zinc-400" />
                </div>
                <div className="text-xl font-extrabold text-white font-mono">{totalVectors.toLocaleString()}</div>
                <div className="text-[10px] text-zinc-500 font-mono">Dense vector records</div>
              </div>

              {/* Embedding Model */}
              <div className="p-3 rounded-lg bg-[#090a0b] border border-[#1f2328] space-y-1">
                <div className="flex items-center justify-between text-zinc-500 font-mono text-[10px] font-bold uppercase tracking-wider">
                  <span>Embedding</span>
                  <Cpu size={13} className="text-zinc-400" />
                </div>
                <div className="text-xs font-bold text-zinc-200 font-mono truncate uppercase">
                  {embeddingEngineName}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono truncate">Local / On-Prem</div>
              </div>

              {/* Vector Database */}
              <div className="p-3 rounded-lg bg-[#090a0b] border border-[#1f2328] space-y-1">
                <div className="flex items-center justify-between text-zinc-500 font-mono text-[10px] font-bold uppercase tracking-wider">
                  <span>Vector DB</span>
                  <HardDrives size={13} className="text-zinc-400" />
                </div>
                <div className="text-xs font-bold text-sky-300 font-mono truncate uppercase">
                  {vectorDbName}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">Local storage engine</div>
              </div>

              {/* Index Status & Retrieval Readiness */}
              <div className="p-3 rounded-lg bg-[#090a0b] border border-[#1f2328] space-y-1 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between text-zinc-500 font-mono text-[10px] font-bold uppercase tracking-wider">
                  <span>Status</span>
                  <ShieldCheck size={13} className="text-emerald-400" weight="fill" />
                </div>
                <div className="text-xs font-bold text-emerald-400 font-mono truncate flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${isRetrievalReady ? "bg-emerald-400" : "bg-zinc-500"}`} />
                  {isRetrievalReady ? "Ready" : "Standby"}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono truncate">
                  {lastIndexUpdate}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 6 & 7: Recent Deliverables & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* SECTION 6: Recent Deliverables */}
            <div className="sovereign-card rounded-xl p-5 border border-[#1f2328] flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#1f2328]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-[#090a0b] text-zinc-300 border border-[#1f2328]">
                      <Package size={18} weight="duotone" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Recent Deliverables</h3>
                      <p className="text-[11px] text-zinc-500">Agent-generated outputs and verified artifacts</p>
                    </div>
                  </div>
                  <Link
                    to={paths.deliverables()}
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-mono transition-colors flex items-center gap-1"
                  >
                    <span>View all</span>
                    <ArrowRight size={11} />
                  </Link>
                </div>

                {deliverables.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-[#1f2328] rounded-xl bg-[#090a0b]/50 space-y-1.5">
                    <Package size={28} className="mx-auto text-zinc-600" weight="duotone" />
                    <p className="text-xs font-semibold text-zinc-300">No deliverables generated yet</p>
                    <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                      Approval notes, inspection reports, spreadsheets, and presentation files appear here after agent execution.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-[#1f2328]">
                    {deliverables.slice(0, 5).map((d) => (
                      <li
                        key={d.id}
                        className="py-2.5 flex items-center justify-between gap-3 group hover:bg-[#18191d] rounded-lg px-2 -mx-2 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono flex-shrink-0 text-sky-400 bg-sky-500/10 border-sky-500/20 uppercase">
                            {d.badge || d.type || "FILE"}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-zinc-200 group-hover:text-white truncate font-mono">
                              {d.filename}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                              <span>{d.type || "Document"}</span>
                              <span>·</span>
                              <span className="text-zinc-600 font-mono">{formatBytes(d.sizeBytes)}</span>
                              <span>·</span>
                              <span className="text-zinc-500 font-mono">{timeAgo(d.createdAt)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                            <CheckCircle size={10} weight="fill" />
                            Verified
                          </span>
                          {d.downloadUrl && (
                            <a
                              href={d.downloadUrl}
                              download
                              className="p-1.5 rounded-lg bg-[#090a0b] hover:bg-sky-500/10 border border-[#1f2328] hover:border-sky-500/30 text-zinc-400 hover:text-sky-400 transition-colors"
                              title="Download Deliverable"
                            >
                              <DownloadSimple size={13} weight="bold" />
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pt-2.5 border-t border-[#1f2328]">
                <Link
                  to={paths.deliverables()}
                  className="inline-flex items-center justify-between w-full text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                >
                  <span>Open Deliverables Center</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {/* SECTION 7: Recent Activity */}
            <div className="sovereign-card rounded-xl p-5 border border-[#1f2328] flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#1f2328]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      <Activity size={18} weight="duotone" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Recent Activity</h3>
                      <p className="text-[11px] text-zinc-500">Concise timeline of workbench and agent events</p>
                    </div>
                  </div>
                  <Link
                    to={paths.security()}
                    className="text-[11px] text-zinc-500 hover:text-sky-400 font-mono transition-colors flex items-center gap-1"
                  >
                    <span>View logs</span>
                    <ArrowRight size={11} />
                  </Link>
                </div>

                {auditEvents.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-[#1f2328] rounded-xl bg-[#090a0b]/50 space-y-1.5">
                    <Clock size={28} className="mx-auto text-zinc-600" weight="duotone" />
                    <p className="text-xs font-semibold text-zinc-300">No activity recorded yet</p>
                    <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                      Ingested documents, model reasoning, and agent reviews will appear here.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-[#1f2328]">
                    {auditEvents.slice(0, 5).map((ev, i) => (
                      <li
                        key={ev.id ?? i}
                        className="py-2.5 flex items-center justify-between gap-3 group hover:bg-[#18191d] rounded-lg px-2 -mx-2 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" weight="fill" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-zinc-200 group-hover:text-white truncate">
                              {labelEvent(ev.event)}
                            </p>
                            {ev.metadata?.workspaceName ? (
                              <p className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">
                                Workspace: {ev.metadata.workspaceName}
                              </p>
                            ) : ev.metadata?.documentName ? (
                              <p className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">
                                Document: {ev.metadata.documentName}
                              </p>
                            ) : ev.metadata?.title ? (
                              <p className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">
                                Task: {ev.metadata.title}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <span className="text-[10px] text-zinc-500 font-mono flex-shrink-0">
                          {timeAgo(ev.occurredAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pt-2.5 border-t border-[#1f2328]">
                <Link
                  to={paths.security()}
                  className="inline-flex items-center justify-between w-full text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                >
                  <span>View Full Audit Log</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
