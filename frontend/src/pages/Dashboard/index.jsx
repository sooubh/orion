import React, { useEffect, useState, useMemo } from "react";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import { isMobile } from "react-device-detect";
import {
  ChatCircleDots,
  Files,
  Database,
  Cpu,
  ArrowRight,
  Plus,
  Activity,
  UserCircle,
  DownloadSimple,
  CheckCircle,
  MagnifyingGlass,
  Sparkle,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import paths from "@/utils/paths";
import Security from "@/models/security";
import Workspace from "@/models/workspace";
import Deliverables from "@/models/deliverables";
import { userFromStorage } from "@/utils/request";
import NewWorkspaceModal, {
  useNewWorkspaceModal,
} from "@/components/Modals/NewWorkspace";
import OrionBrand from "@/components/OrionBrand";

function timeAgo(dateStr) {
  if (!dateStr) return "—";
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
    document_added: "Document ingested",
    document_uploaded: "Document uploaded & indexed",
    document_removed: "Document removed from index",
    user_login: "User session authenticated",
    user_logout: "User session closed",
    api_key_created: "Local API key generated",
    sent_llm_token_count: "Model inference completed",
    chat_sent: "RAG reasoning executed",
    ai_review_executed: "Agent review completed",
    deliverable_generated: "Deliverable generated",
  };
  return map[name] || name.replace(/_/g, " ");
}

export default function Dashboard() {
  const [securityData, setSecurityData] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    showing: showNewWsModal,
    showModal: openNewWsModal,
    hideModal: closeNewWsModal,
  } = useNewWorkspaceModal();

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [sec, ws, dels] = await Promise.all([
          Security.status(),
          Workspace.all(),
          Deliverables.all(),
        ]);
        setSecurityData(sec);
        setWorkspaces(ws || []);
        setDeliverables(dels || []);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const currentUser = userFromStorage();
  const userName = currentUser?.username || "Operator";
  const userRole = currentUser?.role ? currentUser.role.toUpperCase() : "ADMIN";

  const totalDocs = securityData?.dataProcessedLocally?.totalDocuments ?? 0;
  const totalVectors = securityData?.dataProcessedLocally?.totalVectors ?? 0;
  const externalConns = securityData?.externalConnections ?? 0;
  const llmEngine = securityData?.modelStatus?.provider || "Local / Ollama";
  const activeModelName = securityData?.modelStatus?.model || "Standard";
  const vectorDbName = securityData?.modelStatus?.vectorDb
    ? securityData.modelStatus.vectorDb.toUpperCase()
    : "LANCEDB";

  const memory = securityData?.runtime?.memory;
  const ramPct =
    memory?.totalMb && memory?.freeMb
      ? Math.round(((memory.totalMb - memory.freeMb) / memory.totalMb) * 100)
      : null;

  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery.trim()) return workspaces;
    const q = searchQuery.toLowerCase();
    return workspaces.filter(
      (ws) =>
        ws.name?.toLowerCase().includes(q) ||
        ws.slug?.toLowerCase().includes(q)
    );
  }, [workspaces, searchQuery]);

  const auditEvents = securityData?.auditEvents || [];

  return (
    <div className="w-full h-screen overflow-hidden bg-slate-50 dark:bg-[#090a0b] text-slate-800 dark:text-[#f4f4f5] flex font-sans">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}

      {showNewWsModal && <NewWorkspaceModal hideModal={closeNewWsModal} />}

      <main className="flex-1 min-w-0 h-full overflow-y-auto bg-slate-50 dark:bg-[#090a0b] p-4 sm:p-6 md:p-8 pt-16 md:pt-8">
        <div className="max-w-6xl mx-auto w-full space-y-6 pb-12">
          {/* Top Bar: Clean Identity & Primary CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#1f2328]">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <OrionBrand size="lg" />
                <span className="text-slate-400 dark:text-zinc-600 font-light">/</span>
                <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Command Center
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 uppercase shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                  {externalConns === 0
                    ? "Zero-Egress Secured"
                    : `${externalConns} Conns`}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400">
                Private intelligence platform operating in 100% local, air-gapped
                mode.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] text-xs font-mono text-slate-700 dark:text-zinc-300 shadow-sm">
                <UserCircle size={15} className="text-slate-500 dark:text-zinc-400" weight="duotone" />
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{userName}</span>
                <span className="text-slate-400 dark:text-zinc-600">/</span>
                <span className="text-sky-700 dark:text-sky-400 uppercase font-bold text-[10px]">
                  {userRole}
                </span>
              </div>

              <button
                onClick={openNewWsModal}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-bold transition-all shadow-md active:scale-95 flex-shrink-0"
              >
                <Plus size={14} weight="bold" />
                <span>New Workspace</span>
              </button>
            </div>
          </div>

          {/* 4 KPI Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Workspaces Stat */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] flex flex-col justify-between space-y-2 hover:border-slate-300 dark:hover:border-zinc-700 shadow-sm transition-colors">
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-600 dark:text-zinc-400">
                  Workspaces
                </span>
                <div className="p-1.5 rounded-md bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">
                  <ChatCircleDots size={16} weight="duotone" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                  {workspaces.length}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5 truncate">
                  Active intelligence units
                </div>
              </div>
            </div>

            {/* Knowledge Base Stat */}
            <Link
              to={paths.knowledge()}
              className="p-4 rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] flex flex-col justify-between space-y-2 hover:border-slate-300 dark:hover:border-zinc-700 shadow-sm transition-colors group"
            >
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-600 dark:text-zinc-400">
                  Knowledge Base
                </span>
                <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 group-hover:text-emerald-800 dark:group-hover:text-emerald-300">
                  <Database size={16} weight="duotone" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono flex items-baseline gap-1.5 flex-wrap">
                  <span>{totalDocs}</span>
                  <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">docs</span>
                  <span className="text-slate-300 dark:text-zinc-600">·</span>
                  <span className="text-sm font-mono text-slate-700 dark:text-zinc-300">
                    {totalVectors.toLocaleString()}
                  </span>
                  <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">chunks</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5 truncate">
                  {vectorDbName} Vector Store
                </div>
              </div>
            </Link>

            {/* Inference Model Stat */}
            <Link
              to={paths.settings.llmPreference()}
              className="p-4 rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] flex flex-col justify-between space-y-2 hover:border-slate-300 dark:hover:border-zinc-700 shadow-sm transition-colors group"
            >
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-600 dark:text-zinc-400">
                  LLM Engine
                </span>
                <div className="p-1.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 group-hover:text-purple-800 dark:group-hover:text-purple-300">
                  <Cpu size={16} weight="duotone" />
                </div>
              </div>
              <div>
                <div className="text-base font-bold text-slate-900 dark:text-white font-mono truncate uppercase">
                  {llmEngine}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5 truncate font-mono">
                  {activeModelName}
                </div>
              </div>
            </Link>

            {/* System Security & Health */}
            <Link
              to={paths.security()}
              className="p-4 rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] flex flex-col justify-between space-y-2 hover:border-slate-300 dark:hover:border-zinc-700 shadow-sm transition-colors group"
            >
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-600 dark:text-zinc-400">
                  System Health
                </span>
                <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 group-hover:text-emerald-800 dark:group-hover:text-emerald-300">
                  <Activity size={16} weight="duotone" />
                </div>
              </div>
              <div>
                <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
                  <span>Operational</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5 truncate font-mono">
                  {ramPct != null ? `${ramPct}% RAM in use` : "Local Subprocess"}
                </div>
              </div>
            </Link>
          </div>

          {/* Main 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
            {/* LEFT: Active Workspaces (8 cols on desktop) */}
            <div className="lg:col-span-8 space-y-4 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Active Workspaces
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    Grounded local intelligence workspaces for chat, research, and analysis.
                  </p>
                </div>

                {workspaces.length > 3 && (
                  <div className="relative w-full sm:w-56">
                    <MagnifyingGlass
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter workspaces..."
                      className="w-full bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-sky-500 shadow-sm transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Workspaces Grid / Empty State */}
              {workspaces.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-[#1f2328] bg-white/50 dark:bg-[#111215]/50 p-8 text-center space-y-3">
                  <div className="mx-auto w-10 h-10 rounded-full bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Sparkle size={20} weight="duotone" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                      No workspaces yet
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-sm mx-auto mt-1">
                      Create an isolated workspace to ground local documents and converse with private AI models.
                    </p>
                  </div>
                  <button
                    onClick={openNewWsModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-bold transition-all shadow-md"
                  >
                    <Plus size={14} weight="bold" />
                    Create First Workspace
                  </button>
                </div>
              ) : filteredWorkspaces.length === 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-[#1f2328] bg-white dark:bg-[#111215] p-6 text-center text-xs text-slate-600 dark:text-zinc-400 shadow-sm">
                  No workspaces match &quot;{searchQuery}&quot;.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {filteredWorkspaces.map((ws) => {
                    const docCount = ws.documents?.length || 0;
                    const modelName =
                      ws.chatModel || ws.chatProvider || activeModelName;

                    return (
                      <div
                        key={ws.id}
                        className="rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] p-4 hover:border-slate-300 dark:hover:border-zinc-700 shadow-sm transition-all flex flex-col justify-between group space-y-3.5 min-w-0"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-300 transition-colors truncate">
                                {ws.name}
                              </h3>
                              <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono truncate">
                                /{ws.slug}
                              </p>
                            </div>
                            <div className="p-1.5 rounded-md bg-slate-50 dark:bg-[#090a0b] text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-[#1f2328] flex-shrink-0">
                              <ChatCircleDots size={16} weight="duotone" />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono text-slate-600 dark:text-zinc-400">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 dark:bg-[#090a0b] border border-slate-200 dark:border-[#1f2328] text-slate-700 dark:text-zinc-400">
                              <Files size={11} className="text-slate-500 dark:text-zinc-500" />
                              {docCount} {docCount === 1 ? "doc" : "docs"}
                            </span>

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 dark:bg-[#090a0b] border border-slate-200 dark:border-[#1f2328] text-sky-700 dark:text-sky-300 max-w-[140px] truncate">
                              <Cpu size={11} className="text-sky-600 dark:text-sky-400" />
                              {modelName}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-slate-200 dark:border-[#1f2328] flex items-center justify-between text-xs">
                          <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono">
                            {timeAgo(ws.lastUpdatedAt || ws.createdAt)}
                          </span>

                          <Link
                            to={paths.workspace.chat(ws.slug)}
                            className="inline-flex items-center gap-1 font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition-colors"
                          >
                            <span>Open Chat</span>
                            <ArrowRight
                              size={12}
                              className="group-hover:translate-x-0.5 transition-transform"
                            />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT: Quick Stream (Recent Activity & Deliverables) (4 cols on desktop) */}
            <div className="lg:col-span-4 space-y-4 min-w-0">
              {/* Recent Activity Card */}
              <div className="rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] p-4 space-y-3 shadow-sm min-w-0">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-[#1f2328]">
                  <div className="flex items-center gap-2">
                    <Activity size={16} className="text-sky-600 dark:text-sky-400" weight="duotone" />
                    <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-800 dark:text-white">
                      Recent Activity
                    </h3>
                  </div>
                  <Link
                    to={paths.security()}
                    className="text-[11px] text-slate-500 hover:text-sky-600 dark:text-zinc-500 dark:hover:text-sky-400 font-mono transition-colors"
                  >
                    View log
                  </Link>
                </div>

                {auditEvents.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 dark:text-zinc-500 font-mono">
                    No activity recorded yet
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {auditEvents.slice(0, 5).map((ev, i) => (
                      <div
                        key={ev.id ?? i}
                        className="flex items-start justify-between gap-2 text-xs min-w-0"
                      >
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <CheckCircle
                            size={13}
                            className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5"
                            weight="fill"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-slate-800 dark:text-zinc-300 font-medium truncate leading-tight">
                              {labelEvent(ev.event)}
                            </p>
                            {ev.metadata?.workspaceName ? (
                              <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono truncate">
                                {ev.metadata.workspaceName}
                              </p>
                            ) : ev.metadata?.documentName ? (
                              <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono truncate">
                                {ev.metadata.documentName}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono flex-shrink-0">
                          {timeAgo(ev.occurredAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Deliverables Card */}
              <div className="rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] p-4 space-y-3 shadow-sm min-w-0">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-[#1f2328]">
                  <div className="flex items-center gap-2">
                    <Files size={16} className="text-emerald-600 dark:text-emerald-400" weight="duotone" />
                    <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-800 dark:text-white">
                      Generated Files
                    </h3>
                  </div>
                  <Link
                    to={paths.deliverables()}
                    className="text-[11px] text-slate-500 hover:text-sky-600 dark:text-zinc-500 dark:hover:text-sky-400 font-mono transition-colors"
                  >
                    View all
                  </Link>
                </div>

                {deliverables.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 dark:text-zinc-500 font-mono">
                    No exported files yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deliverables.slice(0, 4).map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-[#090a0b] border border-slate-200 dark:border-[#1f2328] hover:border-slate-300 dark:hover:border-zinc-700 transition-colors min-w-0"
                      >
                        <div className="min-w-0 flex items-center gap-2 flex-1">
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded font-mono text-sky-700 bg-sky-50 border border-sky-200 dark:text-sky-400 dark:bg-sky-500/10 dark:border-sky-500/20 uppercase flex-shrink-0">
                            {d.type || "DOC"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-slate-800 dark:text-zinc-200 truncate font-mono">
                              {d.filename}
                            </p>
                            <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono">
                              {formatBytes(d.sizeBytes)} · {timeAgo(d.createdAt)}
                            </span>
                          </div>
                        </div>

                        {d.downloadUrl && (
                          <a
                            href={d.downloadUrl}
                            download
                            className="p-1.5 rounded bg-slate-200 hover:bg-sky-100 text-slate-600 hover:text-sky-700 dark:bg-zinc-800 dark:hover:bg-sky-500/10 dark:text-zinc-400 dark:hover:text-sky-400 transition-colors flex-shrink-0"
                            title="Download"
                          >
                            <DownloadSimple size={12} weight="bold" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
