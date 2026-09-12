import { useEffect, useState } from "react";
import Admin from "@/models/admin";
import showToast from "@/utils/toast";
import { useTranslation } from "react-i18next";

export default function CustomSiteSettings() {
  const { t } = useTranslation();
  const [hasChanges, setHasChanges] = useState(false);
  const [settings, setSettings] = useState({
    title: null,
    faviconUrl: null,
  });

  useEffect(() => {
    Admin.systemPreferencesByFields([
      "meta_page_title",
      "meta_page_favicon",
    ]).then(({ settings }) => {
      setSettings({
        title: settings?.meta_page_title,
        faviconUrl: settings?.meta_page_favicon,
      });
    });
  }, []);

  async function handleSiteSettingUpdate(e) {
    e.preventDefault();
    await Admin.updateSystemPreferences({
      meta_page_title: settings.title ?? null,
      meta_page_favicon: settings.faviconUrl ?? null,
    });
    showToast(
      "Site preferences updated! They will reflect on page reload.",
      "success",
      { clear: true }
    );
    setHasChanges(false);
    return;
  }

  return (
    <form
      className="p-5 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-5"
      onChange={() => setHasChanges(true)}
      onSubmit={handleSiteSettingUpdate}
    >
      <div className="space-y-1">
        <label className="text-sm font-semibold text-white block">
          {t("customization.items.browser-appearance.title")}
        </label>
        <p className="text-xs text-zinc-400">
          {t("customization.items.browser-appearance.description")}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
          {t("customization.items.browser-appearance.tab.title")}
        </label>
        <p className="text-xs text-zinc-400">
          {t("customization.items.browser-appearance.tab.description")}
        </p>
        <input
          name="meta_page_title"
          type="text"
          className="bg-zinc-900 border border-zinc-700/60 focus:border-indigo-500 rounded-xl text-white placeholder:text-zinc-500 text-sm py-2.5 px-4 outline-none transition-all w-full max-w-md"
          placeholder="Orion | Private Intelligence Platform"
          autoComplete="off"
          onChange={(e) => {
            setSettings((prev) => {
              return { ...prev, title: e.target.value };
            });
          }}
          value={
            settings.title ??
            "Orion | Private Intelligence Platform"
          }
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
          {t("customization.items.browser-appearance.favicon.title")}
        </label>
        <p className="text-xs text-zinc-400">
          {t("customization.items.browser-appearance.favicon.description")}
        </p>
        <div className="flex items-center gap-3">
          <img
            src={settings.faviconUrl ?? "/favicon.png"}
            onError={(e) => (e.target.src = "/favicon.png")}
            className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-700/60 p-1.5 object-contain shrink-0"
            alt="Site favicon"
          />
          <input
            name="meta_page_favicon"
            type="url"
            className="bg-zinc-900 border border-zinc-700/60 focus:border-indigo-500 rounded-xl text-white placeholder:text-zinc-500 text-sm py-2.5 px-4 outline-none transition-all w-full max-w-md"
            placeholder="url to your image"
            onChange={(e) => {
              setSettings((prev) => {
                return { ...prev, faviconUrl: e.target.value };
              });
            }}
            autoComplete="off"
            value={settings.faviconUrl ?? ""}
          />
        </div>
      </div>

      {hasChanges && (
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition-all shadow-sm cursor-pointer"
        >
          Save
        </button>
      )}
    </form>
  );
}
