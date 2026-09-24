const SHARED_CLASS =
  "w-full border border-slate-300 dark:border-[#22262d] bg-white dark:bg-[#16181d] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm leading-5 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 px-[14px] py-[10px]";

function TextareaInput({ value, placeholder, onChange }) {
  return (
    <textarea
      autoFocus
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${SHARED_CLASS} min-h-[128px] resize-y`}
    />
  );
}

function TextInput({ type, value, placeholder, onChange, onSubmit }) {
  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit?.();
    }
  }

  return (
    <input
      autoFocus
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      className={SHARED_CLASS}
    />
  );
}

/**
 * Free-form text/url/number/date/email/textarea input. The server's
 * normalizeQuestion has already constrained `inputType` to a known value
 * before sending, so we just trust it here and fall back to "text" if missing.
 */
export default function InputForm({ question, draft, onChange, onSubmit }) {
  const inputType = question.inputType || "text";
  const value = draft.value || "";
  const placeholder = question.placeholder || "";

  if (inputType === "textarea") {
    return (
      <TextareaInput
        value={value}
        placeholder={placeholder}
        onChange={onChange}
      />
    );
  }

  return (
    <TextInput
      type={inputType}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      onSubmit={onSubmit}
    />
  );
}
