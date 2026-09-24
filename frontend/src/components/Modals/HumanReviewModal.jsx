import React, { useState } from "react";
import Modal, {
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalPrimaryButton,
} from "@/components/lib/Modal";
import { Warning, CheckCircle, ArrowCounterClockwise, X } from "@phosphor-icons/react";
import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

export default function HumanReviewModal({
  isOpen = false,
  onClose = () => {},
  reviewData = null,
  onResolved = () => {},
}) {
  const [action, setAction] = useState("APPROVED_OVERRIDE");
  const [correctedValue, setCorrectedValue] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !reviewData) return null;

  const { stepId, stepName, reason, attempts = 2 } = reviewData;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/verification/step/${encodeURIComponent(stepId)}/resolve`, {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify({
          action,
          correctedValue: action === "APPLY_CORRECTION" ? correctedValue : undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit human review resolution");
      }

      onResolved(data.resolved);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        title={
          <div className="flex items-center gap-x-2 text-amber-400">
            <Warning size={22} weight="bold" />
            <span>Human Review Required — Verification Boundary</span>
          </div>
        }
        onClose={onClose}
      />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-4 text-sm text-theme-text-primary">
            <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg">
              <p className="font-semibold text-amber-900 dark:text-amber-300">
                Automated Self-Repair Exhausted ({attempts} attempts)
              </p>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
                The agent attempted automated self-repair on step{" "}
                <code className="bg-amber-100 dark:bg-black/30 px-1 py-0.5 rounded text-amber-900 dark:text-amber-200 font-mono font-semibold">{stepName || stepId}</code>{" "}
                but could not independently satisfy the verification policy. Fail-closed security requires human operator intervention.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase">
                Failure Diagnosis
              </label>
              <div className="p-2.5 bg-slate-50 dark:bg-[#16181d] border border-slate-200 dark:border-[#22262d] rounded-lg text-xs font-mono text-rose-700 dark:text-rose-300 whitespace-pre-wrap">
                {reason || "Verification condition not satisfied."}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase">
                Operator Action
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAction("APPROVED_OVERRIDE")}
                  className={`p-2.5 rounded-lg border text-xs font-medium text-left flex flex-col gap-1 transition-all ${
                    action === "APPROVED_OVERRIDE"
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500"
                      : "border-slate-200 dark:border-[#22262d] bg-white dark:bg-[#16181d] hover:bg-slate-50 dark:hover:bg-[#1c2026] text-slate-800 dark:text-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle size={14} />
                    <span>Approve Override</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                    Accept current step output and resume task
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAction("APPLY_CORRECTION")}
                  className={`p-2.5 rounded-lg border text-xs font-medium text-left flex flex-col gap-1 transition-all ${
                    action === "APPLY_CORRECTION"
                      ? "border-cyan-500 bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 ring-1 ring-cyan-500"
                      : "border-slate-200 dark:border-[#22262d] bg-white dark:bg-[#16181d] hover:bg-slate-50 dark:hover:bg-[#1c2026] text-slate-800 dark:text-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <ArrowCounterClockwise size={14} />
                    <span>Apply Correction</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                    Provide operator-corrected value or prompt
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAction("REJECTED")}
                  className={`p-2.5 rounded-lg border text-xs font-medium text-left flex flex-col gap-1 transition-all ${
                    action === "REJECTED"
                      ? "border-rose-500 bg-rose-500/15 text-rose-800 dark:text-rose-300 ring-1 ring-rose-500"
                      : "border-slate-200 dark:border-[#22262d] bg-white dark:bg-[#16181d] hover:bg-slate-50 dark:hover:bg-[#1c2026] text-slate-800 dark:text-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <X size={14} />
                    <span>Reject & Halt</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                    Permanently fail the step and abort task
                  </span>
                </button>
              </div>
            </div>

            {action === "APPLY_CORRECTION" && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-theme-text-secondary">
                  Corrected Value / Input Payload
                </label>
                <textarea
                  value={correctedValue}
                  onChange={(e) => setCorrectedValue(e.target.value)}
                  placeholder="Enter the verified value, formula, or payload..."
                  rows={3}
                  className="w-full p-2.5 bg-theme-bg-secondary border border-theme-border rounded-lg text-xs font-mono text-theme-text-primary focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-theme-text-secondary">
                Operator Review Justification / Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for override or correction (recorded in audit log)..."
                className="w-full p-2 bg-theme-bg-secondary border border-theme-border rounded-lg text-xs text-theme-text-primary focus:outline-none focus:border-theme-accent"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                {error}
              </p>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-end gap-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-theme-text-secondary hover:text-theme-text-primary transition-colors"
            >
              Cancel
            </button>
            <ModalPrimaryButton type="submit" disabled={loading}>
              {loading ? "Submitting Resolution..." : "Submit Decision"}
            </ModalPrimaryButton>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
