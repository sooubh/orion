import { useState, useRef, useEffect } from "react";
import { SlidersHorizontal } from "@phosphor-icons/react";
import useLoginMode from "@/hooks/useLoginMode";
import TextSizeRow from "./TextSize";
import MemoriesRow from "./Memories";
import CopyLinkToChatRow from "./CopyLinkToChat";
import ExportRow from "./Export";

export default function ChatSettingsMenu({
  history = [],
  workspace = null,
  threadSlug = null,
}) {
  const mode = useLoginMode();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;
    function handleClickOutside(e) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const hasUserIcon = mode !== null;

  return (
    <div
      className={`absolute top-3 md:top-5 z-30 ${hasUserIcon ? "right-[55px] md:right-[67px]" : "right-4 md:right-6"}`}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className={`group border cursor-pointer flex items-center justify-center w-[35px] h-[35px] rounded-full transition-all shadow-xs ${
          showMenu
            ? "bg-slate-200 dark:bg-zinc-700 text-slate-900 dark:text-white border-slate-300 dark:border-zinc-600"
            : "bg-white dark:bg-[#111215] hover:bg-slate-100 dark:hover:bg-[#1f2328] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-[#1f2328]"
        }`}
      >
        <SlidersHorizontal
          size={18}
          className="text-slate-700 dark:text-zinc-300"
        />
      </button>

      {showMenu && (
        <div
          ref={menuRef}
          className="absolute right-0 top-[42px] bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] rounded-xl p-3.5 w-[226px] flex flex-col gap-1.5 shadow-xl"
        >
          <TextSizeRow />
          <MemoriesRow onClose={() => setShowMenu(false)} />
          <ExportRow
            history={history}
            workspace={workspace}
            threadSlug={threadSlug}
            onClose={() => setShowMenu(false)}
          />
          <CopyLinkToChatRow />
        </div>
      )}
    </div>
  );
}
