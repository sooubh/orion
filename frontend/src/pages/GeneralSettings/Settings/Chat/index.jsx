import Sidebar from "@/components/SettingsSidebar";
import { isMobile } from "react-device-detect";
import { useTranslation } from "react-i18next";
import AutoSubmit from "../components/AutoSubmit";
import AutoSpeak from "../components/AutoSpeak";
import SpellCheck from "../components/SpellCheck";
import ShowScrollbar from "../components/ShowScrollbar";
import AutoScroll from "../components/AutoScroll";
import ChatRenderHTML from "../components/ChatRenderHTML";

export default function ChatSettings() {
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
              {t("customization.chat.title")}
            </h1>
            <p className="text-xs text-zinc-400">
              {t("customization.chat.description")}
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 divide-y divide-white/5 [&_.my-4]:my-0 space-y-4 [&>div]:pt-4 [&>div:first-child]:pt-0">
            <div><AutoSubmit /></div>
            <div><AutoSpeak /></div>
            <div><SpellCheck /></div>
            <div><ShowScrollbar /></div>
            <div><AutoScroll /></div>
            <div><ChatRenderHTML /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
