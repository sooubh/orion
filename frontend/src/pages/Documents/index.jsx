import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import paths from "@/utils/paths";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import { isMobile } from "react-device-detect";
import {
  Files,
  UploadSimple,
  FileText,
  FilePdf,
  FileDoc,
  FileXls,
  FileCode,
  MagnifyingGlass,
  Lightning,
  X,
  CircleNotch,
  Folder,
  Database,
  HardDrives,
  CheckCircle,
  Eye,
  Shield,
  ShieldCheck,
  Trash,
  ChatCircleDots,
  MinusCircle,
} from "@phosphor-icons/react";
import System from "@/models/system";
import Workspace from "@/models/workspace";
import Security from "@/models/security";
import showToast from "@/utils/toast";
import { humanFileSize } from "@/utils/numbers";
import Modal, { ModalHeader, ModalBody, ModalFooter } from "@/components/lib/Modal";
import useUser from "@/hooks/useUser";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [selectedWorkspaceDetail, setSelectedWorkspaceDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFileType, setSelectedFileType] = useState("all");
  const [selectedSensitivity, setSelectedSensitivity] = useState("all");
  const [selectedDocForPreview, setSelectedDocForPreview] = useState(null);
  const [selectedDocForReview, setSelectedDocForReview] = useState(null);
  const [reviewClassification, setReviewClassification] = useState("CONFIDENTIAL");
  const [reviewReason, setReviewReason] = useState("");
  const [updatingClassification, setUpdatingClassification] = useState(false);
  const [embeddingDocId, setEmbeddingDocId] = useState(null);
  const [deletingDocId, setDeletingDocId] = useState(null);
  const { user } = useUser();
  const canDelete = user?.role !== "default";
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [filesData, wsList] = await Promise.all([
        System.localFiles(),
        Workspace.all(),
      ]);

      const flatDocs = [];
      if (filesData?.items) {
        await Promise.all(
          filesData.items.map(async (folder) => {
            const folderData = await System.localFiles(folder.name, 0, "all");
            if (folderData?.documents) {
              folderData.documents.forEach((doc) => {
                flatDocs.push({
                  ...doc,
                  folderName: folder.name,
                });
              });
            }
          })
        );
      }

      setDocuments(flatDocs);
      setWorkspaces(wsList || []);

      const activeWs = selectedWorkspace || (wsList?.length > 0 ? wsList[0] : null);
      if (activeWs) {
        setSelectedWorkspace(activeWs);
        const detail = await Workspace.bySlug(activeWs.slug);
        setSelectedWorkspaceDetail(detail);
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
      showToast("Could not load local documents", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!selectedWorkspace) {
      showToast("Please select a workspace before uploading documents", "warning");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    let successCount = 0;
    const errors = [];
    const uploadedFileNames = [];

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file, file.name);

        const { response, data } = await Workspace.uploadFile(
          selectedWorkspace.slug,
          formData
        );

        if (response?.ok && data?.success) {
          successCount++;
          uploadedFileNames.push(file.name);
        } else {
          errors.push(data?.error || `Failed to upload ${file.name}`);
        }
      }

      if (successCount > 0) {
        showToast(
          `Parsed ${successCount} file${successCount > 1 ? "s" : ""}. Embedding into workspace...`,
          "success"
        );

        // Reload document list to discover the parsed document paths
        const filesData = await System.localFiles();
        const docPaths = [];
        if (filesData?.items) {
          for (const folder of filesData.items) {
            const folderData = await System.localFiles(folder.name, 0, "all");
            if (folderData?.documents) {
              for (const doc of folderData.documents) {
                // Match uploaded files by checking if the doc title/name contains any uploaded filename
                const docBaseName = (doc.title || doc.name || "").replace(/\.[^.]+$/, "");
                const matched = uploadedFileNames.some((fn) => {
                  const uploadBase = fn.replace(/\.[^.]+$/, "");
                  return docBaseName.toLowerCase().includes(uploadBase.toLowerCase());
                });
                if (matched) {
                  docPaths.push(`${folder.name}/${doc.name}`);
                }
              }
            }
          }
        }

        // Auto-embed all newly uploaded docs into the selected workspace
        if (docPaths.length > 0) {
          const res = await Workspace.modifyEmbeddings(selectedWorkspace.slug, {
            adds: docPaths,
            deletes: [],
          });
          if (res?.workspace) {
            showToast(
              `Embedded ${docPaths.length} document${docPaths.length > 1 ? "s" : ""} into ${selectedWorkspace.name}`,
              "success"
            );
          } else {
            showToast("Documents parsed but embedding failed. You can embed manually.", "warning");
          }
        }

        await loadData();
      }

      if (errors.length > 0) {
        showToast(
          `Failed to upload ${errors.length} file${errors.length > 1 ? "s" : ""}: ${errors[0]}`,
          "error"
        );
      }
    } catch (err) {
      console.error("Upload error:", err);
      showToast("Failed to upload document", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleEmbedInWorkspace(doc) {
    if (!selectedWorkspace) {
      showToast("Please select a workspace to embed this document into", "warning");
      return;
    }

    setEmbeddingDocId(doc.id);
    try {
      const docPath = `${doc.folderName}/${doc.name}`;
      const res = await Workspace.modifyEmbeddings(selectedWorkspace.slug, {
        adds: [docPath],
        deletes: [],
      });

      if (res?.workspace) {
        showToast(`Embedded "${doc.title || doc.name}" into ${selectedWorkspace.name}`, "success");
        setSelectedWorkspaceDetail(res.workspace);
      } else {
        showToast("Failed to embed into workspace", "error");
      }
    } catch (err) {
      console.error("Embedding error:", err);
      showToast("Embedding failed", "error");
    } finally {
      setEmbeddingDocId(null);
    }
  }

  async function handleUnembedFromWorkspace(doc) {
    if (!selectedWorkspace) return;

    setEmbeddingDocId(doc.id);
    try {
      const docPath = `${doc.folderName}/${doc.name}`;
      const res = await Workspace.modifyEmbeddings(selectedWorkspace.slug, {
        adds: [],
        deletes: [docPath],
      });

      if (res?.workspace) {
        showToast(`Unembedded "${doc.title || doc.name}" from ${selectedWorkspace.name}`, "success");
        setSelectedWorkspaceDetail(res.workspace);
      } else {
        showToast("Failed to unembed from workspace", "error");
      }
    } catch (err) {
      console.error("Unembedding error:", err);
      showToast("Unembedding failed", "error");
    } finally {
      setEmbeddingDocId(null);
    }
  }

  async function handleDeleteDocument(doc) {
    if (!canDelete) {
      showToast("You are not authorized to delete documents", "error");
      return;
    }
    if (
      !window.confirm(
        "Delete this document? This will also remove its indexed content."
      )
    ) {
      return;
    }

    setDeletingDocId(doc.id);
    try {
      const target = `${doc.folderName}/${doc.name}`;
      const success = await System.deleteDocuments([target]);
      if (success) {
        showToast(`Deleted "${doc.title || doc.name}"`, "success");
        await loadData();
      } else {
        showToast("Failed to delete document", "error");
      }
    } catch (err) {
      console.error("Delete document error:", err);
      showToast(`Delete failed: ${err.message}`, "error");
    } finally {
      setDeletingDocId(null);
    }
  }

  async function handleSaveClassificationOverride() {
    if (!selectedDocForReview) return;
    setUpdatingClassification(true);
    try {
      const res = await Security.updateClassification(
        selectedDocForReview.folderName,
        selectedDocForReview.name,
        reviewClassification,
        reviewReason || "Manual administrative override via document repository"
      );
      if (res?.success) {
        showToast(`Updated classification to ${reviewClassification}`, "success");
        setSelectedDocForReview(null);
        setReviewReason("");
        await loadData();
      } else {
        showToast(res?.error || "Failed to update classification", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error updating classification", "error");
    } finally {
      setUpdatingClassification(false);
    }
  }

  function renderClassificationBadge(classification = "INTERNAL", confidence = 1, method = "auto_detected") {
    const tier = (classification || "INTERNAL").toUpperCase();
    const confPct = Math.round((confidence || 1) * 100);

    let badgeClasses = "bg-zinc-800 text-zinc-300 border-zinc-700";
    let dotColor = "bg-zinc-400";
    if (tier === "RESTRICTED") {
      badgeClasses = "bg-rose-500/10 text-rose-400 border-rose-500/30";
      dotColor = "bg-rose-500";
    } else if (tier === "CONFIDENTIAL") {
      badgeClasses = "bg-amber-500/10 text-amber-400 border-amber-500/30";
      dotColor = "bg-amber-400";
    } else if (tier === "INTERNAL") {
      badgeClasses = "bg-blue-500/10 text-blue-400 border-blue-500/30";
      dotColor = "bg-blue-400";
    } else if (tier === "PUBLIC") {
      badgeClasses = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      dotColor = "bg-emerald-400";
    }

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-mono font-semibold ${badgeClasses}`}
        title={`Sensitivity: ${tier} (${confPct}% confidence, ${method || "rule"})`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <span>{tier}</span>
        {confPct < 100 && (
          <span className="text-[9px] opacity-75">({confPct}%)</span>
        )}
      </span>
    );
  }

  function getFileExt(filename = "") {
    return filename.split(".").pop().toLowerCase();
  }

  function getFileIcon(filename = "") {
    const ext = getFileExt(filename);
    if (ext === "pdf") return <FilePdf size={20} className="text-rose-400" weight="duotone" />;
    if (["doc", "docx"].includes(ext)) return <FileDoc size={20} className="text-indigo-400" weight="duotone" />;
    if (["xls", "xlsx", "csv"].includes(ext)) return <FileXls size={20} className="text-emerald-400" weight="duotone" />;
    if (["js", "py", "json", "sh", "ts"].includes(ext)) return <FileCode size={20} className="text-amber-400" weight="duotone" />;
    return <FileText size={20} className="text-zinc-400" weight="duotone" />;
  }

  const totalBytes = documents.reduce((acc, doc) => acc + (doc.cachedSize || 10240), 0);
  const totalEstimatedChunks = documents.reduce(
    (acc, doc) => acc + (doc.token_count_estimate ? Math.ceil(doc.token_count_estimate / 250) : 1),
    0
  );

  const filteredDocs = documents.filter((doc) => {
    const name = (doc.title || doc.name || "").toLowerCase();
    const ext = getFileExt(doc.name || "");
    const matchesSearch = name.includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedFileType === "pdf" && ext !== "pdf") return false;
    if (selectedFileType === "docs" && !["doc", "docx", "txt", "md"].includes(ext)) return false;
    if (selectedFileType === "sheets" && !["xls", "xlsx", "csv"].includes(ext)) return false;
    if (selectedFileType === "code" && !["js", "py", "ts", "json", "sh"].includes(ext)) return false;

    if (selectedSensitivity !== "all" && (doc.classification || "INTERNAL").toUpperCase() !== selectedSensitivity) {
      return false;
    }

    return true;
  });

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
                <span className="text-sky-700 dark:text-sky-400 font-semibold">Ingestion</span>
                <span className="text-slate-400 dark:text-zinc-600">/</span>
                <span className="text-slate-800 dark:text-zinc-200">Documents</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                <Files size={24} weight="duotone" className="text-sky-600 dark:text-sky-400" />
                Confidential Document Repository
              </h1>
              <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-2xl">
                Upload, inspect, parse, and embed local files (PDF, DOCX, XLSX, CSV, TXT) into workspace vector memories with zero external cloud parsing.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                className="hidden"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.json,.pptx,.ppt"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {uploading ? (
                  <CircleNotch size={15} className="animate-spin" />
                ) : (
                  <UploadSimple size={15} weight="bold" />
                )}
                <span>{uploading ? "Parsing Document..." : "Upload Local Files"}</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] space-y-1 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-600 dark:text-zinc-400 block">Total Documents</span>
              <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">{documents.length}</div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500">100% on-premise</span>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] space-y-1 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-600 dark:text-zinc-400 block">Storage Volume</span>
              <div className="text-xl font-bold text-sky-700 dark:text-sky-400 font-mono">{humanFileSize(totalBytes)}</div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500">Local disk cache</span>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] space-y-1 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-600 dark:text-zinc-400 block">Indexed Chunks</span>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">{totalEstimatedChunks}</div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500">Semantic vectors</span>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] space-y-1 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-600 dark:text-zinc-400 block">Target Workspace</span>
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate mt-1">
                {selectedWorkspace?.name || "None Selected"}
              </div>
              <span className="text-[10px] text-sky-700 dark:text-sky-400 font-mono font-medium">Active Target</span>
            </div>
          </div>

          {/* Controls Bar: Search + Filter Chips + Target Workspace */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documents..."
                  className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-50 dark:bg-[#090a0b] border border-slate-200 dark:border-[#1f2328] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-sky-500 shadow-sm transition-colors"
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

              {/* Type Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto py-1">
                {[
                  { id: "all", label: "All Types" },
                  { id: "pdf", label: "PDF" },
                  { id: "docs", label: "Word & Text" },
                  { id: "sheets", label: "Sheets" },
                  { id: "code", label: "Code" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedFileType(tab.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                      selectedFileType === tab.id
                        ? "bg-sky-500 text-zinc-950 shadow-sm"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sensitivity Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto py-1 border-l border-slate-200 dark:border-[#1f2328] pl-2">
                {[
                  { id: "all", label: "All Tiers", color: "text-slate-600 dark:text-zinc-400" },
                  { id: "RESTRICTED", label: "Restricted", color: "text-rose-600 dark:text-rose-400" },
                  { id: "CONFIDENTIAL", label: "Confidential", color: "text-amber-600 dark:text-amber-400" },
                  { id: "INTERNAL", label: "Internal", color: "text-sky-600 dark:text-blue-400" },
                  { id: "PUBLIC", label: "Public", color: "text-emerald-600 dark:text-emerald-400" },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedSensitivity(tier.id)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                      selectedSensitivity === tier.id
                        ? "bg-sky-500 text-zinc-950 shadow-sm"
                        : `${tier.color} hover:bg-slate-100 dark:hover:bg-zinc-800`
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Workspace Picker */}
            {workspaces.length > 0 && (
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <span className="text-xs text-slate-600 dark:text-zinc-400 font-mono shrink-0">Embed Target:</span>
                <select
                  value={selectedWorkspace?.slug || ""}
                  onChange={async (e) => {
                    const ws = workspaces.find((w) => w.slug === e.target.value);
                    if (ws) {
                      setSelectedWorkspace(ws);
                      const detail = await Workspace.bySlug(ws.slug);
                      setSelectedWorkspaceDetail(detail);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] text-xs text-slate-800 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm cursor-pointer"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.slug} className="bg-white dark:bg-[#111215] text-slate-800 dark:text-white">
                      {ws.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Document Table / List */}
          <div className="rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#1f2328] flex items-center justify-between">
              <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Folder size={16} className="text-sky-600 dark:text-sky-400" weight="duotone" />
                <span>Indexed Documents ({filteredDocs.length})</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">Confidential On-Premise Storage</span>
            </div>

            {loading ? (
              <div className="py-16 text-center text-slate-500 dark:text-zinc-400 flex flex-col items-center gap-3">
                <CircleNotch size={24} className="animate-spin text-sky-600 dark:text-sky-400" />
                <span className="text-xs font-mono">Scanning local repository...</span>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <Files size={40} className="mx-auto text-slate-400 dark:text-zinc-600" weight="duotone" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">No documents found</div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  Upload confidential files to begin text chunking, local vector indexing, and evidence-grounded querying.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#1f2328] bg-slate-100/70 dark:bg-[#0d0e11] text-slate-700 dark:text-zinc-300 font-bold font-mono text-[11px]">
                      <th className="py-3 px-5 uppercase">Document</th>
                      <th className="py-3 px-4 uppercase">Namespace</th>
                      <th className="py-3 px-4 uppercase">Sensitivity</th>
                      <th className="py-3 px-4 uppercase">Est. Chunks</th>
                      <th className="py-3 px-4 uppercase">Size</th>
                      <th className="py-3 px-4 uppercase">Status</th>
                      <th className="py-3 px-5 uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1f2328]/60">
                    {filteredDocs.map((doc, idx) => {
                      const isEmbedded = (selectedWorkspaceDetail?.documents || []).some(
                        (d) =>
                          d.docpath === `${doc.folderName}/${doc.name}` ||
                          d.docpath === doc.name ||
                          d.filename === doc.name
                      );

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-[#16181d] transition-colors group">
                          <td className="py-3 px-5 font-medium text-slate-900 dark:text-white flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090a0b] border border-slate-200 dark:border-[#1f2328] shrink-0">
                              {getFileIcon(doc.name)}
                            </div>
                            <div className="truncate max-w-xs md:max-w-md">
                              <div
                                className="truncate text-xs font-semibold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors"
                                title={doc.title || doc.name || "Untitled Document"}
                              >
                                {doc.title || doc.name || "Untitled Document"}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono truncate">{doc.id}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] text-slate-700 dark:text-zinc-300 font-medium">
                              {doc.folderName}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {renderClassificationBadge(doc.classification, doc.classification_confidence, doc.classification_method)}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 font-mono">
                            {doc.token_count_estimate ? `${Math.ceil(doc.token_count_estimate / 250)} chunks` : "Parsed"}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 font-mono">
                            {humanFileSize(doc.cachedSize || 10240)}
                          </td>
                          <td className="py-3 px-4">
                            {isEmbedded ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400 font-mono text-[11px] font-bold whitespace-nowrap">
                                <CheckCircle size={12} weight="fill" />
                                <span>Embedded</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 font-mono text-[11px] font-medium whitespace-nowrap">
                                <CircleNotch size={12} />
                                <span>Available</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-5 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDocForReview(doc);
                                setReviewClassification(doc.classification || "CONFIDENTIAL");
                                setReviewReason("");
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                              title="Review or override sensitivity classification"
                            >
                              <Shield size={13} weight="duotone" />
                              <span>Review</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedDocForPreview(doc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#16181d] hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-[#1f2328] text-xs font-semibold transition-all cursor-pointer shadow-xs"
                              title="Inspect metadata"
                            >
                              <Eye size={13} />
                              <span>Preview</span>
                            </button>
                            {isEmbedded ? (
                              <>
                                <Link
                                  to={paths.workspace.chat(selectedWorkspace?.slug || workspaces[0]?.slug || "")}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                                  title="Ask questions about this document in workspace chat"
                                >
                                  <ChatCircleDots size={13} weight="fill" />
                                  <span>Chat</span>
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleUnembedFromWorkspace(doc)}
                                  disabled={embeddingDocId === doc.id}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white dark:bg-[#16181d] hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 border border-slate-200 dark:border-[#1f2328] text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                                  title={`Remove "${doc.title || doc.name}" from ${selectedWorkspace?.name || "workspace"}`}
                                >
                                  {embeddingDocId === doc.id ? (
                                    <CircleNotch size={13} className="animate-spin" />
                                  ) : (
                                    <MinusCircle size={13} />
                                  )}
                                  <span>Unembed</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleEmbedInWorkspace(doc)}
                                disabled={embeddingDocId === doc.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 border border-sky-300 dark:bg-sky-500/10 dark:hover:bg-sky-500/20 dark:text-sky-400 dark:border-sky-500/30 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                                title={`Embed into ${selectedWorkspace?.name || "workspace"} for AI RAG queries`}
                              >
                                {embeddingDocId === doc.id ? (
                                  <CircleNotch size={13} className="animate-spin" />
                                ) : (
                                  <Lightning size={13} weight="fill" />
                                )}
                                <span>Embed</span>
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteDocument(doc)}
                                disabled={deletingDocId === doc.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                                title="Delete document and remove indexed content"
                              >
                                {deletingDocId === doc.id ? (
                                  <CircleNotch size={13} className="animate-spin" />
                                ) : (
                                  <Trash size={13} />
                                )}
                                <span>Delete</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Document Preview Modal */}
      {selectedDocForPreview && (
        <Modal isOpen={!!selectedDocForPreview} onClose={() => setSelectedDocForPreview(null)} size="md">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                {getFileIcon(selectedDocForPreview.name)}
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-sm">
                  {selectedDocForPreview.title || selectedDocForPreview.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocForPreview(null)}
                className="text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-[#090a0b] p-3 rounded-xl border border-slate-200 dark:border-[#1f2328]">
                <div>
                  <span className="text-slate-500 dark:text-zinc-500 block text-[10px] uppercase font-mono">Namespace</span>
                  <span className="font-mono text-slate-800 dark:text-zinc-300">{selectedDocForPreview.folderName}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-zinc-500 block text-[10px] uppercase font-mono">Sensitivity Tier</span>
                  <div className="mt-0.5">
                    {renderClassificationBadge(
                      selectedDocForPreview.classification,
                      selectedDocForPreview.classification_confidence,
                      selectedDocForPreview.classification_method
                    )}
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-slate-500 dark:text-zinc-500 block text-[10px] uppercase font-mono">File Size</span>
                  <span className="font-mono text-slate-800 dark:text-zinc-300">{humanFileSize(selectedDocForPreview.cachedSize || 10240)}</span>
                </div>
                <div className="mt-2">
                  <span className="text-slate-500 dark:text-zinc-500 block text-[10px] uppercase font-mono">Token Estimate</span>
                  <span className="font-mono text-slate-800 dark:text-zinc-300">{selectedDocForPreview.token_count_estimate || "N/A"}</span>
                </div>
                <div className="col-span-2 mt-2">
                  <span className="text-slate-500 dark:text-zinc-500 block text-[10px] uppercase font-mono">Storage ID</span>
                  <span className="font-mono text-slate-600 dark:text-zinc-400 truncate block text-[11px]">{selectedDocForPreview.id}</span>
                </div>
              </div>

              {selectedDocForPreview.classification_reasons?.length > 0 && (
                <div className="p-3 bg-amber-500/10 dark:bg-amber-500/10 rounded-xl border border-amber-500/20">
                  <span className="text-amber-800 dark:text-amber-300 font-mono text-[10px] uppercase block mb-1">Classification Reasons</span>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-900 dark:text-amber-200 font-mono text-[11px]">
                    {selectedDocForPreview.classification_reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-slate-600 dark:text-zinc-400 text-xs leading-relaxed">
                This document is parsed and indexed in local memory. You can embed it into any target workspace vector index for retrieval-augmented generation.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    const doc = selectedDocForPreview;
                    setSelectedDocForPreview(null);
                    handleDeleteDocument(doc);
                  }}
                  className="px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer mr-auto"
                >
                  <Trash size={14} />
                  <span>Delete Document</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const doc = selectedDocForPreview;
                  setSelectedDocForPreview(null);
                  setSelectedDocForReview(doc);
                  setReviewClassification(doc.classification || "CONFIDENTIAL");
                  setReviewReason("");
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#1f2328] dark:hover:bg-[#2d3139] text-amber-700 dark:text-amber-300 border border-slate-200 dark:border-transparent rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Shield size={14} weight="duotone" />
                <span>Review Classification</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const doc = selectedDocForPreview;
                  setSelectedDocForPreview(null);
                  handleEmbedInWorkspace(doc);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Lightning size={14} weight="fill" />
                <span>Embed into {selectedWorkspace?.name || "Workspace"}</span>
              </button>
            </div>
        </Modal>
      )}

      {/* Classification Review & Policy Override Modal */}
      {selectedDocForReview && (
        <Modal isOpen={!!selectedDocForReview} onClose={() => setSelectedDocForReview(null)} size="md">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={22} className="text-amber-500 dark:text-amber-400" weight="duotone" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-sm">
                  Sensitivity Review & Policy Governance
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocForReview(null)}
                className="text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-[#090a0b] p-3.5 rounded-xl border border-slate-200 dark:border-[#1f2328] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-zinc-400 font-mono text-[11px]">Document</span>
                  <span className="font-medium text-slate-900 dark:text-white truncate max-w-[220px]">
                    {selectedDocForReview.title || selectedDocForReview.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-zinc-400 font-mono text-[11px]">Current Sensitivity</span>
                  <div>
                    {renderClassificationBadge(
                      selectedDocForReview.classification,
                      selectedDocForReview.classification_confidence,
                      selectedDocForReview.classification_method
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-zinc-400 font-mono text-[11px]">Detection Mode</span>
                  <span className="font-mono text-slate-800 dark:text-zinc-300 capitalize">
                    {selectedDocForReview.classification_method || "Deterministic Rule Engine"}
                  </span>
                </div>
                {selectedDocForReview.classification_reasons?.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-zinc-800/60">
                    <span className="text-slate-500 dark:text-zinc-400 font-mono text-[10px] uppercase block mb-1">Matched Indicators</span>
                    <ul className="list-disc list-inside space-y-1 text-amber-800 dark:text-amber-300/90 font-mono text-[11px]">
                      {selectedDocForReview.classification_reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Policy Implication Banner */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300/90 text-[11px] leading-relaxed">
                <strong>Policy Enforcement Notice:</strong> Assigning <em>RESTRICTED</em> or <em>CONFIDENTIAL</em> strictly denies egress to external cloud LLMs, blocks unapproved network tools, and mandates sovereign on-premise execution.
              </div>

              {/* Override Form */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-slate-800 dark:text-zinc-300 font-semibold mb-1.5">
                    Assign Sensitivity Tier:
                  </label>
                  <select
                    value={reviewClassification}
                    onChange={(e) => setReviewClassification(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#090a0b] border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PUBLIC">PUBLIC — Unrestricted, suitable for general distribution</option>
                    <option value="INTERNAL">INTERNAL — Standard operational docs, local team access</option>
                    <option value="CONFIDENTIAL">CONFIDENTIAL — Proprietary IP, sovereign models only</option>
                    <option value="RESTRICTED">RESTRICTED — Highly sensitive / ITAR / keys, maximum isolation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-800 dark:text-zinc-300 font-semibold mb-1.5">
                    Override Justification (Required for Audit):
                  </label>
                  <input
                    type="text"
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    placeholder="e.g., Verified document contents, reclassified after security audit"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#090a0b] border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-zinc-500 mt-1">
                    All classification overrides are logged to the immutable security audit ledger.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setSelectedDocForReview(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-transparent rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveClassificationOverride}
                disabled={updatingClassification}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {updatingClassification ? (
                  <CircleNotch size={14} className="animate-spin" />
                ) : (
                  <ShieldCheck size={14} weight="bold" />
                )}
                <span>Save & Apply Policy</span>
              </button>
            </div>
        </Modal>
      )}
    </div>
  );
}
