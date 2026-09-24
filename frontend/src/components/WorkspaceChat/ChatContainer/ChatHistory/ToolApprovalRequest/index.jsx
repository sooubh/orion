import React, { useState } from "react";
import { CaretDown, Check, X, Hammer } from "@phosphor-icons/react";
import AgentSkillWhitelist from "@/models/agentSkillWhitelist";
import { useTranslation } from "react-i18next";
import useTimeoutProgress from "@/hooks/useTimeoutProgress";

export default function ToolApprovalRequest({
  requestId,
  skillName,
  payload = {},
  description = null,
  timeoutMs = null,
  websocket,
  onResponse,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [responded, setResponded] = useState(false);
  const [approved, setApproved] = useState(null);
  const [alwaysAllow, setAlwaysAllow] = useState(false);
  const hasPayload = payload && Object.keys(payload).length > 0;

  const progressPercent = useTimeoutProgress(timeoutMs, {
    active: !responded,
    intervalMs: 50,
    onTimeout: handleTimeout,
  });

  function handleTimeout() {
    if (responded) return;
    setResponded(true);
    setApproved(false);
    onResponse?.(false);
  }

  async function handleResponse(isApproved) {
    if (responded) return;

    setResponded(true);
    setApproved(isApproved);

    // If user approved and checked "Always allow", add to whitelist
    if (isApproved && alwaysAllow) {
      await AgentSkillWhitelist.addToWhitelist(skillName);
    }

    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(
        JSON.stringify({
          type: "toolApprovalResponse",
          requestId,
          approved: isApproved,
        })
      );
    }

    onResponse?.(isApproved);
  }

  return (
    <div className="flex justify-center w-full my-1 pr-4">
      <div className="w-full flex flex-col">
        <div className="w-full">
          <div
            style={{
              transition: "all 0.1s ease-in-out",
              borderRadius: "16px",
            }}
            className="relative bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] shadow-xs p-4 pb-2 flex flex-col gap-y-1 overflow-hidden"
          >
            <ToolApprovalHeader
              skillName={skillName}
              hasPayload={hasPayload}
              isExpanded={isExpanded}
              setIsExpanded={setIsExpanded}
            />
            <div className="flex flex-col gap-y-1">
              {description && (
                <span className="text-slate-600 dark:text-zinc-400 font-medium font-mono text-xs">
                  {description}
                </span>
              )}
              <ToolApprovalPayload payload={payload} isExpanded={isExpanded} />
              <ToolApprovalResponseOption
                approved={approved}
                skillName={skillName}
                alwaysAllow={alwaysAllow}
                setAlwaysAllow={setAlwaysAllow}
                onApprove={() => handleResponse(true)}
                onReject={() => handleResponse(false)}
              />
              <ToolApprovalResponseMessage approved={approved} />
            </div>
            {timeoutMs && !responded && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200 dark:bg-zinc-700">
                <div
                  className="h-full bg-sky-600 dark:bg-sky-500 transition-none"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolApprovalHeader({
  skillName,
  hasPayload,
  isExpanded,
  setIsExpanded,
}) {
  const { t } = useTranslation();
  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-2">
        <Hammer size={16} className="text-slate-700 dark:text-zinc-300" />
        <div className="text-slate-800 dark:text-zinc-200 font-medium text-sm flex gap-x-1">
          {t("chat_window.agent_invocation.model_wants_to_call")}
          <span className="font-semibold text-sky-600 dark:text-sky-400">
            {skillName}
          </span>
        </div>
      </div>
      {hasPayload && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute top-4 right-4 border-none text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
          aria-label={isExpanded ? "Hide details" : "Show details"}
        >
          <CaretDown
            className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </div>
  );
}

function ToolApprovalPayload({ payload, isExpanded }) {
  const hasPayload = payload && Object.keys(payload).length > 0;
  if (!hasPayload || !isExpanded) return null;

  function formatPayload(data) {
    if (typeof data === "string") return data;
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  return (
    <div className="p-3 bg-slate-100 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-x-auto">
      <pre className="text-xs text-slate-800 dark:text-zinc-200 font-mono whitespace-pre-wrap break-words">
        {formatPayload(payload)}
      </pre>
    </div>
  );
}

function ToolApprovalResponseOption({
  approved,
  skillName,
  alwaysAllow,
  setAlwaysAllow,
  onApprove,
  onReject,
}) {
  const { t } = useTranslation();
  if (approved !== null) return null;

  return (
    <div className="flex flex-col gap-2 mt-1 pb-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onApprove}
          className="border-none transition-all duration-200 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-medium px-4 py-2 rounded-lg text-sm shadow-xs cursor-pointer"
        >
          {t("chat_window.agent_invocation.approve")}
        </button>
        <button
          type="button"
          onClick={onReject}
          className="border border-slate-300 dark:border-zinc-700 text-slate-700 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e2227] transition-colors cursor-pointer"
        >
          {t("chat_window.agent_invocation.reject")}
        </button>
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 text-xs transition-colors">
        <input
          type="checkbox"
          checked={alwaysAllow}
          onChange={(e) => setAlwaysAllow(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-slate-300 dark:border-zinc-700 cursor-pointer"
        />
        <span>
          {t("chat_window.agent_invocation.always_allow", { skillName })}
        </span>
      </label>
    </div>
  );
}

function ToolApprovalResponseMessage({ approved }) {
  const { t } = useTranslation();

  if (approved === null) return null;
  if (approved === false) {
    return (
      <div className="flex items-center gap-1 text-sm font-medium text-rose-600 dark:text-rose-400">
        <X size={16} weight="bold" />
        <span>{t("chat_window.agent_invocation.tool_call_was_rejected")}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
      <Check size={16} weight="bold" />
      <span>{t("chat_window.agent_invocation.tool_call_was_approved")}</span>
    </div>
  );
}
