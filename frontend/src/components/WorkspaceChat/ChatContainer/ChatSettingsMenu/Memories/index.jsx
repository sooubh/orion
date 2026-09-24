import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import useUser from "@/hooks/useUser";
import System from "@/models/system";
import { useMemoriesSidebar, useSourcesSidebar } from "../../ChatSidebar";

export default function MemoriesRow({ onClose }) {
  const { t } = useTranslation();
  const { user } = useUser();
  const { toggleSidebar } = useMemoriesSidebar();
  const { closeSidebar } = useSourcesSidebar();
  const [memoryEnabled, setMemoryEnabled] = useState(null);

  const isAdmin = !user || user?.role === "admin";

  useEffect(() => {
    System.keys().then((settings) => {
      setMemoryEnabled(!!settings?.MemoryEnabled);
    });
  }, []);

  function handleClick() {
    closeSidebar();
    toggleSidebar();
    onClose();
  }

  if (memoryEnabled === null) return null;
  if (!isAdmin && !memoryEnabled) return null;

  return (
    <div
      onClick={handleClick}
      className="flex items-center px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-[#16181d] text-slate-700 dark:text-zinc-300 transition-colors"
    >
      <span className="text-sm font-medium">
        {t("chat_window.memories.title")}
      </span>
    </div>
  );
}
