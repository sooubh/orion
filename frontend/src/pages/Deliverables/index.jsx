import React, { useEffect, useState } from "react";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import { isMobile } from "react-device-detect";
import {
  Package,
  DownloadSimple,
  FileDoc,
  FileXls,
  FilePdf,
  FileCode,
  FileText,
  CircleNotch,
  MagnifyingGlass,
  Presentation,
  FolderOpen,
  X,
  HardDrive,
  Calendar,
} from "@phosphor-icons/react";
import Deliverables from "@/models/deliverables";
import showToast from "@/utils/toast";
import { humanFileSize } from "@/utils/numbers";
import { saveAs } from "file-saver";

export default function DeliverablesPage() {
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    loadDeliverables();
  }, []);

  async function loadDeliverables() {
    setLoading(true);
    try {
      const items = await Deliverables.all();
      setDeliverables(items || []);
    } catch (err) {
      console.error("Failed to load deliverables:", err);
      showToast("Could not load deliverables", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(item) {
    setDownloadingId(item.id);
    try {
      const res = await fetch(item.downloadUrl);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      saveAs(blob, item.filename);
      showToast(`Downloaded ${item.filename}`, "success");
    } catch (err) {
      console.error("Download error:", err);
      showToast("Failed to download artifact", "error");
    } finally {
      setDownloadingId(null);
    }
  }

  const filteredItems = deliverables.filter((item) => {
    const matchesType =
      selectedFilter === "all"
        ? true
        : selectedFilter === "docx"
        ? ["docx", "doc"].includes(item.extension)
        : selectedFilter === "xlsx"
        ? ["xlsx", "xls", "csv"].includes(item.extension)
        : selectedFilter === "pptx"
        ? ["pptx", "ppt"].includes(item.extension)
        : selectedFilter === "pdf"
        ? item.extension === "pdf"
        : selectedFilter === "code"
        ? ["js", "py", "ts", "json", "sh", "html", "css"].includes(item.extension)
        : true;

    const matchesSearch =
      (item.title || item.filename || "").toLowerCase().includes(searchQuery.toLowerCase());

    return matchesType && matchesSearch;
  });

  function getDeliverableIcon(ext = "") {
    if (["docx", "doc"].includes(ext))
      return <FileDoc size={22} className="text-indigo-400" weight="duotone" />;
    if (["xlsx", "xls", "csv"].includes(ext))
      return <FileXls size={22} className="text-emerald-400" weight="duotone" />;
    if (["pptx", "ppt"].includes(ext))
      return <Presentation size={22} className="text-amber-400" weight="duotone" />;
    if (ext === "pdf")
      return <FilePdf size={22} className="text-rose-400" weight="duotone" />;
    if (["js", "py", "ts", "json", "sh"].includes(ext))
      return <FileCode size={22} className="text-sky-400" weight="duotone" />;
    return <FileText size={22} className="text-zinc-400" weight="duotone" />;
  }

  function getBadgeColor(ext = "") {
    if (["docx", "doc"].includes(ext)) return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
    if (["xlsx", "xls", "csv"].includes(ext)) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (["pptx", "ppt"].includes(ext)) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    if (ext === "pdf") return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    return "bg-zinc-800 text-zinc-300 border-zinc-700";
  }

  // Count breakdowns
  const wordCount = deliverables.filter((d) => ["docx", "doc"].includes(d.extension)).length;
  const sheetCount = deliverables.filter((d) => ["xlsx", "xls", "csv"].includes(d.extension)).length;
  const pptCount = deliverables.filter((d) => ["pptx", "ppt"].includes(d.extension)).length;
  const pdfCount = deliverables.filter((d) => d.extension === "pdf").length;
  const codeCount = deliverables.filter((d) => ["js", "py", "ts", "json", "sh"].includes(d.extension)).length;

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex font-sans">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}

      <main className="flex-1 h-full overflow-y-auto modern-scrollbar p-4 md:p-8 pt-16 md:pt-8 bg-theme-bg-secondary">
        <div className="max-w-6xl mx-auto space-y-6 pb-16">
          {/* Header & Breadcrumb */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <span>Platform</span>
                <span>/</span>
                <span className="text-indigo-400">Outputs</span>
                <span>/</span>
                <span className="text-zinc-200">Deliverables</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <Package size={24} weight="duotone" className="text-indigo-400" />
                Deliverables &amp; Output Hub
              </h1>
              <p className="text-xs text-zinc-400 max-w-2xl">
                Centralized registry for all reports, spreadsheets, presentations, and code artifacts generated by Orion agents on local storage.
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-4 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-1">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Total Artifacts</span>
              <div className="text-xl font-bold text-white font-mono">{deliverables.length}</div>
              <span className="text-[10px] text-zinc-500">Stored locally</span>
            </div>
            <div className="p-4 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-1">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Word &amp; Docs</span>
              <div className="text-xl font-bold text-indigo-400 font-mono">{wordCount}</div>
              <span className="text-[10px] text-zinc-500">.docx, .doc</span>
            </div>
            <div className="p-4 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-1">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Spreadsheets</span>
              <div className="text-xl font-bold text-emerald-400 font-mono">{sheetCount}</div>
              <span className="text-[10px] text-zinc-500">.xlsx, .csv</span>
            </div>
            <div className="p-4 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-1">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Slides</span>
              <div className="text-xl font-bold text-amber-400 font-mono">{pptCount}</div>
              <span className="text-[10px] text-zinc-500">.pptx, .ppt</span>
            </div>
            <div className="p-4 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">PDF &amp; Code</span>
              <div className="text-xl font-bold text-sky-400 font-mono">{pdfCount + codeCount}</div>
              <span className="text-[10px] text-zinc-500">PDF, scripts</span>
            </div>
          </div>

          {/* Filters and Search Bar */}
          <div className="p-4 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto py-1">
              {[
                { id: "all", label: "All Formats", count: deliverables.length },
                { id: "docx", label: "Word (.docx)", count: wordCount },
                { id: "xlsx", label: "Excel (.xlsx)", count: sheetCount },
                { id: "pptx", label: "Slides (.pptx)", count: pptCount },
                { id: "pdf", label: "PDF", count: pdfCount },
                { id: "code", label: "Code", count: codeCount },
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSelectedFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    selectedFilter === filter.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                  }`}
                >
                  <span>{filter.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedFilter === filter.id ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-400"
                  }`}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search deliverables..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-700/60 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Deliverables Grid */}
          {loading ? (
            <div className="py-20 text-center text-zinc-400 flex flex-col items-center gap-3">
              <CircleNotch size={24} className="animate-spin text-indigo-400" />
              <span className="text-xs font-mono">Loading local artifacts registry...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 p-16 text-center space-y-3">
              <FolderOpen size={44} className="mx-auto text-zinc-600" weight="duotone" />
              <div className="text-sm font-semibold text-zinc-200">No deliverables found</div>
              <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                When agents generate reports, spreadsheets, slide presentations, or code outputs during chat sessions, they are stored locally and indexed here for instant download.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 hover:border-indigo-500/40 p-4 space-y-3 flex flex-col justify-between transition-all group shadow-sm"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-700/60 shrink-0">
                        {getDeliverableIcon(item.extension)}
                      </div>
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${getBadgeColor(item.extension)}`}>
                        .{item.extension}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                        {item.title || item.filename}
                      </h3>
                      <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                        {item.description || "Generated confidential artifact."}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-mono text-[11px]">{humanFileSize(item.size || 20480)}</span>
                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      disabled={downloadingId === item.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      {downloadingId === item.id ? (
                        <CircleNotch size={13} className="animate-spin" />
                      ) : (
                        <DownloadSimple size={13} weight="bold" />
                      )}
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

