import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

/**
 * Portal-rendered dropdown menu for a memory card.
 * Uses fixed positioning so it is not clipped by any scrollable parent.
 * @param {Object} props
 * @param {React.RefObject} props.menuRef
 * @param {React.RefObject} props.buttonRef
 * @param {boolean} props.isWorkspace
 * @param {boolean} props.canMove - hide the move option when the target scope is full
 * @param {function} props.onEdit
 * @param {function} props.onMove
 * @param {function} props.onDelete
 */
export default function CardMenu({
  menuRef,
  buttonRef,
  isWorkspace,
  canMove,
  onEdit,
  onMove,
  onDelete,
}) {
  const { t } = useTranslation();
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.right - 200 });
  }, []);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] rounded-xl py-2 px-1 flex flex-col shadow-xl w-[175px]"
      style={{ top: pos.top, left: pos.left }}
    >
      <MenuItem label={t("chat_window.memories.menu.edit")} onClick={onEdit} />
      {canMove && (
        <MenuItem
          label={
            isWorkspace
              ? t("chat_window.memories.menu.move_to_global")
              : t("chat_window.memories.menu.move_to_workspace")
          }
          onClick={onMove}
        />
      )}
      <MenuItem
        label={t("chat_window.memories.menu.delete")}
        onClick={onDelete}
      />
    </div>,
    document.body
  );
}

function MenuItem({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left text-sm font-medium text-slate-800 dark:text-zinc-200 border-none bg-transparent cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1f2328] rounded-lg px-2.5 py-1.5 transition-colors"
    >
      {label}
    </button>
  );
}
