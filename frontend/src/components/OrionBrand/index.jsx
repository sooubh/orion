import React from "react";
import { Link } from "react-router-dom";
import paths from "@/utils/paths";
import { useTheme } from "@/hooks/useTheme";

export default function OrionBrand({
  size = "md",
  showDot = true,
  className = "",
  to = null,
}) {
  const { isLight } = useTheme();

  const sizeClasses = {
    xs: "text-xs tracking-[0.2em]",
    sm: "text-sm tracking-[0.22em]",
    md: "text-base md:text-lg tracking-[0.26em]",
    lg: "text-xl tracking-[0.28em]",
    xl: "text-2xl tracking-[0.3em]",
    "2xl": "text-3xl tracking-[0.32em]",
  };

  const dotSizes = {
    xs: "h-1 w-1",
    sm: "h-1.5 w-1.5",
    md: "h-1.5 w-1.5",
    lg: "h-2 w-2",
    xl: "h-2 w-2",
    "2xl": "h-2.5 w-2.5",
  };

  const textGradient = isLight
    ? "text-slate-900 bg-gradient-to-r from-slate-950 via-slate-800 to-sky-700 bg-clip-text text-transparent font-black"
    : "text-white bg-gradient-to-r from-white via-zinc-100 to-sky-400 bg-clip-text text-transparent drop-shadow-sm font-black";

  const dotColor = isLight
    ? "bg-sky-600 shadow-[0_0_8px_rgba(2,132,199,0.5)]"
    : "bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]";

  const content = (
    <div className={`inline-flex items-center gap-2 select-none group ${className}`}>
      <span
        className={`font-black uppercase font-sans ${textGradient} ${
          sizeClasses[size] || sizeClasses.md
        }`}
      >
        ORION
      </span>
      {showDot && (
        <span
          className={`rounded-full ${dotColor} animate-pulse ${
            dotSizes[size] || dotSizes.md
          }`}
        />
      )}
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="inline-flex items-center hover:opacity-90 transition-opacity"
      >
        {content}
      </Link>
    );
  }

  return content;
}
