import { PencilSimple } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

function OptionButton({ label, description, index, selected, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`border w-full flex items-center gap-[9px] p-2 rounded-lg text-left transition-colors cursor-pointer ${
        selected
          ? "bg-slate-100 dark:bg-[#1f2328] border-slate-300 dark:border-[#2a2e36]"
          : "bg-transparent hover:bg-slate-50 dark:hover:bg-[#1a1d22] border-transparent"
      }`}
    >
      <span className="flex items-center justify-center shrink-0 w-7 h-7 rounded-lg bg-slate-200 dark:bg-[#252a30] text-slate-800 dark:text-zinc-200 text-sm font-semibold leading-6">
        {index + 1}
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-slate-900 dark:text-white text-sm leading-5 font-medium">
          {label}
        </span>
        {description && (
          <span className="text-xs text-slate-600 dark:text-zinc-400 leading-4">
            {description}
          </span>
        )}
      </span>
    </button>
  );
}

function OtherRow({ selected, onToggle, allowSkip, onSkip }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center w-full">
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggle}
        className={`border flex flex-1 min-w-0 items-center gap-[9px] p-2 rounded-lg text-left transition-colors cursor-pointer ${
          selected
            ? "bg-slate-100 dark:bg-[#1f2328] border-slate-300 dark:border-[#2a2e36]"
            : "bg-transparent hover:bg-slate-50 dark:hover:bg-[#1a1d22] border-transparent"
        }`}
      >
        <span className="flex items-center justify-center shrink-0 w-7 h-7 rounded-lg bg-slate-200 dark:bg-[#252a30] text-slate-800 dark:text-zinc-200">
          <PencilSimple size={16} />
        </span>
        <span
          className={`text-sm leading-5 ${
            selected
              ? "text-slate-900 dark:text-white font-medium"
              : "text-slate-600 dark:text-zinc-400"
          }`}
        >
          {t("chat_window.agent_invocation.clarifying_other")}
        </span>
      </button>
      {allowSkip && <SkipButton onClick={onSkip} />}
    </div>
  );
}

function SkipButton({ onClick }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-slate-300 dark:border-zinc-700 bg-transparent rounded-lg h-7 px-3 flex items-center justify-center text-slate-700 dark:text-zinc-300 text-xs font-medium leading-4 shrink-0 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
    >
      {t("chat_window.agent_invocation.batch_skip_this")}
    </button>
  );
}

function OtherInput({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <input
      autoFocus
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t(
        "chat_window.agent_invocation.clarifying_other_placeholder"
      )}
      className="mt-2 w-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-[#16181d] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 p-2"
    />
  );
}

/**
 * Numbered-card choice list. Supports single-select (click auto-advances via
 * onAutoAdvance) and multi-select (clicks toggle selection, parent owns the
 * submit step). An "Other" row reveals a free-text input when activated;
 * its value is merged into the answer at submit time by `answerForDraft`.
 *
 * When the question allows skipping, the Skip button renders inline next to
 * the Other row instead of in the Footer.
 */
export default function ChoiceForm({
  question,
  draft,
  onChange,
  onAutoAdvance,
  allowSkip,
  onSkip,
}) {
  const showOther = question.allowOther !== false;

  function isChecked(opt) {
    if (question.multiSelect)
      return Array.isArray(draft.selected) && draft.selected.includes(opt);
    return draft.selected === opt;
  }

  function handleSelect(opt) {
    if (question.multiSelect) {
      const list = Array.isArray(draft.selected) ? draft.selected : [];
      const next = list.includes(opt)
        ? list.filter((o) => o !== opt)
        : [...list, opt];
      onChange({ selected: next, otherSelected: false });
      return;
    }
    const patch = { selected: opt, otherSelected: false };
    onChange(patch);
    onAutoAdvance?.(patch);
  }

  function handleOtherToggle() {
    if (question.multiSelect) {
      onChange({ otherSelected: !draft.otherSelected });
      return;
    }
    onChange({ selected: null, otherSelected: !draft.otherSelected });
  }

  return (
    <div className="flex flex-col w-full">
      {question.options.map((opt, idx) => (
        <OptionButton
          key={`${opt}-${idx}`}
          label={opt}
          description={question.optionDescriptions?.[idx]}
          index={idx}
          selected={isChecked(opt)}
          onClick={() => handleSelect(opt)}
        />
      ))}
      {showOther && (
        <OtherRow
          selected={!!draft.otherSelected}
          onToggle={handleOtherToggle}
          allowSkip={allowSkip}
          onSkip={onSkip}
        />
      )}
      {showOther && draft.otherSelected && (
        <OtherInput
          value={draft.otherText || ""}
          onChange={(text) => onChange({ otherText: text })}
        />
      )}
    </div>
  );
}
