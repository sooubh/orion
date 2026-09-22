import React, { useEffect, useState, useRef } from "react";
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
      if (wsList?.length > 0 && !selectedWorkspace) {
        setSelectedWorkspace(wsList[0]);
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
        } else {
          errors.push(data?.error || `Failed to upload ${file.name}`);
        }
      }

      if (successCount > 0) {
        showToast(
          `Successfully uploaded and parsed ${successCount} file${successCount > 1 ? "s" : ""}`,
          "success"
        );
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
                <span className="text-indigo-400">Ingestion</span>
                <span>/</span>
                <span className="text-zinc-200">Documents</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <Files size={24} weight="duotone" className="text-indigo-400" />
                Confidential Document Repository
              </h1>
              <p className="text-xs text-zinc-400 max-w-2xl">
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
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
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
            <div className="p-4 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-1">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Total Documents</span>
              <div className="text-xl font-bold text-white font-mono">{documents.length}</div>
              <span className="text-[10px] text-zinc-500">100% on-premise</span>
            </div>
            <div className="p-4 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-1">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Storage Volume</span>
              <div className="text-xl font-bold text-indigo-400 font-mono">{humanFileSize(totalBytes)}</div>
              <span className="text-[10px] text-zinc-500">Local disk cache</span>
            </div>
            <div className="p-4 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-1">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Indexed Chunks</span>
              <div className="text-xl font-bold text-emerald-400 font-mono">{totalEstimatedChunks}</div>
              <span className="text-[10px] text-zinc-500">Semantic vectors</span>
            </div>
            <div className="p-4 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-1">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Target Workspace</span>
              <div className="text-xs font-semibold text-white truncate mt-1">
                {selectedWorkspace?.name || "None Selected"}
              </div>
              <span className="text-[10px] text-indigo-400/80 font-mono">Active Target</span>
            </div>
          </div>

          {/* Controls Bar: Search + Filter Chips + Target Workspace */}
          <div className="p-4 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documents..."
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      selectedFileType === tab.id
                        ? "bg-indigo-600 text-white"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sensitivity Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto py-1 border-l border-zinc-700/50 pl-2">
                {[
                  { id: "all", label: "All Tiers" },
                  { id: "RESTRICTED", label: "Restricted", color: "text-rose-400" },
                  { id: "CONFIDENTIAL", label: "Confidential", color: "text-amber-400" },
                  { id: "INTERNAL", label: "Internal", color: "text-blue-400" },
                  { id: "PUBLIC", label: "Public", color: "text-emerald-400" },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedSensitivity(tier.id)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                      selectedSensitivity === tier.id
                        ? "bg-zinc-200 text-zinc-900 font-bold shadow-sm"
                        : `${tier.color || "text-zinc-400"} hover:bg-zinc-800/60`
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
                <span className="text-xs text-zinc-400 font-mono shrink-0">Embed Target:</span>
                <select
                  value={selectedWorkspace?.slug || ""}
                  onChange={(e) => {
                    const ws = workspaces.find((w) => w.slug === e.target.value);
                    if (ws) setSelectedWorkspace(ws);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700/60 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.slug} className="bg-zinc-900 text-white">
                      {ws.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Document Table / List */}
          <div className="rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 overflow-hidden shadow-xl">
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <Folder size={16} className="text-indigo-400" weight="duotone" />
                <span>Indexed Documents ({filteredDocs.length})</span>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">Confidential On-Premise Storage</span>
            </div>

            {loading ? (
              <div className="py-16 text-center text-zinc-400 flex flex-col items-center gap-3">
                <CircleNotch size={24} className="animate-spin text-indigo-400" />
                <span className="text-xs font-mono">Scanning local repository...</span>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <Files size={40} className="mx-auto text-zinc-600" weight="duotone" />
                <div className="text-sm font-semibold text-zinc-300">No documents found</div>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                  Upload confidential files to begin text chunking, local vector indexing, and evidence-grounded querying.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-zinc-400 font-mono text-[11px]">
                      <th className="py-3 px-5 font-semibold uppercase">Document</th>
                      <th className="py-3 px-4 font-semibold uppercase">Namespace</th>
                      <th className="py-3 px-4 font-semibold uppercase">Sensitivity</th>
                      <th className="py-3 px-4 font-semibold uppercase">Est. Chunks</th>
                      <th className="py-3 px-4 font-semibold uppercase">Size</th>
                      <th className="py-3 px-5 font-semibold uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredDocs.map((doc, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/40 transition-colors group">
                        <td className="py-3 px-5 font-medium text-white flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-700/60 shrink-0">
                            {getFileIcon(doc.name)}
                          </div>
                          <div className="truncate max-w-xs md:max-w-md">
                            <div className="truncate text-xs font-medium group-hover:text-indigo-300 transition-colors">
                              {doc.title || doc.name}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono truncate">{doc.id}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-zinc-400 font-mono">
                          <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300">
                            {doc.folderName}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {renderClassificationBadge(doc.classification, doc.classification_confidence, doc.classification_method)}
                        </td>
                        <td className="py-3 px-4 text-zinc-400 font-mono">
                          {doc.token_count_estimate ? `${Math.ceil(doc.token_count_estimate / 250)} chunks` : "Parsed"}
                        </td>
                        <td className="py-3 px-4 text-zinc-400 font-mono">
                          {humanFileSize(doc.cachedSize || 10240)}
                        </td>
                        <td className="py-3 px-5 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDocForReview(doc);
                              setReviewClassification(doc.classification || "CONFIDENTIAL");
                              setReviewReason("");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-500/30 text-xs font-medium transition-all cursor-pointer"
                            title="Review or override sensitivity classification"
                          >
                            <Shield size={13} weight="duotone" />
                            <span>Review</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedDocForPreview(doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 text-xs font-medium transition-all cursor-pointer"
                            title="Inspect metadata"
                          >
                            <Eye size={13} />
                            <span>Preview</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEmbedInWorkspace(doc)}
                            disabled={embeddingDocId === doc.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {embeddingDocId === doc.id ? (
                              <CircleNotch size={13} className="animate-spin" />
                            ) : (
                              <Lightning size={13} weight="fill" />
                            )}
                            <span>Embed</span>
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(doc)}
                              disabled={deletingDocId === doc.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
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
                    ))}
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
          <div className="p-6 space-y-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-white">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                {getFileIcon(selectedDocForPreview.name)}
                <h3 className="text-sm font-bold truncate max-w-sm">
                  {selectedDocForPreview.title || selectedDocForPreview.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocForPreview(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase font-mono">Namespace</span>
                  <span className="font-mono text-zinc-300">{selectedDocForPreview.folderName}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase font-mono">Sensitivity Tier</span>
                  <div className="mt-0.5">
                    {renderClassificationBadge(
                      selectedDocForPreview.classification,
                      selectedDocForPreview.classification_confidence,
                      selectedDocForPreview.classification_method
                    )}
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-zinc-500 block text-[10px] uppercase font-mono">File Size</span>
                  <span className="font-mono text-zinc-300">{humanFileSize(selectedDocForPreview.cachedSize || 10240)}</span>
                </div>
                <div className="mt-2">
                  <span className="text-zinc-500 block text-[10px] uppercase font-mono">Token Estimate</span>
                  <span className="font-mono text-zinc-300">{selectedDocForPreview.token_count_estimate || "N/A"}</span>
                </div>
                <div className="col-span-2 mt-2">
                  <span className="text-zinc-500 block text-[10px] uppercase font-mono">Storage ID</span>
                  <span className="font-mono text-zinc-400 truncate block text-[11px]">{selectedDocForPreview.id}</span>
                </div>
              </div>

              {selectedDocForPreview.classification_reasons?.length > 0 && (
                <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800/80">
                  <span className="text-zinc-400 font-mono text-[10px] uppercase block mb-1">Classification Reasons</span>
                  <ul className="list-disc list-inside space-y-0.5 text-zinc-300 font-mono text-[11px]">
                    {selectedDocForPreview.classification_reasons.map((r, i) => (
                      <li key={i} className="text-amber-300/80">{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-zinc-400 text-xs leading-relaxed">
                This document is parsed and indexed in local memory. You can embed it into any target workspace vector index for retrieval-augmented generation.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    const doc = selectedDocForPreview;
                    setSelectedDocForPreview(null);
                    handleDeleteDocument(doc);
                  }}
                  className="px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer mr-auto"
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
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
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
          </div>
        </Modal>
      )}

      {/* Classification Review & Policy Override Modal */}
      {selectedDocForReview && (
        <Modal isOpen={!!selectedDocForReview} onClose={() => setSelectedDocForReview(null)} size="md">
          <div className="p-6 space-y-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-white">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={22} className="text-amber-400" weight="duotone" />
                <h3 className="text-sm font-bold truncate max-w-sm">
                  Sensitivity Review & Policy Governance
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocForReview(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-zinc-950/70 p-3.5 rounded-xl border border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-mono text-[11px]">Document</span>
                  <span className="font-medium text-white truncate max-w-[220px]">
                    {selectedDocForReview.title || selectedDocForReview.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-mono text-[11px]">Current Sensitivity</span>
                  <div>
                    {renderClassificationBadge(
                      selectedDocForReview.classification,
                      selectedDocForReview.classification_confidence,
                      selectedDocForReview.classification_method
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-mono text-[11px]">Detection Mode</span>
                  <span className="font-mono text-zinc-300 capitalize">
                    {selectedDocForReview.classification_method || "Deterministic Rule Engine"}
                  </span>
                </div>
                {selectedDocForReview.classification_reasons?.length > 0 && (
                  <div className="pt-2 border-t border-zinc-800/60">
                    <span className="text-zinc-400 font-mono text-[10px] uppercase block mb-1">Matched Indicators</span>
                    <ul className="list-disc list-inside space-y-1 text-zinc-300 font-mono text-[11px]">
                      {selectedDocForReview.classification_reasons.map((r, i) => (
                        <li key={i} className="text-amber-300/90">{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Policy Implication Banner */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300/90 text-[11px] leading-relaxed">
                <strong>Policy Enforcement Notice:</strong> Assigning <em>RESTRICTED</em> or <em>CONFIDENTIAL</em> strictly denies egress to external cloud LLMs, blocks unapproved network tools, and mandates sovereign on-premise execution.
              </div>

              {/* Override Form */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1.5">
                    Assign Sensitivity Tier:
                  </label>
                  <select
                    value={reviewClassification}
                    onChange={(e) => setReviewClassification(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PUBLIC">PUBLIC — Unrestricted, suitable for general distribution</option>
                    <option value="INTERNAL">INTERNAL — Standard operational docs, local team access</option>
                    <option value="CONFIDENTIAL">CONFIDENTIAL — Proprietary IP, sovereign models only</option>
                    <option value="RESTRICTED">RESTRICTED — Highly sensitive / ITAR / keys, maximum isolation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1.5">
                    Override Justification (Required for Audit):
                  </label>
                  <input
                    type="text"
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    placeholder="e.g., Verified document contents, reclassified after security audit"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    All classification overrides are logged to the immutable security audit ledger.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setSelectedDocForReview(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
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
          </div>
        </Modal>
      )}
    </div>
  );
}
