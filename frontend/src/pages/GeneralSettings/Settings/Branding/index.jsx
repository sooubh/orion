import Sidebar from "@/components/SettingsSidebar";
import { isMobile } from "react-device-detect";
import FooterCustomization from "../components/FooterCustomization";
import SupportEmail from "../components/SupportEmail";
import CustomLogo from "../components/CustomLogo";
import { useTranslation } from "react-i18next";
import CustomAppName from "../components/CustomAppName";
import CustomSiteSettings from "../components/CustomSiteSettings";

export default function BrandingSettings() {
  const { t } = useTranslation();

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <Sidebar />
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-auto modern-scrollbar p-4 md:p-8"
      >
        <div className="max-w-4xl mx-auto flex flex-col gap-y-6">
          <div className="flex flex-col gap-1 pb-6 border-b border-white/10">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span>Settings</span>
              <span>/</span>
              <span className="text-indigo-400">Customization</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {t("customization.branding.title")}
            </h1>
            <p className="text-xs text-zinc-400">
              {t("customization.branding.description")}
            </p>
          </div>
          <div className="space-y-4">
            <CustomAppName />
            <CustomLogo />
            <FooterCustomization />
            <SupportEmail />
            <CustomSiteSettings />
          </div>
        </div>
      </div>
    </div>
  );
}
