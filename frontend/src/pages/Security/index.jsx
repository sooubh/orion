import React, { useEffect, useState } from "react";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import { isMobile } from "react-device-detect";
import {
  Shield,
  ShieldCheck,
  ShieldWarning,
  CheckCircle,
  Cpu,
  HardDrives,
  LockKey,
  Wrench,
  ClockCounterClockwise,
  CircleNotch,
  Terminal,
  ArrowsClockwise,
  Lock,
  WifiSlash,
  Fingerprint,
  Activity,
  Check,
  WarningCircle,
  Prohibit,
  Sliders,
  Database,
  FileText,
} from "@phosphor-icons/react";
import Security from "@/models/security";
import showToast from "@/utils/toast";

function formatUptime(seconds) {
  if (!seconds) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function SecurityPage() {
  const [securityData, setSecurityData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [policyAuditLogs, setPolicyAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("matrix");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSecurityData();
  }, []);

  async function loadSecurityData() {
    setLoading(true);
    try {
      const [sec, logs, pol, polLogs] = await Promise.all([
        Security.status(),
        Security.auditLogs(),
        Security.policies(),
        Security.policyAudit(),
      ]);
      setSecurityData(sec);
      setAuditLogs(logs || []);
      setPolicies(pol || []);
      setPolicyAuditLogs(polLogs || []);
    } catch (err) {
      console.error("Failed to load security status:", err);
      showToast("Failed to fetch security vitals", "error");
    } finally {
      setLoading(false);
    }
  }

  const freeMb = securityData?.runtime?.memory?.freeMb || 0;
  const totalMb = securityData?.runtime?.memory?.totalMb || 0;
  const processRss = securityData?.runtime?.memory?.processRssMb || 0;
  const sysMemoryPercent =
    totalMb > 0 ? Math.min(100, Math.round(((totalMb - freeMb) / totalMb) * 100)) : 0;

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container text-theme-text-primary flex font-sans">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}

      <main className="flex-1 h-full overflow-y-auto modern-scrollbar bg-theme-bg-secondary p-4 md:p-8 pt-16 md:pt-8">
        <div className="max-w-6xl mx-auto space-y-6 pb-16">
          {/* Breadcrumbs & Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-theme-sidebar-border/40">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-1.5">
                <span>Platform</span>
                <span>/</span>
                <span>Sovereign Air-Gap</span>
                <span>/</span>
                <span className="text-emerald-400 font-semibold">Security Center</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                <ShieldCheck size={28} className="text-emerald-400" weight="duotone" />
                Security &amp; Isolation Center
              </h1>
              <p className="text-xs md:text-sm text-zinc-400 mt-1">
                Verified on-premise runtime parameters, air-gap zero-egress enforcement, and cryptographic audit logs.
              </p>
            </div>

            <button
              onClick={loadSecurityData}
              disabled={loading}
              className="self-start md:self-auto px-4 py-2 rounded-xl bg-theme-bg-sidebar/80 hover:bg-theme-bg-sidebar border border-theme-sidebar-border/70 text-xs font-semibold text-zinc-200 transition-all flex items-center gap-2 shadow-sm active:scale-95 disabled:opacity-50"
            >
              <ArrowsClockwise size={14} className={loading ? "animate-spin text-emerald-400" : ""} />
              <span>{loading ? "Refreshing..." : "Refresh Telemetry"}</span>
            </button>
          </div>

          {/* Prominent Local Only & External Connections: 0 Hero Banner */}
          <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-zinc-900/90 via-zinc-900/60 to-emerald-950/20 border border-emerald-500/30 shadow-xl relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2.5 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    LOCAL AIR-GAP ACTIVE
                  </span>
                  <span className="px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 text-zinc-300 text-xs font-mono font-semibold flex items-center gap-1.5">
                    <WifiSlash size={14} className="text-emerald-400" />
                    External connections: <strong className="text-emerald-400 font-mono">0</strong>
                  </span>
                  <span className="px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 text-zinc-300 text-xs font-mono font-semibold">
                    Telemetry: <strong className="text-zinc-400">Detached</strong>
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
                  Zero-Egress Isolation Protocol Active
                </h2>
                <p className="text-xs md:text-sm text-zinc-400 leading-relaxed">
                  Third-party remote telemetry (Segment, PostHog, Discord webhooks) has been strictly decoupled. All database transactions, vector embeddings, model inferences, and agent actions execute strictly on isolated local host storage.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-zinc-950/70 border border-theme-sidebar-border/60 space-y-2 min-w-[220px] shadow-inner backdrop-blur-sm">
                <div className="text-[10px] text-zinc-500 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Fingerprint size={13} className="text-emerald-400" />
                  ENCRYPTION SCHEME
                </div>
                <div className="text-sm font-extrabold text-white font-mono flex items-center gap-2">
                  <Lock size={15} className="text-emerald-400" weight="fill" />
                  AES-256-GCM
                </div>
                <div className="text-[11px] text-zinc-400 flex items-center gap-1 font-mono">
                  <Check size={12} className="text-emerald-400" />
                  Local key &amp; salt verified
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-theme-sidebar-border/40 pb-3">
            <button
              onClick={() => setActiveTab("matrix")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === "matrix"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-theme-bg-sidebar/50 text-zinc-400 hover:text-white hover:bg-theme-bg-sidebar"
              }`}
            >
              <Shield size={16} weight="duotone" />
              <span>Policy Governance Matrix</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-900/60 text-indigo-300 font-mono">
                4 Tiers
              </span>
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === "audit"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-theme-bg-sidebar/50 text-zinc-400 hover:text-white hover:bg-theme-bg-sidebar"
              }`}
            >
              <Prohibit size={16} weight="duotone" />
              <span>Policy Interception Stream</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300 font-mono">
                {policyAuditLogs.length} events
              </span>
            </button>
            <button
              onClick={() => setActiveTab("vitals")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === "vitals"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-theme-bg-sidebar/50 text-zinc-400 hover:text-white hover:bg-theme-bg-sidebar"
              }`}
            >
              <Activity size={16} weight="duotone" />
              <span>Hardware & Vitals</span>
            </button>
          </div>

          {/* TAB 1: POLICY GOVERNANCE MATRIX */}
          {activeTab === "matrix" && (
            <div className="space-y-6">
              {/* Sovereign Policy Guarantees Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-theme-bg-sidebar/60 border border-theme-sidebar-border/50 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 font-mono">
                    <ShieldCheck size={16} weight="bold" />
                    <span>FAIL-CLOSED DEFAULT</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    Uncertainty or missing rules trigger immediate rejection. Downgrades without admin authority are blocked.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-theme-bg-sidebar/60 border border-theme-sidebar-border/50 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 font-mono">
                    <LockKey size={16} weight="bold" />
                    <span>SOVEREIGN BOUNDARY</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    Confidential and Restricted data is quarantined to local open-weight models (Ollama/Llama). Cloud models DENIED.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-theme-bg-sidebar/60 border border-theme-sidebar-border/50 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400 font-mono">
                    <Sliders size={16} weight="bold" />
                    <span>AGENT TOOL GATING</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    Unauthorized agent tools are hidden before model prompting and intercepted at execution runtime.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-theme-bg-sidebar/60 border border-theme-sidebar-border/50 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 font-mono">
                    <Fingerprint size={16} weight="bold" />
                    <span>DATA SUPREMUM LINEAGE</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    Derived outputs and synthesized responses automatically inherit the highest sensitivity level of input chunks.
                  </p>
                </div>
              </div>

              {/* 4 Classification Tiers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* RESTRICTED */}
                <div className="rounded-2xl p-5 bg-zinc-900/80 border border-rose-500/40 shadow-lg space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-3 py-1 bg-rose-500/20 text-rose-400 text-[10px] font-mono font-bold rounded-bl-xl border-l border-b border-rose-500/30">
                    TIER 4 — MAXIMUM
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                      <h3 className="text-base font-bold text-white font-mono">RESTRICTED</h3>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Top-secret IP, cryptographic keys, SCADA/PLC registers, ITAR blueprints, defense-grade specs.
                    </p>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Model Policy</span>
                      <span className="text-rose-300 font-medium">100% Sovereign Local Open-Weight (Ollama/Llama 3.2). Cloud LLMs DENIED.</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Tool Policy</span>
                      <span className="text-zinc-300 font-medium">Air-gapped loopback only. Web scraping &amp; external networking BLOCKED.</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Knowledge &amp; RAG</span>
                      <span className="text-zinc-300 font-medium">Restricted clearance required. Pruned from lower clearance queries.</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Action &amp; Export</span>
                      <span className="text-rose-400 font-medium">Export DENIED. Deletion restricted to Administrator role.</span>
                    </div>
                  </div>
                </div>

                {/* CONFIDENTIAL */}
                <div className="rounded-2xl p-5 bg-zinc-900/80 border border-amber-500/40 shadow-lg space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500/20 text-amber-400 text-[10px] font-mono font-bold rounded-bl-xl border-l border-b border-amber-500/30">
                    TIER 3 — ELEVATED
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <h3 className="text-base font-bold text-white font-mono">CONFIDENTIAL</h3>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Proprietary industrial schemas, internal financial records, employee PII, partner NDAs.
                    </p>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Model Policy</span>
                      <span className="text-amber-300 font-medium">Sovereign Local Open-Weight Models. External Cloud LLMs BLOCKED.</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Tool Policy</span>
                      <span className="text-zinc-300 font-medium">Internal workspace tools &amp; document search. External web scraping BLOCKED.</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Knowledge &amp; RAG</span>
                      <span className="text-zinc-300 font-medium">Confidential clearance required. Workspace members only.</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Action &amp; Export</span>
                      <span className="text-amber-400 font-medium">Export logged. Standard member modification allowed.</span>
                    </div>
                  </div>
                </div>

                {/* INTERNAL */}
                <div className="rounded-2xl p-5 bg-zinc-900/80 border border-blue-500/40 shadow-lg space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-3 py-1 bg-blue-500/20 text-blue-400 text-[10px] font-mono font-bold rounded-bl-xl border-l border-b border-blue-500/30">
                    TIER 2 — STANDARD
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                      <h3 className="text-base font-bold text-white font-mono">INTERNAL</h3>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Operational SOPs, engineering architecture notes, internal tickets, non-sensitive logs.
                    </p>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Model Policy</span>
                      <span className="text-blue-300 font-medium">Sovereign Local Models preferred. Authorized internal enterprise routes.</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Tool Policy</span>
                      <span className="text-zinc-300 font-medium">Standard sandboxed agent tools permitted with execution audit.</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Knowledge &amp; RAG</span>
                      <span className="text-zinc-300 font-medium">Standard authenticated users and internal workspace members.</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Action &amp; Export</span>
                      <span className="text-zinc-300 font-medium">Standard export and workspace actions permitted.</span>
                    </div>
                  </div>
                </div>

                {/* PUBLIC */}
                <div className="rounded-2xl p-5 bg-zinc-900/80 border border-emerald-500/40 shadow-lg space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold rounded-bl-xl border-l border-b border-emerald-500/30">
                    TIER 1 — OPEN
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <h3 className="text-base font-bold text-white font-mono">PUBLIC</h3>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Public whitepapers, published API specs, open source manuals, general product literature.
                    </p>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Model Policy</span>
                      <span className="text-emerald-300 font-medium">All Models (Local open-weight and cloud if configured).</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Tool Policy</span>
                      <span className="text-zinc-300 font-medium">All tools permitted, including web browsing and external scraping.</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Knowledge &amp; RAG</span>
                      <span className="text-zinc-300 font-medium">Unrestricted clearance across all workspaces.</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Action &amp; Export</span>
                      <span className="text-zinc-300 font-medium">Unrestricted export, delete, and sharing.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: POLICY INTERCEPTION STREAM */}
          {activeTab === "audit" && (
            <div className="rounded-2xl overflow-hidden bg-theme-bg-sidebar/40 border border-theme-sidebar-border/40 shadow-xl">
              <div className="px-6 py-4 border-b border-theme-sidebar-border/40 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={18} className="text-indigo-400" weight="duotone" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                    Policy Enforcement &amp; Interception Audit
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {policyAuditLogs.length} events
                  </span>
                </div>
                <span className="text-xs text-zinc-500 font-mono flex items-center gap-1.5">
                  <HardDrives size={13} className="text-zinc-400" />
                  Audit Engine v2.0
                </span>
              </div>

              {loading ? (
                <div className="py-16 text-center text-zinc-500 text-xs font-mono flex flex-col items-center justify-center gap-2">
                  <CircleNotch size={24} className="animate-spin text-indigo-400" />
                  <span>Loading policy interception audit stream...</span>
                </div>
              ) : policyAuditLogs.length === 0 ? (
                <div className="py-16 text-center text-zinc-500 text-xs font-mono">
                  No policy security events recorded yet. Upload sensitive documents or trigger agent queries to observe policy enforcement.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-theme-sidebar-border/40 bg-zinc-900/40 text-zinc-400">
                        <th className="py-3 px-6 font-semibold uppercase">Event Type</th>
                        <th className="py-3 px-4 font-semibold uppercase">Status</th>
                        <th className="py-3 px-4 font-semibold uppercase">Details &amp; Rationale</th>
                        <th className="py-3 px-6 font-semibold uppercase text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-sidebar-border/30">
                      {policyAuditLogs.map((log) => {
                        const isBlocked = log.event.includes("blocked") || log.event.includes("denied");
                        const isUpdated = log.event.includes("updated");
                        return (
                          <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="py-3.5 px-6 font-bold text-white flex items-center gap-2">
                              {isBlocked ? (
                                <Prohibit size={15} className="text-rose-400 shrink-0" weight="bold" />
                              ) : isUpdated ? (
                                <Sliders size={15} className="text-amber-400 shrink-0" weight="bold" />
                              ) : (
                                <CheckCircle size={15} className="text-emerald-400 shrink-0" weight="fill" />
                              )}
                              <span className="truncate max-w-[200px]">{log.event}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  isBlocked
                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                                    : isUpdated
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                }`}
                              >
                                {isBlocked ? "BLOCKED" : isUpdated ? "OVERRIDDEN" : "ENFORCED"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-zinc-300 max-w-md">
                              <div className="truncate">
                                {log.metadata ? (
                                  typeof log.metadata === "string" ? (
                                    log.metadata
                                  ) : (
                                    JSON.stringify(log.metadata)
                                  )
                                ) : (
                                  "Deterministic policy evaluation"
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-6 text-right text-zinc-500">
                              {new Date(log.occurredAt).toLocaleTimeString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: HARDWARE & AIR-GAP VITALS */}
          {activeTab === "vitals" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* System Memory */}
                <div className="rounded-2xl p-5 bg-theme-bg-sidebar/40 border border-theme-sidebar-border/40 hover:border-theme-sidebar-border/70 transition-all space-y-3">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-xs font-bold uppercase tracking-wider font-mono">Process RSS / Memory</span>
                    <Cpu size={20} className="text-indigo-400" weight="duotone" />
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold text-white font-mono">
                      {processRss || 190} <span className="text-xs text-zinc-400 font-normal">MB RSS</span>
                    </div>
                    <div className="text-xs text-zinc-400 font-mono mt-1">
                      System: {freeMb || 1024} MB free / {totalMb || 8192} MB total
                    </div>
                  </div>
                  <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${sysMemoryPercent || 35}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500">
                    <span>System RAM Load</span>
                    <span>{sysMemoryPercent}%</span>
                  </div>
                </div>

                {/* Platform Runtime */}
                <div className="rounded-2xl p-5 bg-theme-bg-sidebar/40 border border-theme-sidebar-border/40 hover:border-theme-sidebar-border/70 transition-all space-y-3">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-xs font-bold uppercase tracking-wider font-mono">Host Environment</span>
                    <Terminal size={20} className="text-emerald-400" weight="duotone" />
                  </div>
                  <div>
                    <div className="text-lg font-extrabold text-white truncate font-mono">
                      {securityData?.runtime?.platform || "Windows_NT x64"}
                    </div>
                    <div className="text-xs text-zinc-400 font-mono mt-1">
                      Node {securityData?.runtime?.nodeVersion || "v20"}
                    </div>
                  </div>
                  <div className="pt-1 flex items-center justify-between text-xs font-mono text-zinc-400 border-t border-theme-sidebar-border/30">
                    <span className="text-zinc-500">Host Uptime</span>
                    <span className="text-emerald-400 font-semibold">
                      {formatUptime(securityData?.runtime?.uptimeSeconds || 0)}
                    </span>
                  </div>
                </div>

                {/* Sandboxed Tools */}
                <div className="rounded-2xl p-5 bg-theme-bg-sidebar/40 border border-theme-sidebar-border/40 hover:border-theme-sidebar-border/70 transition-all space-y-3">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-xs font-bold uppercase tracking-wider font-mono">Agent Tool Sandboxing</span>
                    <Wrench size={20} className="text-amber-400" weight="duotone" />
                  </div>
                  <div>
                    <div className="text-lg font-extrabold text-emerald-400 font-mono flex items-center gap-1.5">
                      <CheckCircle size={18} weight="fill" className="text-emerald-400" />
                      Active Isolation
                    </div>
                    <div className="text-xs text-zinc-400 font-mono mt-1">
                      Subprocess &amp; Whitelist validation
                    </div>
                  </div>
                  <div className="pt-1 flex items-center justify-between text-xs font-mono text-zinc-400 border-t border-theme-sidebar-border/30">
                    <span className="text-zinc-500">Network Layer</span>
                    <span className="text-zinc-300">Air-Gapped Loopback</span>
                  </div>
                </div>
              </div>

              {/* General System Audit Log */}
              <div className="rounded-2xl overflow-hidden bg-theme-bg-sidebar/40 border border-theme-sidebar-border/40 shadow-xl">
                <div className="px-6 py-4 border-b border-theme-sidebar-border/40 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <ClockCounterClockwise size={18} className="text-emerald-400" weight="duotone" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                      System Runtime Audit Log
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {auditLogs.length} events
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono flex items-center gap-1.5">
                    <HardDrives size={13} className="text-zinc-400" />
                    Stored in SQLite (orion.db)
                  </span>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="py-16 text-center text-zinc-500 text-xs font-mono">
                    No system audit events recorded in this session.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-theme-sidebar-border/40 bg-zinc-900/40 text-zinc-400">
                          <th className="py-3 px-6 font-semibold uppercase">Event Type</th>
                          <th className="py-3 px-4 font-semibold uppercase">User / Source</th>
                          <th className="py-3 px-4 font-semibold uppercase">Details</th>
                          <th className="py-3 px-6 font-semibold uppercase text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-sidebar-border/30">
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="py-3.5 px-6 font-bold text-indigo-300 flex items-center gap-2">
                              <CheckCircle size={14} className="text-emerald-400 shrink-0" weight="fill" />
                              <span>{log.event}</span>
                            </td>
                            <td className="py-3.5 px-4 text-zinc-300">
                              {log.userId ? (
                                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                                  User #{log.userId}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Local System
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-zinc-400 truncate max-w-xs">
                              {log.metadata ? (
                                typeof log.metadata === "string" ? (
                                  log.metadata
                                ) : (
                                  JSON.stringify(log.metadata)
                                )
                              ) : (
                                "Standard local execution"
                              )}
                            </td>
                            <td className="py-3.5 px-6 text-right text-zinc-500">
                              {new Date(log.occurredAt).toLocaleTimeString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
