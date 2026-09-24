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
        className={`group border-none cursor-pointer px-3 py-1.5 flex items-center gap-1.5 rounded-full transition-all text-xs font-medium shadow-sm ${
          isOpen
            ? "bg-zinc-700 light:bg-slate-300 text-white light:text-slate-900"
            : "bg-zinc-800/80 hover:bg-zinc-700 light:bg-slate-200 light:hover:bg-slate-300 text-zinc-300 hover:text-white light:text-slate-700 border border-zinc-700/60 light:border-slate-300"
        }`}
        title="View and manage documents active in this workspace"
      >
        <Files
          size={14}
          weight={docCount > 0 ? "fill" : "regular"}
          className={docCount > 0 ? "text-emerald-400" : "text-zinc-500"}
        />
        <span>
          {docCount} {docCount === 1 ? "Document" : "Documents"}
        </span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-[40px] z-50 w-[360px] bg-zinc-900 light:bg-white border border-zinc-700/80 light:border-slate-300 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 text-left overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 light:border-slate-200 pb-2.5">
            <div>
              <h4 className="text-xs font-bold text-white light:text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Files size={15} className="text-emerald-400" weight="fill" />
                <span>Workspace Knowledge</span>
              </h4>
              <p className="text-[11px] text-zinc-400 light:text-slate-500 font-mono mt-0.5">
                {docCount} active for sovereign RAG queries
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-white light:text-slate-500 light:hover:text-slate-900 p-1 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Document list */}
          <div className="max-h-[240px] overflow-y-auto space-y-2 pr-1 no-scroll">
            {docCount === 0 ? (
              <div className="py-6 text-center text-zinc-500 light:text-slate-400 space-y-2">
                <Files size={32} className="mx-auto text-zinc-600 light:text-slate-400" weight="duotone" />
                <p className="text-xs font-medium text-zinc-300 light:text-slate-700">
                  No documents in this workspace
                </p>
                <p className="text-[11px] text-zinc-500 light:text-slate-500 max-w-[260px] mx-auto leading-relaxed">
                  Upload or embed documents to enable evidence-based AI reasoning and factual recall.
                </p>
              </div>
            ) : (
              documents.map((doc, idx) => (
                <div
                  key={doc.id || idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-zinc-800/60 light:bg-slate-50 border border-zinc-700/50 light:border-slate-200 hover:border-zinc-600 transition-all text-xs group"
                >
                  <div className="flex items-center gap-2 truncate mr-2">
                    {getFileIcon(doc.filename)}
                    <div className="truncate">
                      <div className="font-medium text-white light:text-slate-800 truncate" title={doc.filename}>
                        {doc.filename}
                      </div>
                      <div className="text-[10px] text-zinc-500 light:text-slate-400 font-mono flex items-center gap-1">
                        <CheckCircle size={10} weight="fill" className="text-emerald-400" />
                        <span>Vectorized</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnembed(doc)}
                    disabled={unembeddingDocId === doc.id}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 disabled:opacity-50"
                    title={`Unembed "${doc.filename}" from this workspace`}
                  >
                    {unembeddingDocId === doc.id ? (
                      <CircleNotch size={14} className="animate-spin text-rose-400" />
                    ) : (
                      <Trash size={14} />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-zinc-800 light:border-slate-200 pt-3 flex items-center justify-between gap-2">
            <Link
              to={paths.documents()}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 light:bg-slate-100 light:hover:bg-slate-200 text-zinc-300 hover:text-white light:text-slate-700 border border-zinc-700/60 light:border-slate-300 text-xs font-medium transition-all"
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
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/30 text-xs font-semibold transition-all cursor-pointer"
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
