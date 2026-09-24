import { useRef, useEffect } from "react";
import { SimpleToggleSwitch } from "@/components/lib/Toggle";

export default function SkillRow({
  name,
  enabled,
  onToggle,
  highlighted = false,
  disabled = false,
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  let classNames =
    "border-none bg-transparent w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors";
  if (highlighted) classNames += " bg-slate-100 dark:bg-[#1f2328]";
  else classNames += " hover:bg-slate-100 dark:hover:bg-[#1f2328]";

  if (disabled) classNames += " opacity-60 cursor-not-allowed";
  else classNames += " cursor-pointer";
  return (
    <button
      ref={ref}
      type="button"
      className={classNames}
      onClick={() => !disabled && onToggle()}
    >
      <span className="text-xs font-medium text-slate-900 dark:text-white">{name}</span>
      <div className="pointer-events-none" aria-hidden="true">
        <SimpleToggleSwitch size="sm" enabled={enabled} />
      </div>
    </button>
  );
}
