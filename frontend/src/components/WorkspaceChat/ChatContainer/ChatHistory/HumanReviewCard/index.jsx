import React, { useState } from "react";
import { Warning, CheckCircle, ShieldCheck } from "@phosphor-icons/react";
import HumanReviewModal from "@/components/Modals/HumanReviewModal";

export default function HumanReviewCard({
  stepId,
  stepName,
  reason,
  attempts = 2,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [resolvedRecord, setResolvedRecord] = useState(null);

  return (
    <div className="flex w-full my-3">
      <div className="w-full max-w-xl rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 mt-0.5">
              <Warning size={20} weight="bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-amber-300 light:text-amber-900">
                  Verification Boundary — Human Review Required
                </h4>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 light:text-amber-900">
                  Fail-Closed
                </span>
              </div>
              <p className="text-xs text-theme-text-secondary mt-1">
                Step <span className="font-mono text-amber-200 light:text-amber-900">{stepName || stepId}</span> failed independent verification after {attempts} automated self-repair attempts.
              </p>
              <p className="text-xs text-rose-300 light:text-rose-800 mt-1.5 font-mono bg-black/20 p-2 rounded border border-rose-500/20">
                {reason}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3.5 pt-3 border-t border-amber-500/20 flex items-center justify-between">
          <span className="text-[11px] text-theme-text-secondary">
            {resolvedRecord ? (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle size={14} weight="bold" />
                Resolved ({resolvedRecord.resolution?.action})
              </span>
            ) : (
              "Operator intervention required to proceed"
            )}
          </span>

          {!resolvedRecord ? (
            <button
              onClick={() => setModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition-colors shadow-sm"
            >
              Review & Intervene
            </button>
          ) : (
            <span className="text-xs text-emerald-300 font-mono">
              Action Recorded
            </span>
          )}
        </div>
      </div>

      <HumanReviewModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        reviewData={{ stepId, stepName, reason, attempts }}
        onResolved={(res) => setResolvedRecord(res)}
      />
    </div>
  );
}
