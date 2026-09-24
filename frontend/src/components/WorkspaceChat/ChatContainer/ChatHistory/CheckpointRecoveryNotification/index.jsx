import React from "react";
import { ArrowCounterClockwise, ShieldCheck } from "@phosphor-icons/react";

export default function CheckpointRecoveryNotification({
  action = "RESUME",
  stepName = "",
  stepOrder = 1,
  stepTitle = "",
  reason = "",
}) {
  const isRollback = action === "ROLLBACK";

  return (
    <div className="flex w-full my-2">
      <div className="rounded-[16px] border border-cyan-300 dark:border-cyan-500/30 bg-cyan-50 dark:bg-cyan-950/20 px-4 py-2.5 flex items-center gap-3 text-xs text-slate-800 dark:text-zinc-200 backdrop-blur-sm shadow-xs">
        <div
          className={`p-1.5 rounded-lg ${
            isRollback
              ? "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400"
              : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
          } flex-shrink-0`}
        >
          {isRollback ? (
            <ArrowCounterClockwise size={16} weight="bold" />
          ) : (
            <ShieldCheck size={16} weight="bold" />
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span
              className={`font-semibold ${
                isRollback
                  ? "text-cyan-800 dark:text-cyan-300"
                  : "text-emerald-800 dark:text-emerald-300"
              }`}
            >
              {isRollback ? "Workflow Rolled Back" : "Workflow Resumed"}
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-black/30 text-cyan-800 dark:text-zinc-300 border border-cyan-200 dark:border-white/10">
              {action}
            </span>
            <span className="text-[11px] text-slate-600 dark:text-zinc-400">
              from Checkpoint {stepOrder} ({stepTitle || stepName})
            </span>
          </div>
          {reason && (
            <span className="text-[11px] text-slate-600 dark:text-zinc-400 line-clamp-1">
              {reason}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
