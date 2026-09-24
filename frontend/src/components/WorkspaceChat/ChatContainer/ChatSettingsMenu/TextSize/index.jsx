import { useState } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

function getTextSizes(t) {
  return [
    { key: "small", label: t("chat_window.small") },
    { key: "normal", label: t("chat_window.normal") },
    { key: "large", label: t("chat_window.large") },
  ];
}

export default function TextSizeRow() {
  const { t } = useTranslation();
  const [showSubmenu, setShowSubmenu] = useState(false);
  const [selectedSize, setSelectedSize] = useState(
    window.localStorage.getItem("anythingllm_text_size") || "normal"
  );

  function handleTextSizeChange(size) {
    setSelectedSize(size);
    window.localStorage.setItem("anythingllm_text_size", size);
    window.dispatchEvent(new CustomEvent("textSizeChange", { detail: size }));
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowSubmenu(true)}
      onMouseLeave={() => setShowSubmenu(false)}
    >
      <div
        className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
          showSubmenu
            ? "bg-slate-100 dark:bg-[#1f2328] text-slate-900 dark:text-white"
            : "hover:bg-slate-50 dark:hover:bg-[#16181d] text-slate-700 dark:text-zinc-300"
        }`}
      >
        <span className="text-sm font-medium">
          {t("chat_window.text_size_label")}
        </span>
        <CaretRight
          size={14}
          weight="bold"
          className="text-slate-500 dark:text-zinc-400"
        />
      </div>
      {showSubmenu && (
        <TextSizeSubmenu
          selectedSize={selectedSize}
          onSizeChange={handleTextSizeChange}
        />
      )}
    </div>
  );
}

function TextSizeSubmenu({ selectedSize, onSizeChange }) {
  const { t } = useTranslation();
  const textSizes = getTextSizes(t);

  return (
    <div className="absolute right-full top-0 -mr-2 pr-2 pt-0">
      <div className="bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] rounded-xl p-2.5 w-[110px] flex flex-col gap-1 shadow-xl">
        {textSizes.map(({ key, label }) => (
          <div
            key={key}
            onClick={() => onSizeChange(key)}
            className={`px-2 py-1.5 rounded-lg cursor-pointer text-sm font-medium transition-colors ${
              selectedSize === key
                ? "bg-slate-100 dark:bg-[#1f2328] text-slate-900 dark:text-white font-semibold"
                : "hover:bg-slate-50 dark:hover:bg-[#16181d] text-slate-700 dark:text-zinc-300"
            }`}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
