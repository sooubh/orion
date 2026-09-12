import React, { useState, useEffect } from "react";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import { isMobile } from "react-device-detect";
import {
  ShieldCheck,
  Scales,
  WarningCircle,
  CheckCircle,
  FileText,
  Sparkle,
  CircleNotch,
  Quotes,
  Gauge,
  ListChecks,
  ArrowsClockwise,
  ClockCounterClockwise,
  Shield,
  Lightbulb,
  X,
  CaretDown,
} from "@phosphor-icons/react";
import Review from "@/models/review";
import Workspace from "@/models/workspace";
import showToast from "@/utils/toast";

export default function ReviewPage() {
  const [taskTitle, setTaskTitle] = useState("");
  const [taskContent, setTaskContent] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [currentReview, setCurrentReview] = useState(null);
  const [reviewHistory, setReviewHistory] = useState([]);
  const [activePerspectiveTab, setActivePerspectiveTab] = useState("all");

  useEffect(() => {
    async function init() {
      try {
        const [wsList, history] = await Promise.all([
          Workspace.all(),
          Review.history(),
        ]);
        setWorkspaces(wsList || []);
        if (wsList?.length > 0) setSelectedWorkspace(wsList[0]);
        setReviewHistory(history || []);
      } catch (err) {
        console.error("Review init error:", err);
      } finally {
        setLoadingWorkspaces(false);
      }
    }
    init();
  }, []);

  async function handleRunReview(e) {
    e?.preventDefault();
    if (!taskContent.trim()) {
      showToast("Please enter document or task specifications to review", "warning");
      return;
    }

    setReviewing(true);
    try {
      const response = await Review.run({
        title: taskTitle.trim() || "Confidential Task Review",
        content: taskContent.trim(),
        workspaceSlug: selectedWorkspace?.slug || null,
      });

      if (response?.success && response?.review) {
        setCurrentReview(response.review);
        setReviewHistory((prev) => [response.review, ...prev]);
        showToast("Specialist AI Review completed successfully", "success");
      } else {
        showToast(response?.error || "Failed to execute AI Review", "error");
      }
    } catch (err) {
      console.error("Review execution error:", err);
      showToast("Review failed", "error");
    } finally {
      setReviewing(false);
    }
  }

  function handleLoadTemplate(type) {
    if (type === "architecture") {
      setTaskTitle("Sovereign Enterprise Architecture & Microservices Review");
      setTaskContent(
        "System Architecture Specification v2.4:\n" +
        "1. Deploy on-premise local LLM inference cluster with zero internet egress.\n" +
        "2. Database schema implements SQLite with local LanceDB vector caching.\n" +
        "3. Incorporates temporary cloud API gateway fallback for burst requests when local queue exceeds 20 jobs.\n" +
        "4. Enforce strict role-based access control (RBAC) across Admin and Manager roles."
      );
    } else if (type === "policy") {
      setTaskTitle("Confidential Data Retention & SOP Audit");
      setTaskContent(
        "Operating Procedure SOP-772:\n" +
        "1. All employee queries and document extracts must be retained for 90 days in local database logs.\n" +
        "2. External telemetry, analytics beaconing, and third-party hosted cloud services are prohibited.\n" +
        "3. Cryptographic access token validation required for all administrative actions."
      );
    }
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex font-sans">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}

      <main className="flex-1 h-full overflow-y-auto modern-scrollbar p-4 md:p-8 pt-16 md:pt-8 bg-theme-bg-secondary">
        <div className="max-w-5xl mx-auto space-y-6 pb-16">
          {/* Header & Breadcrumb */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <span>Platform</span>
                <span>/</span>
                <span className="text-indigo-400">Governance</span>
                <span>/</span>
                <span className="text-zinc-200">Specialist AI Review</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <Scales size={24} weight="duotone" className="text-indigo-400" />
                Specialist AI Review &amp; Disagreement Resolver
              </h1>
              <p className="text-xs text-zinc-400 max-w-2xl">
                Multi-perspective evaluation across Technical, Policy &amp; SOP, and Risk domains with traceable evidence grounding and conflict resolution.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleLoadTemplate("architecture")}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-xs font-medium text-zinc-300 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                <Sparkle size={13} className="text-indigo-400" weight="fill" />
                <span>Load Demo Conflict</span>
              </button>
            </div>
          </div>

          {/* Submission Form Card */}
          <div className="rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <FileText size={16} className="text-indigo-400" weight="duotone" />
                <span>New Proposal or Document Review Submission</span>
              </h2>
              <span className="text-[11px] text-zinc-500 font-mono">Consensus Engine</span>
            </div>

            <form onSubmit={handleRunReview} className="space-y-3.5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task or Document Title (e.g. Infrastructure Architecture Review)..."
                  className="md:col-span-2 px-3.5 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-700/60 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />

                {workspaces.length > 0 && (
                  <select
                    value={selectedWorkspace?.slug || ""}
                    onChange={(e) => {
                      const ws = workspaces.find((w) => w.slug === e.target.value);
                      if (ws) setSelectedWorkspace(ws);
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700/60 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.slug} className="bg-zinc-900 text-white">
                        Grounding: {ws.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <textarea
                rows={5}
                value={taskContent}
                onChange={(e) => setTaskContent(e.target.value)}
                placeholder="Paste the document text, architectural specification, policy change, or confidential proposal to be evaluated by Orion specialists..."
                className="w-full p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-700/60 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed transition-colors"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-1.5 flex-wrap">
                  <span className="text-zinc-500">Domains:</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">Technical</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">Policy &amp; SOP</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Risk &amp; Security</span>
                </div>

                <button
                  type="submit"
                  disabled={reviewing || !taskContent.trim()}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shrink-0 shadow-md active:scale-95 cursor-pointer"
                >
                  {reviewing ? <CircleNotch size={15} className="animate-spin" /> : <Scales size={15} weight="bold" />}
                  <span>{reviewing ? "Executing Specialist Reviews..." : "Execute AI Review"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Active Review Results */}
          {currentReview && (
            <div className="space-y-5 pt-2">
              {/* Conflict Notification Banner */}
              {currentReview.hasConflict && (
                <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3.5 shadow-xl">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 mt-0.5 border border-amber-500/30 shrink-0">
                      <WarningCircle size={22} weight="fill" />
                    </div>
                    <div className="space-y-0.5 flex-1">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold font-mono uppercase tracking-wider">
                        Conflict Detected
                      </div>
                      <h3 className="text-base font-bold text-amber-300 tracking-tight">
                        AI Review Conflict &amp; Contradiction Notice
                      </h3>
                      <p className="text-xs text-amber-200/80 leading-relaxed">
                        Specialist agents produced divergent evaluations. Recommended mitigation options are presented below.
                      </p>
                    </div>
                  </div>

                  {currentReview.conflicts.map((conflict, i) => (
                    <div key={i} className="p-4 rounded-xl bg-zinc-950/80 border border-amber-500/20 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-300">{conflict.title}</span>
                        <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Severity: {conflict.severity}
                        </span>
                      </div>
                      <div className="text-zinc-300 leading-relaxed">
                        {conflict.summary}
                      </div>
                      <div className="p-3 rounded-lg bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 text-xs flex items-start gap-2">
                        <Lightbulb size={16} className="text-emerald-400 shrink-0 mt-0.5" weight="duotone" />
                        <div>
                          <strong className="text-emerald-400 font-semibold">Resolution Recommendation:</strong> {conflict.recommendation}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Final Decision Executive Summary */}
              <div className="rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 p-5 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <span className="text-[10px] text-zinc-500 font-mono font-bold uppercase tracking-wider">SYNTHESIZED DETERMINATION</span>
                    <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                      {currentReview.perspectives.finalDecision.determination}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700/60 text-xs font-mono flex items-center gap-2">
                      <Gauge size={15} className="text-indigo-400" />
                      <span className="text-zinc-400">Confidence:</span>
                      <span className="font-bold text-indigo-400">
                        {Math.round((currentReview.overallConfidence || 0.9) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  {currentReview.perspectives.finalDecision.executiveSummary}
                </p>

                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                    Mandatory Directives
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {currentReview.perspectives.finalDecision.keyDirectives?.map((dir, i) => (
                      <div key={i} className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-700/60 text-xs text-zinc-300 flex items-start gap-2">
                        <CheckCircle size={15} className="text-emerald-400 shrink-0 mt-0.5" weight="fill" />
                        <span className="leading-snug">{dir}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Perspective Tabs & Specialist Findings */}
              <div className="space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-zinc-300 tracking-wider font-mono uppercase">
                    Specialist Findings &amp; Grounded Evidence
                  </h3>

                  <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-700/60 text-xs overflow-x-auto">
                    {["all", "technical", "policy", "risk"].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActivePerspectiveTab(tab)}
                        className={`px-3 py-1 rounded-lg font-medium capitalize transition-all font-mono text-xs cursor-pointer ${
                          activePerspectiveTab === tab
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(activePerspectiveTab === "all" || activePerspectiveTab === "technical") && (
                    <PerspectiveCard
                      perspective={currentReview.perspectives.technical}
                      color="indigo"
                    />
                  )}
                  {(activePerspectiveTab === "all" || activePerspectiveTab === "policy") && (
                    <PerspectiveCard
                      perspective={currentReview.perspectives.policy}
                      color="amber"
                    />
                  )}
                  {(activePerspectiveTab === "all" || activePerspectiveTab === "risk") && (
                    <PerspectiveCard
                      perspective={currentReview.perspectives.risk}
                      color="emerald"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Historical Reviews Drawer */}
          {reviewHistory.length > 0 && (
            <div className="rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-2">
                  <ClockCounterClockwise size={16} className="text-zinc-400" />
                  <span>Recent Review Logs ({reviewHistory.length})</span>
                </span>
              </div>
              <div className="divide-y divide-white/5 max-h-48 overflow-y-auto modern-scrollbar">
                {reviewHistory.map((rev, idx) => (
                  <div
                    key={idx}
                    onClick={() => setCurrentReview(rev)}
                    className="py-2.5 px-2 flex items-center justify-between text-xs hover:bg-zinc-800/40 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${rev.hasConflict ? "bg-amber-400" : "bg-emerald-400"}`} />
                      <span className="font-medium text-white">{rev.title}</span>
                    </div>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : "Saved"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function PerspectiveCard({ perspective, color }) {
  if (!perspective) return null;

  const colorStyles = {
    indigo: {
      badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      border: "border-indigo-500/20",
      accent: "text-indigo-400",
    },
    amber: {
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      border: "border-amber-500/20",
      accent: "text-amber-400",
    },
    emerald: {
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      border: "border-emerald-500/20",
      accent: "text-emerald-400",
    },
  };

  const style = colorStyles[color] || colorStyles.indigo;

  return (
    <div className={`rounded-2xl bg-theme-bg-sidebar/70 border ${style.border} p-4 space-y-3 flex flex-col justify-between shadow-md`}>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div>
            <h4 className="text-xs font-bold text-white font-mono">{perspective.reviewer}</h4>
            <div className="text-[10px] text-zinc-500 font-mono">Confidence: {Math.round((perspective.confidence || 0.9) * 100)}%</div>
          </div>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${style.badge}`}>
            {perspective.status}
          </span>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          {perspective.perspectiveSummary}
        </p>

        {/* Findings */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono">
            Key Findings
          </div>
          {perspective.findings?.map((f, i) => (
            <div key={i} className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-700/60 text-xs space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-200 text-[11px]">{f.type}</span>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded font-mono ${
                  f.severity === "High" ? "bg-rose-500/20 text-rose-300" : "bg-zinc-800 text-zinc-300"
                }`}>
                  {f.severity}
                </span>
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>

        {/* Evidence */}
        {perspective.evidence?.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1">
              <Quotes size={11} className={style.accent} />
              <span>Evidence Grounding</span>
            </div>
            {perspective.evidence.map((ev, i) => (
              <div key={i} className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-700/60 text-[11px] text-zinc-400 italic">
                "{ev.quote}"
                <div className="mt-1 text-[9px] text-zinc-500 not-italic font-mono">
                  — {ev.source} ({ev.section})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      {perspective.recommendations?.length > 0 && (
        <div className="pt-2.5 border-t border-white/10 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono">
            Recommendations
          </div>
          <ul className="text-[11px] text-zinc-400 space-y-1 list-disc list-inside">
            {perspective.recommendations.map((rec, i) => (
              <li key={i} className="leading-relaxed">{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

