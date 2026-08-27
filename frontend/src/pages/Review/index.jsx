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
  ArrowRight,
  CircleNotch,
  Quotes,
  Gauge,
  ListChecks,
  ArrowsClockwise,
  ClockCounterClockwise,
  Shield,
  Lightbulb,
} from "@phosphor-icons/react";
import Review from "@/models/review";
import Workspace from "@/models/workspace";
import showToast from "@/utils/toast";
import { toPercentString } from "@/utils/numbers";

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
    <div className="w-screen h-screen overflow-hidden bg-[#090a0b] text-[#f4f4f5] flex font-sans">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}

      <main className="flex-1 h-full overflow-y-auto bg-[#090a0b] p-6 md:p-10 pt-16 md:pt-10">
        <div className="max-w-5xl mx-auto space-y-8 pb-16">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1f2328] pb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="sovereign-badge sovereign-badge-sky font-mono">
                  SPECIALIST CONSENSUS ENGINE
                </span>
                <span className="text-xs text-zinc-500 font-mono">4 Review Domains</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Specialist AI Review &amp; Disagreement Resolver
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                Multi-perspective evaluation across Technical, Policy &amp; SOP, and Risk domains with traceable evidence grounding and conflict resolution.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleLoadTemplate("architecture")}
                className="px-3.5 py-2 rounded-xl bg-[#111215] hover:bg-[#18191d] border border-[#1f2328] text-xs font-semibold text-zinc-300 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Sparkle size={14} className="text-sky-400" weight="fill" />
                <span>Conflict Demo Template</span>
              </button>
            </div>
          </div>

          {/* Submission Card */}
          <div className="sovereign-card rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-2">
              <FileText size={18} className="text-sky-400" weight="duotone" />
              New Proposal or Document Review Submission
            </h2>

            <form onSubmit={handleRunReview} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task or Document Title (e.g. Core Infrastructure Review)..."
                  className="md:col-span-2 px-4 py-3 rounded-xl bg-[#090a0b] border border-[#1f2328] text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500 font-medium transition-colors"
                />

                {workspaces.length > 0 && (
                  <select
                    value={selectedWorkspace?.slug || ""}
                    onChange={(e) => {
                      const ws = workspaces.find((w) => w.slug === e.target.value);
                      if (ws) setSelectedWorkspace(ws);
                    }}
                    className="px-4 py-3 rounded-xl bg-[#090a0b] border border-[#1f2328] text-xs text-zinc-200 focus:outline-none focus:border-sky-500 font-medium transition-colors"
                  >
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.slug}>
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
                placeholder="Paste the document text, architectural specification, policy change, or confidential proposal to be evaluated by Sovereign AI specialists..."
                className="w-full p-4 rounded-xl bg-[#090a0b] border border-[#1f2328] text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500 font-mono leading-relaxed transition-colors"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="text-[11px] text-zinc-400 font-mono">
                  Specialists: <span className="text-sky-400 font-semibold">Technical</span> · <span className="text-amber-400 font-semibold">Policy</span> · <span className="text-emerald-400 font-semibold">Risk</span> · <span className="text-zinc-200 font-semibold">Final Decision</span>
                </div>

                <button
                  type="submit"
                  disabled={reviewing || !taskContent.trim()}
                  className="px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-extrabold flex items-center justify-center gap-2 transition-all disabled:opacity-50 flex-shrink-0 shadow-lg active:scale-95"
                >
                  {reviewing ? <CircleNotch size={16} className="animate-spin" /> : <Scales size={16} weight="bold" />}
                  <span>{reviewing ? "Executing Specialist Reviews..." : "Execute AI Review"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Active Review Results */}
          {currentReview && (
            <div className="space-y-6 pt-4">
              {/* Conflict Notification Banner */}
              {currentReview.hasConflict && (
                <div className="p-6 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 space-y-4 shadow-xl">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 mt-0.5 border border-amber-500/30">
                      <WarningCircle size={26} weight="fill" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold font-mono uppercase tracking-wider">
                        Conflict Detected
                      </div>
                      <h3 className="text-lg font-extrabold text-amber-300 tracking-tight">
                        AI Review Conflict
                      </h3>
                      <p className="text-xs text-amber-200/90 leading-relaxed">
                        Specialist agents produced contradictory assessments regarding the proposed workflow. Manual or synthetic resolution required.
                      </p>
                    </div>
                  </div>

                  {currentReview.conflicts.map((conflict, i) => (
                    <div key={i} className="p-5 rounded-xl bg-[#090a0b]/90 border border-amber-500/30 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300 text-sm">{conflict.title}</span>
                        <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 font-mono">
                          Severity: {conflict.severity}
                        </span>
                      </div>
                      <div className="text-zinc-300 leading-relaxed font-normal">
                        {conflict.summary}
                      </div>
                      <div className="p-3.5 rounded-xl bg-[#111215] text-emerald-300 border border-emerald-500/30 text-xs flex items-start gap-2.5">
                        <Lightbulb size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" weight="duotone" />
                        <div>
                          <strong className="text-emerald-400 font-bold">Resolution Recommendation:</strong> {conflict.recommendation}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Final Decision Executive Summary */}
              <div className="sovereign-card rounded-2xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1f2328] pb-4">
                  <div>
                    <div className="text-xs text-zinc-500 font-bold font-mono uppercase tracking-wider">SYNTHESIZED DETERMINATION</div>
                    <div className="text-xl font-extrabold text-white tracking-tight mt-1">
                      {currentReview.perspectives.finalDecision.determination}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="px-3.5 py-1.5 rounded-xl bg-[#090a0b] border border-[#1f2328] text-xs font-mono flex items-center gap-2">
                      <Gauge size={16} className="text-sky-400" />
                      <span className="text-zinc-400">Confidence:</span>
                      <span className="font-bold text-sky-400">
                        {Math.round((currentReview.overallConfidence || 0.9) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  {currentReview.perspectives.finalDecision.executiveSummary}
                </p>

                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">
                    Mandatory Directives
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {currentReview.perspectives.finalDecision.keyDirectives?.map((dir, i) => (
                      <div key={i} className="p-3 rounded-xl bg-[#090a0b] border border-[#1f2328] text-xs text-zinc-300 flex items-start gap-2">
                        <CheckCircle size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" weight="fill" />
                        <span>{dir}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Perspective Tabs & Deep Dive */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white tracking-tight font-mono uppercase">
                    Specialist Findings &amp; Evidence
                  </h3>

                  <div className="flex items-center p-1 rounded-xl bg-[#111215] border border-[#1f2328] text-xs">
                    {["all", "technical", "policy", "risk"].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActivePerspectiveTab(tab)}
                        className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-all font-mono ${
                          activePerspectiveTab === tab
                            ? "bg-sky-500 text-zinc-950 shadow-sm"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Technical Specialist */}
                  {(activePerspectiveTab === "all" || activePerspectiveTab === "technical") && (
                    <PerspectiveCard
                      perspective={currentReview.perspectives.technical}
                      color="sky"
                    />
                  )}

                  {/* Policy Specialist */}
                  {(activePerspectiveTab === "all" || activePerspectiveTab === "policy") && (
                    <PerspectiveCard
                      perspective={currentReview.perspectives.policy}
                      color="amber"
                    />
                  )}

                  {/* Risk Specialist */}
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
        </div>
      </main>
    </div>
  );
}

function PerspectiveCard({ perspective, color }) {
  if (!perspective) return null;

  const colorStyles = {
    sky: {
      badge: "sovereign-badge-sky",
      border: "border-sky-500/20",
      accent: "text-sky-400",
    },
    amber: {
      badge: "sovereign-badge-amber",
      border: "border-amber-500/20",
      accent: "text-amber-400",
    },
    emerald: {
      badge: "sovereign-badge-emerald",
      border: "border-emerald-500/20",
      accent: "text-emerald-400",
    },
  };

  const style = colorStyles[color] || colorStyles.sky;

  return (
    <div className={`sovereign-card rounded-2xl p-5 space-y-4 flex flex-col justify-between ${style.border}`}>
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-[#1f2328] pb-3">
          <div>
            <h4 className="text-xs font-bold text-white font-mono">{perspective.reviewer}</h4>
            <div className="text-[10px] text-zinc-500 font-mono">Confidence: {Math.round((perspective.confidence || 0.9) * 100)}%</div>
          </div>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${style.badge}`}>
            {perspective.status}
          </span>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          {perspective.perspectiveSummary}
        </p>

        {/* Findings */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
            Key Findings
          </div>
          {perspective.findings?.map((f, i) => (
            <div key={i} className="p-2.5 rounded-xl bg-[#090a0b] border border-[#1f2328] text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-200">{f.type}</span>
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
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1">
              <Quotes size={12} className={style.accent} />
              Evidence Grounding
            </div>
            {perspective.evidence.map((ev, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-[#090a0b] border border-[#1f2328] text-[11px] text-zinc-400 italic">
                "{ev.quote}"
                <div className="mt-1 text-[9px] text-zinc-400 not-italic font-mono font-semibold">
                  — {ev.source} ({ev.section})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      {perspective.recommendations?.length > 0 && (
        <div className="pt-3 border-t border-[#1f2328] space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
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
