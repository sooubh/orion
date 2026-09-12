import React, { useEffect, useState } from "react";
import Sidebar from "@/components/SettingsSidebar";
import paths from "@/utils/paths";
import useUser from "@/hooks/useUser";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import System from "@/models/system";
import {
  Cpu,
  ShieldCheck,
  UserCircleGear,
  PencilSimpleLine,
  Toolbox,
  ArrowRight,
  Database,
  Key,
  Users,
  ChatCircleDots,
  Sliders,
  Sparkle,
  HardDrives,
  SpeakerHigh,
  Microphone,
  GitFork,
  PaintBrush,
  Code,
  ListBullets,
  FileCode,
  Browser,
  LockKey,
} from "@phosphor-icons/react";
import OrionBrand from "@/components/OrionBrand";

export default function GeneralSettingsHub() {
  const { t } = useTranslation();
  const { user } = useUser();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const keys = await System.keys();
        setSettings(keys || {});
      } catch (err) {
        console.error("Failed to fetch system keys:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const clusters = [
    {
      id: "ai-engine",
      title: t("settings.ai-providers") || "AI & Intelligence Core",
      badge: settings?.LLMProvider ? `${settings.LLMProvider.toUpperCase()}` : "LOCAL ENGINE",
      badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      description: "Manage neural model providers, vector storage indexes, embeddings, and intelligent routing rules.",
      icon: <Cpu size={24} weight="duotone" className="text-indigo-400" />,
      items: [
        { label: "LLM Preferences", path: paths.settings.llmPreference(), icon: <Cpu size={16} />, desc: "Configure local LLMs & reasoning engines" },
        { label: "Vector Database", path: paths.settings.vectorDatabase(), icon: <Database size={16} />, desc: "Configure LanceDB, Chroma, or PGVector" },
        { label: "Embeddings", path: paths.settings.embedder.modelPreference(), icon: <Sparkle size={16} />, desc: "Document embedding model setup" },
        { label: "Model Routers", path: paths.settings.modelRouters(), icon: <GitFork size={16} />, desc: "Dynamic conditional model routing" },
        { label: "Voice & Speech", path: paths.settings.audioPreference(), icon: <SpeakerHigh size={16} />, desc: "Text-to-speech output synthesis" },
        { label: "Transcription", path: paths.settings.transcriptionPreference(), icon: <Microphone size={16} />, desc: "Speech-to-text audio ingestion" },
      ],
      adminOnly: true,
    },
    {
      id: "security",
      title: "Security & Sovereign Air-Gap",
      badge: "ZERO-EGRESS ACTIVE",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      description: "Ensure sovereign data isolation, multi-user access boundaries, and credential safeguards.",
      icon: <ShieldCheck size={24} weight="duotone" className="text-emerald-400" />,
      items: [
        { label: "Security Center", path: paths.settings.security(), icon: <ShieldCheck size={16} />, desc: "Air-gap isolation & password protection" },
        { label: "Privacy & Telemetry", path: paths.settings.privacy(), icon: <LockKey size={16} />, desc: "Local audit logs & data handling policy" },
        { label: "System API Keys", path: paths.settings.apiKeys(), icon: <Key size={16} />, desc: "Manage developer tokens and API access" },
      ],
      adminOnly: false,
    },
    {
      id: "admin",
      title: t("settings.admin") || "Administration & Team",
      badge: "ACCESS CONTROL",
      badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      description: "Administer user permissions, allocate workspaces, manage invitations, and set default instructions.",
      icon: <UserCircleGear size={24} weight="duotone" className="text-amber-400" />,
      items: [
        { label: "User Management", path: paths.settings.users(), icon: <Users size={16} />, desc: "Configure seats, roles, and credentials" },
        { label: "Workspace Controls", path: paths.settings.workspaces(), icon: <HardDrives size={16} />, desc: "Manage team workspaces and quotas" },
        { label: "Chat History", path: paths.settings.chats(), icon: <ChatCircleDots size={16} />, desc: "Audit and review workspace conversation logs" },
        { label: "Invitations", path: paths.settings.invites(), icon: <Key size={16} />, desc: "Generate secure user onboarding links" },
        { label: "System Prompt", path: paths.settings.defaultSystemPrompt(), icon: <Sliders size={16} />, desc: "Default instructions applied to new chats" },
      ],
      adminOnly: false,
    },
    {
      id: "customization",
      title: t("settings.customization") || "Interface & Branding",
      badge: "EXPERIENCE",
      badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      description: "Customize the Orion theme, constellations, typography, custom logos, and chat interaction styles.",
      icon: <PencilSimpleLine size={24} weight="duotone" className="text-cyan-400" />,
      items: [
        { label: "Interface & Theme", path: paths.settings.interface(), icon: <PaintBrush size={16} />, desc: "Theme palette and language locale" },
        { label: "Branding & Logos", path: paths.settings.branding(), icon: <Sparkle size={16} />, desc: "Custom logo assets and footer links" },
        { label: "Chat Preferences", path: paths.settings.chat(), icon: <ChatCircleDots size={16} />, desc: "Message rendering, streaming, and shortcuts" },
      ],
      adminOnly: false,
    },
    {
      id: "tools",
      title: t("settings.tools") || "Developer Tools & Extensions",
      badge: "INTEGRATIONS",
      badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      description: "Configure autonomous agent skills, embeddable chat widgets, event telemetry, and browser tools.",
      icon: <Toolbox size={24} weight="duotone" className="text-purple-400" />,
      items: [
        { label: "Agent Skills", path: paths.settings.agentSkills(), icon: <Code size={16} />, desc: "Local skill execution and tool definitions" },
        { label: "Chat Embeds", path: paths.settings.embedChatWidgets(), icon: <FileCode size={16} />, desc: "Generate standalone embeddable chat snippets" },
        { label: "Event & Audit Logs", path: paths.settings.logs(), icon: <ListBullets size={16} />, desc: "System event audit trail and diagnostics" },
        { label: "Prompt Variables", path: paths.settings.systemPromptVariables(), icon: <Sliders size={16} />, desc: "Dynamic variables for system prompts" },
        { label: "Browser Extension", path: paths.settings.browserExtension(), icon: <Browser size={16} />, desc: "API key for Orion browser integration" },
      ],
      adminOnly: false,
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <Sidebar />
      <div className="flex-1 h-screen overflow-y-auto bg-theme-bg-secondary p-6 md:p-10 space-y-8">
        {/* Executive Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <OrionBrand size="xl" />
              <span className="text-zinc-600 font-light">/</span>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-theme-text-primary">
                System Settings
              </h1>
            </div>
            <p className="text-sm text-theme-text-secondary max-w-2xl">
              Central management console for neural AI models, sovereign air-gap isolation, security parameters, and platform customizations.
            </p>
          </div>

          {/* Telemetry Pills */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Air-Gapped (100% Local)</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-medium">
              <span>DB: SQLite (orion.db)</span>
            </div>
          </div>
        </div>

        {/* Settings Clusters Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {clusters.map((cluster) => {
            if (cluster.adminOnly && user?.role && user.role !== "admin") return null;

            return (
              <div
                key={cluster.id}
                className="flex flex-col justify-between rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 hover:border-theme-sidebar-border/60 p-6 transition-all duration-200 shadow-sm"
              >
                <div>
                  {/* Cluster Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-theme-action-menu-bg/40 border border-white/5 shrink-0">
                        {cluster.icon}
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-theme-text-primary">
                          {cluster.title}
                        </h2>
                        <span className={`text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full border inline-block mt-1 font-semibold ${cluster.badgeColor}`}>
                          {cluster.badge}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-theme-text-secondary mb-5 leading-relaxed">
                    {cluster.description}
                  </p>

                  {/* Sub-item Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {cluster.items.map((item, idx) => (
                      <Link
                        key={idx}
                        to={item.path}
                        className="flex flex-col p-3 rounded-xl bg-theme-action-menu-bg/20 hover:bg-theme-action-menu-bg/60 border border-white/5 hover:border-white/10 transition-all duration-200 group"
                      >
                        <div className="flex items-center justify-between text-xs font-medium text-theme-text-primary group-hover:text-indigo-300 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-theme-text-secondary group-hover:text-indigo-400 transition-colors">
                              {item.icon}
                            </span>
                            <span>{item.label}</span>
                          </div>
                          <ArrowRight
                            size={12}
                            className="text-theme-text-secondary/40 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all"
                          />
                        </div>
                        <p className="text-[11px] text-theme-text-secondary/70 line-clamp-1">
                          {item.desc}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
