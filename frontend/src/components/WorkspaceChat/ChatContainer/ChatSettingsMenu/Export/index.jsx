import { useState } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { saveAs } from "file-saver";
import Workspace from "@/models/workspace";
import showToast from "@/utils/toast";
import moment from "moment";

const EXPORT_FORMATS = [
  { key: "pdf", label: "PDF", ext: "pdf" },
  { key: "markdown", label: "Markdown", ext: "md" },
  { key: "plaintext", label: "Plain Text", ext: "txt" },
  { key: "json", label: "JSON", ext: "json" },
  { key: "html", label: "HTML", ext: "html" },
];

export default function ExportRow({
  history = [],
  workspace = null,
  threadSlug = null,
  onClose,
}) {
  const { t } = useTranslation();
  const [showSubmenu, setShowSubmenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExport(format) {
    if (exporting || !workspace?.slug) return;
    setExporting(true);
    const blob = await Workspace.exportChatsToType(
      workspace.slug,
      threadSlug,
      format.key
    );
    if (blob) {
      const stamp = moment().format("YYYY-MM-DD HH:mm:ss");
      saveAs(blob, `Orion Export - ${stamp}.${format.ext}`);
    } else {
      showToast("Failed to export chat.", "error");
    }
    setExporting(false);
    onClose();
  }

  if (history.length === 0) return null;
  return (
    <div
      className="relative"
      onMouseEnter={() => setShowSubmenu(true)}
      onMouseLeave={() => setShowSubmenu(false)}
    >
      <div
        className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
          showSubmenu
            ? "bg-slate-100 dark:bg-[#1f2328] text-slate-900 dark:text-white"
            : "hover:bg-slate-50 dark:hover:bg-[#16181d] text-slate-700 dark:text-zinc-300"
        }`}
      >
        <span className="text-sm font-medium">
          {exporting ? t("chat_window.exporting") : t("chat_window.export")}
        </span>
        <CaretRight
          size={14}
          weight="bold"
          className="text-slate-500 dark:text-zinc-400"
        />
      </div>
      {showSubmenu && (
        <ExportSubmenu onSelect={handleExport} exporting={exporting} />
      )}
    </div>
  );
}

function ExportSubmenu({ onSelect, exporting }) {
  return (
    <div className="absolute right-full top-0 -mr-2 pr-2 pt-0">
      <div className="bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] rounded-xl p-2.5 w-[140px] flex flex-col gap-1 shadow-xl">
        {EXPORT_FORMATS.map((format) => (
          <div
            key={format.key}
            onClick={() => !exporting && onSelect(format)}
            className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              exporting
                ? "opacity-50 cursor-not-allowed"
                : "cursor-pointer hover:bg-slate-50 dark:hover:bg-[#16181d] text-slate-700 dark:text-zinc-300"
            }`}
          >
            {format.label}
          </div>
        ))}
      </div>
    </div>
  );
}
