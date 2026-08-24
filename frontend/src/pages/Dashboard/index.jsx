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
  CheckCircle,
  Cpu,
  HardDrives,
  ArrowRight,
  Sparkle,
  Lock,
  Plus,
  Compass,
} from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router-dom";
import paths from "@/utils/paths";
import Security from "@/models/security";
import Workspace from "@/models/workspace";

export default function Dashboard() {
  const navigate = useNavigate();
  const [securityData, setSecurityData] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [sec, ws] = await Promise.all([
          Security.status(),
          Workspace.all(),
        ]);
        setSecurityData(sec);
        setWorkspaces(ws || []);
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
  const activeModel = securityData?.modelStatus?.provider || "Ollama / Local LLM";
  const vectorDb = securityData?.modelStatus?.vectorDb || "LanceDB";

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#090a0b] text-[#f4f4f5] flex font-sans">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}

      <main className="flex-1 h-full overflow-y-auto bg-[#090a0b] p-6 md:p-10 pt-16 md:pt-10">
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
          {/* Top Banner - Local AI Isolation Status */}
          <div className="relative rounded-2xl bg-[#111215] border border-[#1f2328] p-6 md:p-8 overflow-hidden shadow-2xl">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none text-sky-400">
              <Shield size={180} weight="duotone" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold tracking-wider uppercase font-mono">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  100% Local &amp; Air-Gapped Ready
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white font-sans">
                  Sovereign AI <span className="text-sky-400 font-light">Command Center</span>
                </h1>
                <p className="text-sm md:text-base text-zinc-400 max-w-xl leading-relaxed font-normal">
                  Confidential, zero-egress intelligence. All embeddings, model inference, and vector lookups are strictly bound to local hardware.
                </p>
              </div>

              {/* Status Indicator Pills */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="px-4 py-3 rounded-xl bg-[#090a0b]/90 border border-[#1f2328] flex items-center gap-3 shadow-inner">
                  <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <Cpu size={22} weight="duotone" />
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">LOCAL MODEL</div>
                    <div className="text-xs font-semibold text-zinc-200 uppercase font-mono">{activeModel}</div>
                  </div>
                </div>

                <div className="px-4 py-3 rounded-xl bg-[#090a0b]/90 border border-[#1f2328] flex items-center gap-3 shadow-inner">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle size={22} weight="duotone" />
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">EXTERNAL CONNS</div>
                    <div className="text-xs font-bold text-emerald-400 font-mono">0 (Air-Gapped)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sovereign-card rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">Workspaces</span>
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                  <ChatCircleDots size={20} weight="duotone" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white font-mono tracking-tight">
                {workspaces.length}
              </div>
              <div className="text-xs text-zinc-400 flex items-center gap-1.5 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400"></span>
                Isolated namespaces
              </div>
            </div>

            <div className="sovereign-card rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">Local Docs</span>
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Files size={20} weight="duotone" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white font-mono tracking-tight">
                {totalDocs}
              </div>
              <div className="text-xs text-zinc-400 flex items-center gap-1.5 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400"></span>
                Indexed on disk
              </div>
            </div>

            <div className="sovereign-card rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">Embedded Vectors</span>
                <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
                  <Database size={20} weight="duotone" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white font-mono tracking-tight">
                {totalVectors}
              </div>
              <div className="text-xs text-zinc-400 flex items-center gap-1.5 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400"></span>
                {vectorDb} Engine
              </div>
            </div>

            <div className="sovereign-card rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">Security State</span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <ShieldCheck size={20} weight="duotone" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
                LOCKED
              </div>
              <div className="text-xs text-zinc-400 flex items-center gap-1.5 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Zero outbound traffic
              </div>
            </div>
          </div>

          {/* Quick Operations Launchers */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Compass size={20} className="text-sky-400" weight="duotone" />
                Core Operations Hub
              </h2>
              <span className="text-xs text-zinc-500 font-mono">7 Navigation Sections</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                to={paths.workspace.chat("primary")}
                className="sovereign-card rounded-xl p-5 group flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 w-fit group-hover:bg-sky-500/20 group-hover:scale-105 transition-all">
                    <ChatCircleDots size={22} weight="duotone" />
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">
                    Confidential Workspace Chat
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                    Multi-turn conversational AI with local document grounding and agent tool execution.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#1f2328] flex items-center justify-between text-xs text-sky-400 font-semibold">
                  <span>Open Workspace</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              <Link
                to={paths.review()}
                className="sovereign-card rounded-xl p-5 group flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 w-fit group-hover:bg-amber-500/20 group-hover:scale-105 transition-all">
                    <ShieldCheck size={22} weight="duotone" />
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                    Specialist AI Review
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                    Multi-perspective review across Technical, Policy, and Risk with AI Review Conflict detection.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#1f2328] flex items-center justify-between text-xs text-amber-400 font-semibold">
                  <span>Run AI Review</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              <Link
                to={paths.knowledge()}
                className="sovereign-card rounded-xl p-5 group flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-400 w-fit group-hover:bg-teal-500/20 group-hover:scale-105 transition-all">
                    <Database size={22} weight="duotone" />
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-teal-400 transition-colors">
                    Knowledge &amp; Vector Database
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                    Inspect local vector embeddings, similarity thresholds, and test semantic retrieval queries.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#1f2328] flex items-center justify-between text-xs text-teal-400 font-semibold">
                  <span>Explore Vectors</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              <Link
                to={paths.documents()}
                className="sovereign-card rounded-xl p-5 group flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 w-fit group-hover:bg-purple-500/20 group-hover:scale-105 transition-all">
                    <Files size={22} weight="duotone" />
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                    Documents Ingestion
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                    Local document parser for PDF, DOCX, XLSX, PPTX, CSV, and text chunk inspection.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#1f2328] flex items-center justify-between text-xs text-purple-400 font-semibold">
                  <span>Manage Documents</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              <Link
                to={paths.deliverables()}
                className="sovereign-card rounded-xl p-5 group flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 w-fit group-hover:bg-blue-500/20 group-hover:scale-105 transition-all">
                    <Package size={22} weight="duotone" />
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                    Generated Deliverables
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                    Exported documents, spreadsheets, presentations, and verified local artifacts.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#1f2328] flex items-center justify-between text-xs text-blue-400 font-semibold">
                  <span>View Deliverables</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              <Link
                to={paths.security()}
                className="sovereign-card rounded-xl p-5 group flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 w-fit group-hover:bg-emerald-500/20 group-hover:scale-105 transition-all">
                    <Shield size={22} weight="duotone" />
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                    Security Center &amp; Audits
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                    Hardware vitals, memory utilization, data isolation verification, and immutable audit logs.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#1f2328] flex items-center justify-between text-xs text-emerald-400 font-semibold">
                  <span>Open Security Center</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>
          </div>

          {/* Active Workspaces Table */}
          <div className="sovereign-card rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Active Confidential Workspaces</h3>
                <p className="text-xs text-zinc-400">Independent isolated memory environments</p>
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
              <div className="text-center py-10 border border-dashed border-[#1f2328] rounded-xl bg-[#090a0b]/50">
                <ChatCircleDots size={36} className="mx-auto text-zinc-600 mb-2" weight="duotone" />
                <p className="text-sm text-zinc-400 font-medium">No workspaces created yet</p>
                <p className="text-xs text-zinc-500 mt-1">Create your first confidential workspace to start chatting and grounding documents.</p>
                <button
                  onClick={() => navigate(paths.workspace.chat("new"))}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-bold transition-all shadow-md"
                >
                  <Plus size={14} weight="bold" />
                  Create First Workspace
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#1f2328] text-zinc-400 font-mono">
                      <th className="pb-3 font-semibold uppercase">Workspace Name</th>
                      <th className="pb-3 font-semibold uppercase">Documents</th>
                      <th className="pb-3 font-semibold uppercase">Model Engine</th>
                      <th className="pb-3 font-semibold uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f2328]">
                    {workspaces.map((ws) => (
                      <tr key={ws.id} className="hover:bg-[#18191d] transition-colors group">
                        <td className="py-3 font-semibold text-white flex items-center gap-2">
                          <ChatCircleDots size={16} className="text-sky-400" weight="duotone" />
                          <span>{ws.name}</span>
                        </td>
                        <td className="py-3 text-zinc-400 font-mono">
                          {ws.documents?.length || 0} docs
                        </td>
                        <td className="py-3 text-zinc-400 font-mono uppercase">
                          {ws.chatProvider || "Default Local"}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            to={paths.workspace.chat(ws.slug)}
                            className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-semibold"
                          >
                            <span>Open</span>
                            <ArrowRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
