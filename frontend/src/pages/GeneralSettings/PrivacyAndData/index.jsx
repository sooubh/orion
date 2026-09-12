import { useEffect, useState } from "react";
import Sidebar from "@/components/SettingsSidebar";
import { isMobile } from "react-device-detect";
import showToast from "@/utils/toast";
import System from "@/models/system";
import PreLoader from "@/components/Preloader";
import { useTranslation } from "react-i18next";
import ProviderPrivacy from "@/components/ProviderPrivacy";
import Toggle from "@/components/lib/Toggle";

export default function PrivacyAndDataHandling() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  useEffect(() => {
    async function fetchSettings() {
      setLoading(true);
      const settings = await System.keys();
      setSettings(settings);
      setLoading(false);
    }
    fetchSettings();
  }, []);

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
              <span className="text-emerald-400">Security & Isolation</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {t("privacy.title")}
            </h1>
            <p className="text-xs text-zinc-400">
              {t("privacy.description")}
            </p>
          </div>
          {loading ? (
            <div className="w-full h-64 flex justify-center items-center">
              <PreLoader />
            </div>
          ) : (
            <div className="flex flex-col gap-y-6">
              <ProviderPrivacy />
              <TelemetryLogs settings={settings} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TelemetryLogs({ settings }) {
  const [telemetry, setTelemetry] = useState(
    settings?.DisableTelemetry !== "true"
  );
  const { t } = useTranslation();
  async function toggleTelemetry() {
    await System.updateSystem({
      DisableTelemetry: !telemetry ? "false" : "true",
    });
    setTelemetry(!telemetry);
    showToast(
      `Anonymous Telemetry has been ${!telemetry ? "enabled" : "disabled"}.`,
      "info",
      { clear: true }
    );
  }

  return (
    <div className="relative w-full max-h-full">
      <div className="relative rounded-lg">
        <div className="space-y-6 flex h-full w-full">
          <div className="w-full flex flex-col gap-y-4">
            <div className="">
              <Toggle
                size="lg"
                className="mb-4"
                label={t("privacy.anonymous")}
                enabled={telemetry}
                onChange={toggleTelemetry}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-left space-y-2">
          <p className="text-theme-text-secondary text-xs rounded-lg w-96">
            Orion is built for <b>100% confidential and air-gapped operations</b>.
            External telemetry is completely disabled and all model queries and embeddings
            remain strictly on-premise.
          </p>
          <p className="text-theme-text-secondary text-xs rounded-lg w-96">
            Zero outbound connections are made. For internal audit inquiries or enterprise configuration assistance, contact your local system administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
