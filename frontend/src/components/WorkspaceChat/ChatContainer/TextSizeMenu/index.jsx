import { useState, useRef, useEffect, useMemo } from "react";
import { SlidersHorizontal } from "@phosphor-icons/react";
import useLoginMode from "@/hooks/useLoginMode";
import { useTranslation } from "react-i18next";
import { isMobile } from "react-device-detect";

function getTextSizes(t) {
  return [
    { key: "small", label: t("chat_window.small"), textClass: "text-xs" },
    { key: "normal", label: t("chat_window.normal"), textClass: "text-sm" },
    { key: "large", label: t("chat_window.large"), textClass: "text-base" },
  ];
}

export default function TextSizeMenu() {
  const { t } = useTranslation();
  const TEXT_SIZES = useMemo(() => getTextSizes(t), [t]);
  const mode = useLoginMode();
  const [showMenu, setShowMenu] = useState(false);
  const [selectedSize, setSelectedSize] = useState(
    window.localStorage.getItem("orion_text_size") ||
      window.localStorage.getItem("anythingllm_text_size") ||
      "normal"
  );
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;
    function handleClickOutside(e) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  function handleTextSizeChange(size) {
    setSelectedSize(size);
    window.localStorage.setItem("orion_text_size", size);
    window.dispatchEvent(new CustomEvent("textSizeChange", { detail: size }));
  }

  // User icon is visible when login mode is active (single with password or multi-user)
  const hasUserIcon = mode !== null;

  if (isMobile) return null;
  return (
    <div
      className={`absolute top-3 md:top-5 z-30 ${hasUserIcon ? "right-[55px] md:right-[67px]" : "right-4 md:right-6"}`}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className={`group border cursor-pointer flex items-center justify-center w-[35px] h-[35px] rounded-full transition-all shadow-xs ${
          showMenu
            ? "bg-slate-200 dark:bg-zinc-700 text-slate-900 dark:text-white border-slate-300 dark:border-zinc-600"
            : "bg-white dark:bg-[#111215] hover:bg-slate-100 dark:hover:bg-[#1f2328] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-[#1f2328]"
        }`}
      >
        <SlidersHorizontal
          size={18}
          className="text-slate-700 dark:text-zinc-300"
        />
      </button>

      {showMenu && (
        <div
          ref={menuRef}
          className="absolute right-0 top-[42px] bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] rounded-xl p-3 w-[200px] flex flex-col gap-1 shadow-xl"
        >
          <p className="text-[10px] font-medium text-slate-500 dark:text-zinc-400 px-2 mb-0.5">
            {t("chat_window.text_size_label")}
          </p>
          {TEXT_SIZES.map(({ key, label, textClass }) => (
            <div
              key={key}
              onClick={() => handleTextSizeChange(key)}
              className={`flex items-center px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                selectedSize === key
                  ? "bg-slate-100 dark:bg-[#1f2328] font-semibold text-slate-900 dark:text-white"
                  : "hover:bg-slate-50 dark:hover:bg-[#16181d] text-slate-700 dark:text-zinc-300"
              }`}
            >
              <span className={textClass}>
                {label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
