import React, { useState, useEffect, useRef } from "react";
import { Trash, DotsThreeVertical, TreeView } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

function ActionMenu({ chatId, forkThread, isEditing, role }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const toggleMenu = () => setOpen(!open);

  const handleFork = () => {
    forkThread(chatId);
    setOpen(false);
  };

  const handleDelete = () => {
    window.dispatchEvent(
      new CustomEvent("delete-message", { detail: { chatId } })
    );
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  if (!chatId || isEditing || role === "user") return null;

  return (
    <div className="mt-2 -ml-0.5 relative" ref={menuRef}>
      <button
        onClick={toggleMenu}
        className="border-none text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white transition-colors duration-200 cursor-pointer p-0.5"
        data-tooltip-id="action-menu"
        data-tooltip-content={t("chat_window.more_actions")}
        aria-label={t("chat_window.more_actions")}
      >
        <DotsThreeVertical size={24} weight="bold" />
      </button>
      {open && (
        <div
          data-action-menu-open
          className="absolute -top-1 left-7 mt-1 border border-slate-200 dark:border-[#1f2328] rounded-xl bg-white dark:bg-[#111215] flex flex-col shadow-xl text-slate-900 dark:text-white z-99 overflow-hidden min-w-[120px]"
        >
          <button
            onClick={handleFork}
            className="border-none flex items-center text-slate-700 dark:text-zinc-200 gap-x-2 hover:bg-slate-100 dark:hover:bg-[#1f2328] py-2 px-3 transition-colors duration-200 w-full text-left cursor-pointer"
          >
            <TreeView size={18} />
            <span className="text-sm">{t("chat_window.fork")}</span>
          </button>
          <button
            onClick={handleDelete}
            className="border-none flex items-center text-rose-600 dark:text-rose-400 gap-x-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 py-2 px-3 transition-colors duration-200 w-full text-left cursor-pointer"
          >
            <Trash size={18} />
            <span className="text-sm">{t("chat_window.delete")}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default ActionMenu;
