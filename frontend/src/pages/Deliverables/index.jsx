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
    if (["docx", "doc"].includes(ext)) return "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20";
    if (["xlsx", "xls", "csv"].includes(ext)) return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
    if (["pptx", "ppt"].includes(ext)) return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
    if (ext === "pdf") return "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20";
    return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
  }

  // Count breakdowns
  const wordCount = deliverables.filter((d) => ["docx", "doc"].includes(d.extension)).length;
  const sheetCount = deliverables.filter((d) => ["xlsx", "xls", "csv"].includes(d.extension)).length;
  const pptCount = deliverables.filter((d) => ["pptx", "ppt"].includes(d.extension)).length;
  const pdfCount = deliverables.filter((d) => d.extension === "pdf").length;
  const codeCount = deliverables.filter((d) => ["js", "py", "ts", "json", "sh"].includes(d.extension)).length;

  return (
    <div className="w-full h-screen overflow-hidden bg-slate-50 dark:bg-[#090a0b] text-slate-800 dark:text-[#f4f4f5] flex font-sans">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}

      <main className="flex-1 min-w-0 h-full overflow-y-auto bg-slate-50 dark:bg-[#090a0b] p-4 sm:p-6 md:p-8 pt-16 md:pt-8">
        <div className="max-w-6xl mx-auto space-y-6 pb-16">
          {/* Header & Breadcrumb */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-[#1f2328]">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-zinc-400">
                <span>Platform</span>
                <span className="text-slate-400 dark:text-zinc-600">/</span>
                <span className="text-sky-700 dark:text-sky-400 font-semibold">Outputs</span>
                <span className="text-slate-400 dark:text-zinc-600">/</span>
                <span className="text-slate-800 dark:text-zinc-200">Deliverables</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                <Package size={24} weight="duotone" className="text-sky-600 dark:text-sky-400" />
                Deliverables &amp; Output Hub
              </h1>
              <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-2xl">
                Centralized registry for all reports, spreadsheets, presentations, and code artifacts generated by Orion agents on local storage.
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] space-y-1 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-600 dark:text-zinc-400 block">Total Artifacts</span>
              <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">{deliverables.length}</div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500">Stored locally</span>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] space-y-1 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-600 dark:text-zinc-400 block">Word &amp; Docs</span>
              <div className="text-xl font-bold text-indigo-700 dark:text-indigo-400 font-mono">{wordCount}</div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500">.docx, .doc</span>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] space-y-1 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-600 dark:text-zinc-400 block">Spreadsheets</span>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">{sheetCount}</div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500">.xlsx, .csv</span>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] space-y-1 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-600 dark:text-zinc-400 block">Slides</span>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-400 font-mono">{pptCount}</div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500">.pptx, .ppt</span>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] space-y-1 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition-colors col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-600 dark:text-zinc-400 block">PDF &amp; Code</span>
              <div className="text-xl font-bold text-sky-700 dark:text-sky-400 font-mono">{pdfCount + codeCount}</div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500">PDF, scripts</span>
            </div>
          </div>

          {/* Filters and Search Bar */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    selectedFilter === filter.id
                      ? "bg-sky-500 text-zinc-950 shadow-sm"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <span>{filter.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    selectedFilter === filter.id ? "bg-black/15 text-zinc-950 font-bold" : "bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-medium"
                  }`}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search deliverables..."
                className="w-full pl-8 pr-7 py-2 rounded-lg bg-slate-50 dark:bg-[#090a0b] border border-slate-200 dark:border-[#1f2328] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-sky-500 shadow-sm transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Deliverables Grid */}
          {loading ? (
            <div className="py-20 text-center text-slate-500 dark:text-zinc-400 flex flex-col items-center gap-3">
              <CircleNotch size={24} className="animate-spin text-sky-600 dark:text-sky-400" />
              <span className="text-xs font-mono">Loading local artifacts registry...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] p-16 text-center space-y-3 shadow-sm">
              <FolderOpen size={44} className="mx-auto text-slate-400 dark:text-zinc-600" weight="duotone" />
              <div className="text-sm font-bold text-slate-900 dark:text-white">No deliverables found</div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                When agents generate reports, spreadsheets, slide presentations, or code outputs during chat sessions, they are stored locally and indexed here for instant download.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] hover:border-slate-300 dark:hover:border-zinc-700 p-4 space-y-3 flex flex-col justify-between transition-all group shadow-sm"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#090a0b] border border-slate-200 dark:border-[#1f2328] shrink-0">
                        {getDeliverableIcon(item.extension)}
                      </div>
                      <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${getBadgeColor(item.extension)}`}>
                        .{item.extension}
                      </span>
                    </div>

                    <div>
                      <h3
                        className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors line-clamp-1"
                        title={item.title || item.filename}
                      >
                        {item.title || item.filename}
                      </h3>
                      <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                        {item.description || "Generated confidential artifact."}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-200 dark:border-[#1f2328] flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                    <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">{humanFileSize(item.size || 20480)}</span>
                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      disabled={downloadingId === item.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
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

