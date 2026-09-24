import { Plus } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "react-tooltip";
import { useMemoriesContext, LIMITS } from "../MemoriesContext";

export default function MemoryTabs() {
  const { workspace, activeTab, setActiveTab, memories, openCreateModal } =
    useMemoriesContext();
  const { t } = useTranslation();
  const workspaceName =
    workspace?.name || t("chat_window.memories.tab_workspace");
  const workspaceCount = memories.workspace.length;
  const globalCount = memories.global.length;
  const atLimit =
    activeTab === "workspace"
      ? workspaceCount >= LIMITS.workspace
      : globalCount >= LIMITS.global;

  return (
    <div className="flex items-center justify-between shrink-0 gap-2">
      <div className="flex items-center gap-1 min-w-0">
        <button
          type="button"
          onClick={() => setActiveTab("workspace")}
          data-tooltip-id="memories-workspace-pill"
          data-tooltip-content={workspaceName}
          className={`flex items-center gap-0.5 h-6 px-3 rounded-full border-none cursor-pointer text-xs font-semibold uppercase tracking-[1.2px] whitespace-nowrap transition-colors min-w-0 shrink ${
            activeTab === "workspace"
              ? "bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-white"
              : "bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800/50 text-slate-600 dark:text-zinc-400"
          }`}
        >
          <span className="truncate max-w-[140px]">
            {workspaceName}
          </span>
          <span className="text-slate-500 dark:text-zinc-500 font-normal">
            ({workspaceCount}/{LIMITS.workspace})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("global")}
          className={`flex items-center gap-0.5 h-6 px-3 rounded-full border-none cursor-pointer text-xs font-semibold uppercase tracking-[1.2px] whitespace-nowrap transition-colors shrink-0 ${
            activeTab === "global"
              ? "bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-white"
              : "bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800/50 text-slate-600 dark:text-zinc-400"
          }`}
        >
          <span className="truncate max-w-[120px] inline-block">
            {t("chat_window.memories.tab_global")}
          </span>
          <span className="text-slate-500 dark:text-zinc-500 font-normal">
            ({globalCount}/{LIMITS.global})
          </span>
        </button>
      </div>
      <button
        type="button"
        onClick={openCreateModal}
        disabled={atLimit}
        className="-mr-1 flex items-center justify-center size-6 rounded-lg border-none bg-transparent cursor-pointer text-slate-700 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <Plus size={16} weight="bold" />
      </button>
      <Tooltip
        id="memories-workspace-pill"
        place="bottom"
        delayShow={800}
        className="tooltip !text-xs z-99"
      />
    </div>
  );
}
