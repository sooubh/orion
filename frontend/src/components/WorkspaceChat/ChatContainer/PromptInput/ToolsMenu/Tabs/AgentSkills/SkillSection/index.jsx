import { useRef, useEffect } from "react";
import { CaretDown } from "@phosphor-icons/react";

export default function SkillSection({
  name,
  expanded,
  onToggle,
  enabledCount,
  totalCount,
  isMcp = false,
  indented = false,
  highlighted = false,
  children,
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  let headerClasses =
    "border-none bg-transparent w-full flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors";
  if (highlighted) headerClasses += " bg-slate-100 dark:bg-[#1f2328]";
  else headerClasses += " hover:bg-slate-50 dark:hover:bg-[#16181d]";

  return (
    <div className={indented ? "ml-3" : ""}>
      <button
        ref={ref}
        type="button"
        className={headerClasses}
        onClick={onToggle}
      >
        <div className="flex items-center gap-1.5">
          <CaretDown
            size={10}
            weight="bold"
            className={`text-slate-400 dark:text-zinc-500 transition-transform duration-150 ${
              expanded ? "" : "-rotate-90"
            }`}
          />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            {name}
          </span>
          {isMcp && (
            <span className="text-[8px] px-1 py-px rounded bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-semibold leading-tight">
              MCP
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-500 dark:text-zinc-400 tabular-nums">
          {enabledCount}/{totalCount}
        </span>
      </button>
      {expanded && <div className="pl-3">{children}</div>}
    </div>
  );
}
