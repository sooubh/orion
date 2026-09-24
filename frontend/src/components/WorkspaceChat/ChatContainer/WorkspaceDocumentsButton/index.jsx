import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import paths from "@/utils/paths";
import {
  Files,
  UploadSimple,
  Trash,
  X,
  FileText,
  FilePdf,
  FileDoc,
  FileXls,
  CheckCircle,
  FolderOpen,
  CircleNotch,
} from "@phosphor-icons/react";
import Workspace from "@/models/workspace";
import showToast from "@/utils/toast";

export default function WorkspaceDocumentsButton({ workspace, onWorkspaceUpdated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [documents, setDocuments] = useState(workspace?.documents || []);
  const [unembeddingDocId, setUnembeddingDocId] = useState(null);
  const popoverRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    setDocuments(workspace?.documents || []);
  }, [workspace?.documents]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  async function handleUnembed(doc) {
    if (!workspace?.slug) return;
    setUnembeddingDocId(doc.id);
    try {
      const docPath = doc.docpath || doc.filename;
      const res = await Workspace.modifyEmbeddings(workspace.slug, {
        adds: [],
        deletes: [docPath],
      });
      if (res?.workspace) {
        showToast(`Removed "${doc.filename}" from workspace knowledge`, "success");
        setDocuments(res.workspace.documents || []);
        if (onWorkspaceUpdated) onWorkspaceUpdated(res.workspace);
      } else {
        showToast("Failed to remove document from workspace", "error");
      }
    } catch (err) {
      console.error("Unembedding error:", err);
      showToast("Error removing document", "error");
    } finally {
      setUnembeddingDocId(null);
    }
  }

  function getFileIcon(filename = "") {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return <FilePdf size={16} className="text-rose-400 shrink-0" />;
      case "docx":
      case "doc":
        return <FileDoc size={16} className="text-blue-400 shrink-0" />;
      case "xlsx":
      case "xls":
      case "csv":
        return <FileXls size={16} className="text-emerald-400 shrink-0" />;
      default:
        return <FileText size={16} className="text-zinc-400 shrink-0" />;
    }
  }

  const docCount = documents.length;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`group border cursor-pointer px-3 py-1.5 flex items-center gap-1.5 rounded-full transition-all text-xs font-semibold shadow-xs ${
          isOpen
            ? "bg-slate-200 dark:bg-zinc-700 text-slate-900 dark:text-white border-slate-300 dark:border-zinc-600"
            : "bg-white dark:bg-[#111215] hover:bg-slate-100 dark:hover:bg-[#1f2328] text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-[#1f2328]"
        }`}
        title="View and manage documents active in this workspace"
      >
        <Files
          size={14}
          weight={docCount > 0 ? "fill" : "regular"}
          className={docCount > 0 ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400 dark:text-zinc-500"}
        />
        <span>
          {docCount} {docCount === 1 ? "Document" : "Documents"}
        </span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-[40px] z-50 w-[360px] bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] rounded-2xl shadow-2xl p-4 flex flex-col gap-3 text-left overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1f2328] pb-2.5">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Files size={15} className="text-emerald-500 dark:text-emerald-400" weight="fill" />
                <span>Workspace Knowledge</span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                {docCount} active for sovereign RAG queries
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* Document list */}
          <div className="max-h-[240px] overflow-y-auto space-y-2 pr-1 no-scroll">
            {docCount === 0 ? (
              <div className="py-6 text-center text-slate-500 dark:text-zinc-400 space-y-2">
                <Files size={32} className="mx-auto text-slate-400 dark:text-zinc-600" weight="duotone" />
                <p className="text-xs font-medium text-slate-800 dark:text-zinc-200">
                  No documents in this workspace
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 max-w-[260px] mx-auto leading-relaxed">
                  Upload or embed documents to enable evidence-based AI reasoning and factual recall.
                </p>
              </div>
            ) : (
              documents.map((doc, idx) => (
                <div
                  key={doc.id || idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-[#090a0b] border border-slate-200 dark:border-[#1f2328] hover:border-slate-300 dark:hover:border-zinc-700 transition-all text-xs group"
                >
                  <div className="flex items-center gap-2 truncate mr-2">
                    {getFileIcon(doc.filename)}
                    <div className="truncate">
                      <div className="font-medium text-slate-900 dark:text-white truncate" title={doc.filename}>
                        {doc.filename}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono flex items-center gap-1">
                        <CheckCircle size={10} weight="fill" className="text-emerald-500 dark:text-emerald-400" />
                        <span>Vectorized</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnembed(doc)}
                    disabled={unembeddingDocId === doc.id}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                    title={`Unembed "${doc.filename}" from this workspace`}
                  >
                    {unembeddingDocId === doc.id ? (
                      <CircleNotch size={14} className="animate-spin text-rose-500 dark:text-rose-400" />
                    ) : (
                      <Trash size={14} />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-200 dark:border-[#1f2328] pt-3 flex items-center justify-between gap-2">
            <Link
              to={paths.documents()}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 text-xs font-medium transition-all"
            >
              <FolderOpen size={13} weight="duotone" />
              <span>All Documents</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                document.getElementById("dnd-chat-file-uploader")?.click();
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer shadow-xs"
            >
              <UploadSimple size={13} />
              <span>Upload & Embed</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
