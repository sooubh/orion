import { useState } from "react";
import { isMobile } from "react-device-detect";
import { useTranslation } from "react-i18next";
import { X } from "@phosphor-icons/react";
import {
  combineLikeSources,
  CitationDetailModal,
} from "../ChatHistory/Citation";
import MobileCitationModal from "./MobileCitationModal";
import SourceItem from "./SourceItem";
import ChatSidebar, { useSourcesSidebar } from "../ChatSidebar";

// Re-export for backward compat with existing imports
export { useSourcesSidebar } from "../ChatSidebar";

export default function SourcesSidebar() {
  const { sources, sidebarOpen, closeSidebar } = useSourcesSidebar();
  const { t } = useTranslation();
  const [selectedSource, setSelectedSource] = useState(null);

  const combined = combineLikeSources(sources);

  if (isMobile) {
    return (
      <MobileCitationModal
        sources={sources}
        isOpen={sidebarOpen}
        selectedSource={selectedSource}
        setSelectedSource={setSelectedSource}
        onClose={() => {
          setSelectedSource(null);
          closeSidebar();
        }}
      />
    );
  }

  return (
    <>
      <ChatSidebar isOpen={sidebarOpen}>
        <div
          className="ml-4 w-[350px] bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] md:rounded-[16px] p-4 flex flex-col gap-4 overflow-hidden mt-[72px] shadow-xl"
          style={{ maxHeight: "calc(100% - 88px)" }}
        >
          <div className="flex items-start justify-between">
            <p className="font-semibold text-base leading-6 text-slate-900 dark:text-white">
              {t("chat_window.sources")}
            </p>
            <button
              onClick={closeSidebar}
              type="button"
              className="text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white transition-colors border-none bg-transparent cursor-pointer p-1"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto no-scroll">
            {combined.map((source, idx) => (
              <SourceItem
                key={source.title || idx}
                source={source}
                onClick={() => setSelectedSource(source)}
              />
            ))}
          </div>
        </div>
      </ChatSidebar>
      {selectedSource && (
        <CitationDetailModal
          source={selectedSource}
          onClose={() => setSelectedSource(null)}
        />
      )}
    </>
  );
}
