import React, { useEffect, useRef, useState } from "react";
import paths from "@/utils/paths";
import useLogo from "@/hooks/useLogo";
import {
  House,
  List,
  Gear,
  UserCircleGear,
  PencilSimpleLine,
  Nut,
  Toolbox,
  ArrowLeft,
  MagnifyingGlass,
  X,
  SquaresFour,
} from "@phosphor-icons/react";
import AgentIcon from "@/media/animations/agent-static.png";
import useUser from "@/hooks/useUser";
import { isMobile } from "react-device-detect";
import Footer from "../Footer";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import showToast from "@/utils/toast";
import System from "@/models/system";
import Option from "./MenuOption";
import { CanViewChatHistoryProvider } from "../CanViewChatHistory";
import useAppVersion from "@/hooks/useAppVersion";
import OrionBrand from "@/components/OrionBrand";

export default function SettingsSidebar() {
  const { t } = useTranslation();
  const { logo } = useLogo();
  const { user } = useUser();
  const sidebarRef = useRef(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showBgOverlay, setShowBgOverlay] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    function handleBg() {
      if (showSidebar) {
        setTimeout(() => {
          setShowBgOverlay(true);
        }, 300);
      } else {
        setShowBgOverlay(false);
      }
    }
    handleBg();
  }, [showSidebar]);

  if (isMobile) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-10 flex justify-between items-center px-4 py-2 bg-theme-bg-sidebar light:bg-white text-theme-text-secondary shadow-lg h-16">
          <button
            onClick={() => setShowSidebar(true)}
            className="rounded-md p-2 flex items-center justify-center text-theme-text-secondary"
          >
            <List className="h-6 w-6" />
          </button>
          <div className="flex items-center justify-center flex-grow">
            <OrionBrand to={paths.dashboard()} size="md" />
          </div>
          <Link
            to={paths.dashboard()}
            className="p-2 text-theme-text-secondary hover:text-white"
            title="Dashboard"
          >
            <House className="h-5 w-5" />
          </Link>
        </div>
        <div
          style={{
            transform: showSidebar ? `translateX(0vw)` : `translateX(-100vw)`,
          }}
          className={`z-99 fixed top-0 left-0 transition-all duration-500 w-[100vw] h-[100vh]`}
        >
          <div
            className={`${
              showBgOverlay
                ? "transition-all opacity-1"
                : "transition-none opacity-0"
            } duration-500 fixed top-0 left-0 bg-theme-bg-secondary bg-opacity-75 w-screen h-screen`}
            onClick={() => setShowSidebar(false)}
          />
          <div
            ref={sidebarRef}
            className="h-[100vh] fixed top-0 left-0 rounded-r-[26px] bg-theme-bg-sidebar w-[85%] max-w-[320px] p-4 flex flex-col"
          >
            <div className="w-full h-full flex flex-col overflow-x-hidden justify-between">
              {/* Header Information */}
              <div className="flex w-full items-center justify-between pb-3 border-b border-theme-sidebar-border/20">
                <OrionBrand to={paths.dashboard()} size="lg" />
                <Link
                  to={paths.dashboard()}
                  className="p-2 rounded-lg text-theme-text-secondary hover:text-white bg-theme-action-menu-bg"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </div>

              {/* Mobile Filter */}
              <div className="py-3">
                <div className="relative flex items-center">
                  <MagnifyingGlass
                    size={14}
                    className="absolute left-3 text-theme-text-secondary"
                  />
                  <input
                    type="text"
                    placeholder="Filter settings..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full pl-8 pr-6 py-1.5 bg-theme-settings-input-bg rounded-md text-xs text-theme-text-primary"
                  />
                </div>
              </div>

              {/* Primary Body */}
              <div className="flex-1 overflow-y-auto space-y-1">
                <SidebarOptions user={user} t={t} searchFilter={searchFilter} />
              </div>

              <div className="pt-3 border-t border-theme-sidebar-border/20">
                <div className="flex items-center justify-between text-xs text-theme-text-secondary pb-2">
                  <SupportEmail />
                  <AppVersion />
                </div>
                <Footer />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      ref={sidebarRef}
      className="w-72 shrink-0 h-screen flex flex-col bg-theme-bg-sidebar border-r border-theme-sidebar-border/30 select-none z-20"
    >
      {/* Brand & Top Bar */}
      <div className="p-4 border-b border-theme-sidebar-border/20 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <OrionBrand to={paths.dashboard()} size="md" />
          <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
            {user?.role ? user.role.toUpperCase() : "CONSOLE"}
          </span>
        </div>
        <Link
          to={paths.dashboard()}
          className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg text-xs font-medium text-theme-text-secondary hover:text-white bg-theme-action-menu-bg/40 hover:bg-theme-action-menu-bg border border-white/5 transition-all shadow-sm group"
        >
          <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* Quick Search / Filter Bar */}
      <div className="px-3 pt-3 pb-2 border-b border-theme-sidebar-border/10">
        <div className="relative flex items-center">
          <MagnifyingGlass
            size={13}
            className="absolute left-2.5 text-theme-text-secondary pointer-events-none"
          />
          <input
            type="text"
            placeholder="Filter settings..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-7 pr-6 py-1.5 bg-theme-settings-input-bg/70 border border-white/10 rounded-md text-xs text-theme-text-primary placeholder:text-theme-text-secondary/60 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter("")}
              className="absolute right-2 text-theme-text-secondary hover:text-white"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Navigation Items */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        <SidebarOptions user={user} t={t} searchFilter={searchFilter} />
      </div>

      {/* Bottom Status & Links */}
      <div className="p-3 border-t border-theme-sidebar-border/20 bg-theme-bg-sidebar/90 flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400 font-medium">Zero-Egress Active</span>
          </div>
          <AppVersion />
        </div>
        <div className="flex items-center justify-between text-xs text-theme-text-secondary px-1 pt-1 border-t border-white/5">
          <SupportEmail />
          <Link
            hidden={user?.hasOwnProperty("role") && user.role !== "admin"}
            to={paths.settings.privacy()}
            className="text-theme-text-secondary hover:text-white text-[11px] transition-colors"
          >
            {t("settings.privacy")}
          </Link>
        </div>
        <div className="pt-1">
          <Footer />
        </div>
      </div>
    </div>
  );
}

function SupportEmail() {
  const [supportEmail, setSupportEmail] = useState("mailto:admin@sovereign.local");
  const { t } = useTranslation();

  useEffect(() => {
    const fetchSupportEmail = async () => {
      const supportEmail = await System.fetchSupportEmail();
      setSupportEmail(
        supportEmail?.email
          ? `mailto:${supportEmail.email}`
          : "mailto:admin@sovereign.local"
      );
    };
    fetchSupportEmail();
  }, []);

  return (
    <a
      href={supportEmail}
      className="text-theme-text-secondary hover:text-white hover:light:text-theme-text-primary text-xs leading-[18px] transition-colors"
    >
      {t("settings.contact")}
    </a>
  );
}

const SidebarOptions = ({ user = null, t, searchFilter = "" }) => (
  <CanViewChatHistoryProvider>
    {({ viewable: canViewChatHistory }) => (
      <>
        <Option
          btnText={t("settings.overview") || "Overview"}
          icon={<SquaresFour className="h-5 w-5 flex-shrink-0" />}
          href={paths.settings.home()}
          user={user}
          flex={true}
          roles={["admin", "manager"]}
          searchFilter={searchFilter}
        />
        <Option
          btnText={t("settings.ai-providers")}
          icon={<Gear className="h-5 w-5 flex-shrink-0" />}
          user={user}
          searchFilter={searchFilter}
          childOptions={[
            {
              btnText: t("settings.llm"),
              href: paths.settings.llmPreference(),
              flex: true,
              roles: ["admin"],
            },
            {
              btnText: t("settings.vector-database"),
              href: paths.settings.vectorDatabase(),
              flex: true,
              roles: ["admin"],
            },
            {
              btnText: t("settings.embedder"),
              href: paths.settings.embedder.modelPreference(),
              flex: true,
              roles: ["admin"],
            },
            {
              btnText: t("settings.text-splitting"),
              href: paths.settings.embedder.chunkingPreference(),
              flex: true,
              roles: ["admin"],
            },
            {
              btnText: t("settings.image-generation"),
              href: paths.settings.imageGenerationPreference(),
              flex: true,
              roles: ["admin"],
            },
            {
              btnText: t("settings.voice-speech"),
              href: paths.settings.audioPreference(),
              flex: true,
              roles: ["admin"],
            },
            {
              btnText: t("settings.transcription"),
              href: paths.settings.transcriptionPreference(),
              flex: true,
              roles: ["admin"],
            },
            {
              btnText: t("settings.model-router"),
              href: paths.settings.modelRouters(),
              flex: true,
              roles: ["admin"],
            },
          ]}
        />
        <Option
          btnText={t("settings.admin")}
          icon={<UserCircleGear className="h-5 w-5 flex-shrink-0" />}
          user={user}
          searchFilter={searchFilter}
          childOptions={[
            {
              btnText: t("settings.users"),
              href: paths.settings.users(),
              roles: ["admin", "manager"],
            },
            {
              btnText: t("settings.workspaces"),
              href: paths.settings.workspaces(),
              roles: ["admin", "manager"],
            },
            {
              hidden: !canViewChatHistory,
              btnText: t("settings.workspace-chats"),
              href: paths.settings.chats(),
              flex: true,
              roles: ["admin", "manager"],
            },
            {
              btnText: t("settings.invites"),
              href: paths.settings.invites(),
              roles: ["admin", "manager"],
            },
            {
              btnText: "Default System Prompt",
              href: paths.settings.defaultSystemPrompt(),
              flex: true,
              roles: ["admin"],
            },
          ]}
        />
        <Option
          btnText={t("settings.agent-skills")}
          icon={
            <img
              src={AgentIcon}
              alt="Agent"
              className="h-5 w-5 flex-shrink-0 light:invert"
            />
          }
          href={paths.settings.agentSkills()}
          user={user}
          flex={true}
          roles={["admin"]}
          searchFilter={searchFilter}
        />
        <Option
          btnText={t("settings.customization")}
          icon={<PencilSimpleLine className="h-5 w-5 flex-shrink-0" />}
          user={user}
          searchFilter={searchFilter}
          childOptions={[
            {
              btnText: t("settings.interface"),
              href: paths.settings.interface(),
              flex: true,
              roles: ["admin", "manager"],
            },
            {
              btnText: t("settings.branding"),
              href: paths.settings.branding(),
              flex: true,
              roles: ["admin", "manager"],
            },
            {
              btnText: t("settings.chat"),
              href: paths.settings.chat(),
              flex: true,
              roles: ["admin", "manager"],
            },
          ]}
        />
        <Option
          btnText={t("settings.tools")}
          icon={<Toolbox className="h-5 w-5 flex-shrink-0" />}
          user={user}
          searchFilter={searchFilter}
          childOptions={[
            {
              hidden: !canViewChatHistory,
              btnText: t("settings.embeds"),
              href: paths.settings.embedChatWidgets(),
              flex: true,
              roles: ["admin"],
            },
            {
              btnText: t("settings.event-logs"),
              href: paths.settings.logs(),
              flex: true,
              roles: ["admin"],
            },
            {
              btnText: t("settings.api-keys"),
              href: paths.settings.apiKeys(),
              flex: true,
              roles: ["admin"],
            },
            {
              btnText: t("settings.system-prompt-variables"),
              href: paths.settings.systemPromptVariables(),
              flex: true,
              roles: ["admin"],
            },
            {
              btnText: t("settings.browser-extension"),
              href: paths.settings.browserExtension(),
              flex: true,
              roles: ["admin", "manager"],
            },
          ]}
        />
        <Option
          btnText={t("settings.security")}
          icon={<Nut className="h-5 w-5 flex-shrink-0" />}
          href={paths.settings.security()}
          user={user}
          flex={true}
          roles={["admin", "manager"]}
          hidden={user?.role}
          searchFilter={searchFilter}
        />
      </>
    )}
  </CanViewChatHistoryProvider>
);

function AppVersion() {
  const { version, isLoading } = useAppVersion();
  if (isLoading) return null;
  return (
    <span className="text-theme-text-secondary light:opacity-80 opacity-50 text-xs mx-3">
      Orion v{version}
    </span>
  );
}
