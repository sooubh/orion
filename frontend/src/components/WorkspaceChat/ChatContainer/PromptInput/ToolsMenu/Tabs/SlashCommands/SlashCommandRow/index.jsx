import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { DotsThree } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

export default function SlashCommandRow({
  command,
  description,
  onClick,
  onEdit,
  showMenu = false,
  highlighted = false,
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);
  const menuBtnRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        menuBtnRef.current &&
        !menuBtnRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen && menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY,
        left: rect.right + window.scrollX - 120,
      });
    }
  }, [menuOpen]);

  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer group relative transition-colors ${
        highlighted
          ? "bg-slate-100 dark:bg-[#1f2328]"
          : "hover:bg-slate-100 dark:hover:bg-[#1f2328]"
      }`}
    >
      <div className="flex gap-1.5 items-center text-xs min-w-0 flex-1">
        <span className="text-slate-900 dark:text-white font-medium shrink-0">
          {command}
        </span>
        <span className="text-slate-500 dark:text-zinc-400 italic truncate">
          {description}
        </span>
      </div>

      {showMenu && (
        <div className="relative shrink-0 ml-1">
          <button
            ref={menuBtnRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="border-none cursor-pointer text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition-colors"
          >
            <DotsThree size={16} weight="bold" />
          </button>

          {menuOpen &&
            createPortal(
              <div
                ref={menuRef}
                style={{
                  position: "fixed",
                  top: menuPosition.top,
                  left: menuPosition.left,
                }}
                className="z-[9999] bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] rounded-xl shadow-xl min-w-[120px] flex flex-col overflow-hidden"
              >
                <button
                  type="button"
                  className="border-none px-3 py-1.5 text-xs text-slate-800 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-[#1f2328] cursor-pointer text-left font-medium transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onEdit?.();
                  }}
                >
                  {t("chat_window.edit")}
                </button>
              </div>,
              document.body
            )}
        </div>
      )}
    </div>
  );
}
