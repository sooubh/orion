import React, { useState, useEffect } from "react";
import showToast from "@/utils/toast";
import { safeJsonParse } from "@/utils/request";
import NewIconForm from "./NewIconForm";
import Admin from "@/models/admin";
import System from "@/models/system";
import { useTranslation } from "react-i18next";

export default function FooterCustomization() {
  const [footerIcons, setFooterIcons] = useState(Array(3).fill(null));
  const { t } = useTranslation();

  useEffect(() => {
    async function fetchFooterIcons() {
      const { settings } = await Admin.systemPreferencesByFields([
        "footer_data",
      ]);

      const footerData = settings?.footer_data;
      if (footerData) {
        const parsedIcons = safeJsonParse(footerData, []);
        setFooterIcons((prevIcons) => {
          const updatedIcons = [...prevIcons];
          parsedIcons.forEach((icon, index) => {
            updatedIcons[index] = icon;
          });
          return updatedIcons;
        });
      }
    }
    fetchFooterIcons();
  }, []);

  const updateFooterIcons = async (updatedIcons) => {
    const { success, error } = await Admin.updateSystemPreferences({
      footer_data: JSON.stringify(updatedIcons.filter((icon) => icon !== null)),
    });

    if (!success) {
      showToast(`Failed to update footer icons - ${error}`, "error", {
        clear: true,
      });
      return;
    }

    window.localStorage.removeItem(System.cacheKeys.footerIcons);
    setFooterIcons(updatedIcons);
    showToast("Successfully updated footer icons.", "success", { clear: true });
  };

  const handleRemoveIcon = (index) => {
    const updatedIcons = [...footerIcons];
    updatedIcons[index] = null;
    updateFooterIcons(updatedIcons);
  };

  return (
    <div className="p-5 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-semibold text-white block">
          {t("customization.items.sidebar-footer.title")}
        </label>
        <p className="text-xs text-zinc-400">
          {t("customization.items.sidebar-footer.description")}
        </p>
      </div>
      <div className="flex gap-x-3 font-semibold text-zinc-300 text-xs uppercase tracking-wider">
        <div>{t("customization.items.sidebar-footer.icon")}</div>
        <div className="ml-8">{t("customization.items.sidebar-footer.link")}</div>
      </div>
      <div className="space-y-2.5">
        {footerIcons.map((icon, index) => (
          <NewIconForm
            key={index}
            icon={icon?.icon}
            url={icon?.url}
            onSave={(newIcon, newUrl) => {
              const updatedIcons = [...footerIcons];
              updatedIcons[index] = { icon: newIcon, url: newUrl };
              updateFooterIcons(updatedIcons);
            }}
            onRemove={() => handleRemoveIcon(index)}
          />
        ))}
      </div>
    </div>
  );
}
