import React, { useEffect, useState, useRef } from "react";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import { isMobile } from "react-device-detect";
import {
  Files,
  UploadSimple,
  Trash,
  FolderPlus,
  CheckCircle,
  FileText,
  FilePdf,
  FileDoc,
  FileXls,
  FileCode,
  MagnifyingGlass,
  ArrowSquareOut,
  Lightning,
  Sparkle,
  X,
  CircleNotch,
  Folder,
} from "@phosphor-icons/react";
import System from "@/models/system";
import Workspace from "@/models/workspace";
import showToast from "@/utils/toast";
import { humanFileSize } from "@/utils/numbers";
import Modal, { ModalHeader, ModalBody, ModalFooter } from "@/components/lib/Modal";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocForPreview, setSelectedDocForPreview] = useState(null);
  const [embeddingDocId, setEmbeddingDocId] = useState(null);
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
        filesData.items.forEach((folder) => {
          if (folder.items) {
            folder.items.forEach((doc) => {
              flatDocs.push({
                ...doc,
                folderName: folder.name,
              });
            });
          }
        });
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

    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append(`file${i}`, files[i]);
      }

      const response = await System.uploadDocument(formData);
      if (response?.success) {
        showToast("Files uploaded and parsed successfully", "success");
        await loadData();
      } else {
        showToast(response?.error || "Failed to upload files", "error");
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

  function getFileIcon(filename = "") {
    const ext = filename.split(".").pop().toLowerCase();
    if (ext === "pdf") return <FilePdf size={20} className="text-rose-400" weight="duotone" />;
    if (["doc", "docx"].includes(ext)) return <FileDoc size={20} className="text-sky-400" weight="duotone" />;
    if (["xls", "xlsx", "csv"].includes(ext)) return <FileXls size={20} className="text-emerald-400" weight="duotone" />;
    if (["js", "py", "json", "sh", "ts"].includes(ext)) return <FileCode size={20} className="text-sky-400" weight="duotone" />;
    return <FileText size={20} className="text-zinc-400" weight="duotone" />;
  }

  const filteredDocs = documents.filter((doc) => {
    const name = (doc.title || doc.name || "").toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#090a0b] text-[#f4f4f5] flex font-sans">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}

      <main className="flex-1 h-full overflow-y-auto bg-[#090a0b] p-6 md:p-10 pt-16 md:pt-10">
        <div className="max-w-6xl mx-auto space-y-8 pb-16">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1f2328] pb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="sovereign-badge sovereign-badge-sky font-mono">
                  LOCAL DOCUMENT INGESTION
                </span>
                <span className="text-xs text-zinc-500 font-mono">Zero Cloud Parsing</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Confidential Document Repository
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                Upload, inspect, parse, and embed local files (PDF, DOCX, XLSX, PPTX, CSV, TXT) into workspace vector memories.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                className="hidden"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.json,.pptx,.ppt"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-extrabold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {uploading ? <CircleNotch size={16} className="animate-spin" /> : <UploadSimple size={16} weight="bold" />}
                <span>{uploading ? "Parsing Document..." : "Upload & Ingest Local File"}</span>
              </button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <MagnifyingGlass size={16} className="absolute left-3.5 top-3.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter documents by name or keyword..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#111215] border border-[#1f2328] text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            {workspaces.length > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-zinc-400 font-mono flex-shrink-0">Target Workspace:</span>
                <select
                  value={selectedWorkspace?.slug || ""}
                  onChange={(e) => {
                    const ws = workspaces.find((w) => w.slug === e.target.value);
                    if (ws) setSelectedWorkspace(ws);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-[#111215] border border-[#1f2328] text-xs text-zinc-200 focus:outline-none focus:border-sky-500 transition-colors"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.slug}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Document Table / List */}
          <div className="sovereign-card rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-[#1f2328] flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-2">
                <Folder size={18} className="text-sky-400" weight="duotone" />
                Indexed Local Storage Documents ({filteredDocs.length})
              </h2>
              <span className="text-xs text-zinc-500 font-mono">100% On-Premise Storage</span>
            </div>

            {loading ? (
              <div className="py-16 text-center text-zinc-500 flex flex-col items-center gap-3">
                <CircleNotch size={28} className="animate-spin text-sky-400" />
                <span className="text-xs font-mono">Scanning local document storage...</span>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <Files size={44} className="mx-auto text-zinc-600" weight="duotone" />
                <div className="text-sm font-bold text-zinc-300">No documents found</div>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                  Upload confidential files to begin text chunking, local vector indexing, and evidence-grounded querying.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#1f2328] text-zinc-400 font-mono">
                      <th className="py-3.5 px-6 font-semibold uppercase">Document</th>
                      <th className="py-3.5 px-4 font-semibold uppercase">Folder / Namespace</th>
                      <th className="py-3.5 px-4 font-semibold uppercase">Chunks</th>
                      <th className="py-3.5 px-4 font-semibold uppercase">Size</th>
                      <th className="py-3.5 px-6 font-semibold uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f2328]">
                    {filteredDocs.map((doc, idx) => (
                      <tr key={idx} className="hover:bg-[#18191d] transition-colors group">
                        <td className="py-3.5 px-6 font-semibold text-white flex items-center gap-3">
                          {getFileIcon(doc.name)}
                          <div className="truncate max-w-xs md:max-w-md">
                            <div className="truncate text-xs font-semibold">{doc.title || doc.name}</div>
                            <div className="text-[10px] text-zinc-500 font-mono truncate">{doc.id}</div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400 font-mono">
                          {doc.folderName}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400 font-mono">
                          {doc.token_count_estimate ? `${Math.ceil(doc.token_count_estimate / 250)} chunks` : "Parsed"}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400 font-mono">
                          {humanFileSize(doc.cachedSize || 10240)}
                        </td>
                        <td className="py-3.5 px-6 text-right space-x-2">
                          <button
                            onClick={() => handleEmbedInWorkspace(doc)}
                            disabled={embeddingDocId === doc.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-bold transition-all disabled:opacity-50"
                          >
                            {embeddingDocId === doc.id ? (
                              <CircleNotch size={14} className="animate-spin" />
                            ) : (
                              <Lightning size={14} weight="fill" />
                            )}
                            <span>Embed</span>
                          </button>
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
