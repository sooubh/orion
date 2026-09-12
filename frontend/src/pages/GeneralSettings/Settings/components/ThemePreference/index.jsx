import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";
import { CaretDown } from "@phosphor-icons/react";

export default function ThemePreference() {
  const { t } = useTranslation();
  const { theme, setTheme, availableThemes } = useTheme();

  return (
    <div className="p-5 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
      <div className="space-y-1">
        <label className="text-sm font-semibold text-white block">
          {t("customization.items.theme.title")}
        </label>
        <p className="text-xs text-zinc-400">
          {t("customization.items.theme.description")}
        </p>
      </div>
      <div className="relative min-w-[200px]">
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="w-full appearance-none bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-700/60 hover:border-indigo-500/50 text-white text-sm font-medium rounded-xl py-2.5 pl-4 pr-10 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all cursor-pointer shadow-sm"
        >
          {Object.entries(availableThemes).map(([key, value]) => (
            <option key={key} value={key} className="bg-zinc-900 text-white">
              {value}
            </option>
          ))}
        </select>
        <CaretDown
          size={16}
          weight="bold"
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
        />
      </div>
    </div>
  );
}
