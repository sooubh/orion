export default function SuggestedMessages({
  suggestedMessages = [],
  sendCommand,
}) {
  if (!suggestedMessages?.length) return null;

  return (
    <div className="flex flex-col w-full max-w-[650px] mt-6 px-4">
      {suggestedMessages.map((msg, index) => {
        const text = msg.heading?.trim()
          ? `${msg.heading.trim()} ${msg.message?.trim() || ""}`
          : msg.message?.trim() || "";
        if (!text) return null;

        return (
          <div key={index}>
            {index > 0 && (
              <div className="border-t border-slate-200 dark:border-zinc-800" />
            )}
            <button
              type="button"
              onClick={() => sendCommand({ text, autoSubmit: true })}
              className="w-full text-left py-2.5 px-3 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium leading-relaxed hover:bg-slate-100 dark:hover:bg-[#1a1c20] rounded-xl transition-colors cursor-pointer"
            >
              {text}
            </button>
          </div>
        );
      })}
    </div>
  );
}
