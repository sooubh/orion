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
      <div className="rounded-[16px] border border-cyan-500/30 bg-cyan-950/20 px-4 py-2.5 flex items-center gap-3 text-xs text-theme-text-primary backdrop-blur-sm shadow-sm">
        <div
          className={`p-1.5 rounded-lg ${
            isRollback
              ? "bg-cyan-500/20 text-cyan-400"
              : "bg-emerald-500/20 text-emerald-400"
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
                  ? "text-cyan-300 light:text-cyan-900"
                  : "text-emerald-300 light:text-emerald-900"
              }`}
            >
              {isRollback ? "Workflow Rolled Back" : "Workflow Resumed"}
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/30 text-theme-text-secondary border border-white/5">
              {action}
            </span>
            <span className="text-[11px] text-theme-text-secondary">
              from Checkpoint {stepOrder} ({stepTitle || stepName})
            </span>
          </div>
          {reason && (
            <span className="text-[11px] text-theme-text-secondary line-clamp-1">
              {reason}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
