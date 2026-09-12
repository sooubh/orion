import React from "react";
import { Check } from "@phosphor-icons/react";

export default function EmbedderItem({
  name,
  value,
  image,
  description,
  checked,
  onClick,
}) {
  return (
    <div
      onClick={() => onClick(value)}
      className={`w-full p-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between group ${
        checked
          ? "bg-indigo-500/15 border border-indigo-500/40 text-white"
          : "hover:bg-zinc-800/70 border border-transparent text-zinc-300"
      }`}
    >
      <input
        type="checkbox"
        value={value}
        className="peer hidden"
        checked={checked}
        readOnly={true}
        formNoValidate={true}
      />
      <div className="flex gap-x-3 items-center min-w-0">
        <div className="w-8 h-8 rounded-md bg-zinc-950/80 border border-white/10 p-1 flex items-center justify-center shrink-0">
          <img
            src={image}
            alt={`${name} logo`}
            className="w-6 h-6 rounded object-contain"
          />
        </div>
        <div className="flex flex-col min-w-0">
          <div
            className={`text-xs font-semibold ${
              checked ? "text-white" : "text-zinc-200 group-hover:text-white"
            } truncate`}
          >
            {name}
          </div>
          <div className="text-[11px] text-zinc-400 truncate max-w-sm">
            {description}
          </div>
        </div>
      </div>
      {checked && (
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500 text-white shrink-0 ml-2">
          <Check size={12} weight="bold" />
        </span>
      )}
    </div>
  );
}
