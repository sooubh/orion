import { SimpleToggleSwitch } from "@/components/lib/Toggle";
import { useTranslation } from "react-i18next";
import Admin from "@/models/admin";
import { useMemoriesContext } from "../MemoriesContext";

export default function PersonalizationToggle() {
  const {
    canToggle,
    enabled,
    setEnabled,
    autoExtraction,
    setAutoExtraction,
    loadingEnabled,
  } = useMemoriesContext();
  const { t } = useTranslation();

  async function handleToggle(checked) {
    const value = checked ? "true" : "false";
    const { success } = await Admin.updateSystemPreferences({
      memory_enabled: value,
    });
    if (!success) return;
    setEnabled(checked);
  }

  async function handleAutoExtractionToggle(checked) {
    const value = checked ? "true" : "false";
    const { success } = await Admin.updateSystemPreferences({
      memory_auto_extraction: value,
    });
    if (!success) return;
    setAutoExtraction(checked);
  }

  if (!canToggle || loadingEnabled) return null;

  return (
    <div className="shrink-0 bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] rounded-2xl p-4 space-y-3 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {t("chat_window.memories.toggle.label")}
          </p>
          <p className="text-xs leading-4 text-slate-500 dark:text-zinc-400 mt-0.5">
            {t("chat_window.memories.toggle.description")}
          </p>
        </div>
        <SimpleToggleSwitch
          size="md"
          enabled={enabled}
          onChange={handleToggle}
        />
      </div>
      {enabled && (
        <div className="flex items-start gap-3 pt-2.5 border-t border-slate-200 dark:border-[#1f2328]">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {t("chat_window.memories.auto_extraction.label")}
            </p>
            <p className="text-xs leading-4 text-slate-500 dark:text-zinc-400 mt-0.5">
              {t("chat_window.memories.auto_extraction.description")}
            </p>
          </div>
          <SimpleToggleSwitch
            size="md"
            enabled={autoExtraction}
            onChange={handleAutoExtractionToggle}
          />
        </div>
      )}
    </div>
  );
}
