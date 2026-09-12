import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Sidebar from "@/components/SettingsSidebar";
import { isMobile } from "react-device-detect";
import System from "@/models/system";
import showToast from "@/utils/toast";
import OrionIcon from "@/media/logo/orion.svg";
import GenericOpenAiLogo from "@/media/llmprovider/generic-openai.png";
import OllamaLogo from "@/media/llmprovider/ollama.png";
import LMStudioLogo from "@/media/llmprovider/lmstudio.png";
import LocalAiLogo from "@/media/llmprovider/localai.png";
import KoboldCPPLogo from "@/media/llmprovider/koboldcpp.png";
import TextGenWebUILogo from "@/media/llmprovider/text-generation-webui.png";
import NvidiaNimLogo from "@/media/llmprovider/nvidia-nim.png";
import FoundryLogo from "@/media/llmprovider/foundry-local.png";
import DockerModelRunnerLogo from "@/media/llmprovider/docker-model-runner.png";
import PrivateModeLogo from "@/media/llmprovider/privatemode.png";
import LemonadeLogo from "@/media/llmprovider/lemonade.png";
import OMLXLogo from "@/media/llmprovider/omlx.png";

import PreLoader from "@/components/Preloader";
import ModelRouterOptions from "@/components/LLMSelection/ModelRouterOptions";
import GenericOpenAiOptions from "@/components/LLMSelection/GenericOpenAiOptions";
import LMStudioOptions from "@/components/LLMSelection/LMStudioOptions";
import LocalAiOptions from "@/components/LLMSelection/LocalAiOptions";
import OllamaLLMOptions from "@/components/LLMSelection/OllamaLLMOptions";
import KoboldCPPOptions from "@/components/LLMSelection/KoboldCPPOptions";
import TextGenWebUIOptions from "@/components/LLMSelection/TextGenWebUIOptions";
import NvidiaNimOptions from "@/components/LLMSelection/NvidiaNimOptions";
import FoundryOptions from "@/components/LLMSelection/FoundryOptions";
import DockerModelRunnerOptions from "@/components/LLMSelection/DockerModelRunnerOptions";
import PrivateModeOptions from "@/components/LLMSelection/PrivateModeOptions";
import LemonadeOptions from "@/components/LLMSelection/LemonadeOptions";
import OMLXOptions from "@/components/LLMSelection/OMLXOptions";

import LLMItem from "@/components/LLMSelection/LLMItem";
import { CaretUpDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import CTAButton from "@/components/lib/CTAButton";

export const MODEL_ROUTER_PROVIDER = {
  name: "Orion Model Router",
  value: "orion-router",
  logo: OrionIcon,
  options: (settings) => <ModelRouterOptions settings={settings} />,
  description:
    "Route messages to different local LLM providers based on rules you define.",
  requiredConfig: [],
};

/**
 * All 100% Offline / Local LLM providers that are available to the user.
 * This **never** includes the model router provider.
 */
export const AVAILABLE_LLM_PROVIDERS = [
  {
    name: "Ollama",
    value: "ollama",
    logo: OllamaLogo,
    options: (settings) => <OllamaLLMOptions settings={settings} />,
    description: "Run LLMs 100% locally on your machine.",
    requiredConfig: ["OllamaLLMBasePath"],
  },
  {
    name: "LM Studio",
    value: "lmstudio",
    logo: LMStudioLogo,
    options: (settings) => <LMStudioOptions settings={settings} />,
    description:
      "Run thousands of open-source models offline in LM Studio.",
    requiredConfig: ["LMStudioBasePath"],
  },
  {
    name: "Local AI",
    value: "localai",
    logo: LocalAiLogo,
    options: (settings) => <LocalAiOptions settings={settings} />,
    description: "Run LLMs locally on CPU and GPU.",
    requiredConfig: ["LocalAiApiKey", "LocalAiBasePath", "LocalAiTokenLimit"],
  },
  {
    name: "Generic OpenAI (Local)",
    value: "generic-openai",
    logo: GenericOpenAiLogo,
    options: (settings) => <GenericOpenAiOptions settings={settings} />,
    description:
      "Connect to any local OpenAI-compatible server (vLLM, TGI, Jan, etc.).",
    requiredConfig: ["GenericOpenAiBasePath", "GenericOpenAiModelPref"],
    connectionConfig: ["GenericOpenAiBasePath"],
  },
  {
    name: "Lemonade",
    value: "lemonade",
    logo: LemonadeLogo,
    options: (settings) => <LemonadeOptions settings={settings} />,
    description:
      "Run local LLMs, ASR, and TTS in a unified offline AI runtime.",
    requiredConfig: ["LemonadeLLMBasePath"],
  },
  {
    name: "KoboldCPP",
    value: "koboldcpp",
    logo: KoboldCPPLogo,
    options: (settings) => <KoboldCPPOptions settings={settings} />,
    description: "Run local GGUF models offline using KoboldCPP.",
    requiredConfig: [
      "KoboldCPPModelPref",
      "KoboldCPPBasePath",
      "KoboldCPPTokenLimit",
    ],
  },
  {
    name: "Oobabooga Web UI",
    value: "textgenwebui",
    logo: TextGenWebUILogo,
    options: (settings) => <TextGenWebUIOptions settings={settings} />,
    description: "Run local LLMs using Text Generation Web UI.",
    requiredConfig: ["TextGenWebUIBasePath", "TextGenWebUITokenLimit"],
  },
  {
    name: "NVIDIA NIM (Local)",
    value: "nvidia-nim",
    logo: NvidiaNimLogo,
    options: (settings) => <NvidiaNimOptions settings={settings} />,
    description:
      "Run full parameter LLMs directly on your local NVIDIA RTX GPU.",
    requiredConfig: ["NvidiaNimLLMBasePath"],
  },
  {
    name: "Docker Model Runner",
    value: "docker-model-runner",
    logo: DockerModelRunnerLogo,
    options: (settings) => <DockerModelRunnerOptions settings={settings} />,
    description: "Run local LLMs using Docker Model Runner.",
    requiredConfig: [
      "DockerModelRunnerBasePath",
      "DockerModelRunnerModelPref",
      "DockerModelRunnerModelTokenLimit",
    ],
  },
  {
    name: "Microsoft Foundry Local",
    value: "foundry",
    logo: FoundryLogo,
    options: (settings) => <FoundryOptions settings={settings} />,
    description: "Run Microsoft Foundry models locally.",
    requiredConfig: [
      "FoundryBasePath",
      "FoundryModelPref",
      "FoundryModelTokenLimit",
    ],
  },
  {
    name: "oMLX (Apple Silicon)",
    value: "omlx",
    logo: OMLXLogo,
    options: (settings) => <OMLXOptions settings={settings} />,
    description: "Run MLX models on Apple Silicon with smart local caching.",
    requiredConfig: ["OMLXLLMBasePath"],
  },
  {
    name: "Privatemode",
    value: "privatemode",
    logo: PrivateModeLogo,
    options: (settings) => <PrivateModeOptions settings={settings} />,
    description: "Run LLMs with private local execution.",
    requiredConfig: ["PrivateModeBasePath"],
  },
];

/**
 * All LLM providers that are available to the user.
 * This **always** includes the model router provider.
 */
export const ALL_LLM_PROVIDERS = [
  MODEL_ROUTER_PROVIDER,
  ...AVAILABLE_LLM_PROVIDERS,
];

export const LLM_PREFERENCE_CHANGED_EVENT = "llm-preference-changed";
export default function GeneralLLMPreference() {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredLLMs, setFilteredLLMs] = useState([]);
  const [selectedLLM, setSelectedLLM] = useState(null);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const searchInputRef = useRef(null);
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = { LLMProvider: selectedLLM };
    const formData = new FormData(form);

    for (var [key, value] of formData.entries()) data[key] = value;
    const { error } = await System.updateSystem(data);
    setSaving(true);

    if (error) {
      showToast(`Failed to save LLM settings: ${error}`, "error");
    } else {
      showToast("LLM preferences saved successfully.", "success");
    }
    setSaving(false);
    setHasChanges(!!error);
  };

  const updateLLMChoice = (selection) => {
    setSearchQuery("");
    setSelectedLLM(selection);
    setSearchMenuOpen(false);
    setHasChanges(true);
  };

  const handleXButton = () => {
    if (searchQuery.length > 0) {
      setSearchQuery("");
      if (searchInputRef.current) searchInputRef.current.value = "";
    } else {
      setSearchMenuOpen(!searchMenuOpen);
    }
  };

  useEffect(() => {
    async function fetchKeys() {
      const _settings = await System.keys();
      setSettings(_settings);
      setSelectedLLM(_settings?.LLMProvider);
      setLoading(false);
    }
    fetchKeys();
  }, []);

  // Some more complex LLM options do not bubble up the change event, so we need to listen to the custom event
  // we can emit from the LLM options component using window.dispatchEvent(new Event(LLM_PREFERENCE_CHANGED_EVENT));
  useEffect(() => {
    function updateHasChanges() {
      setHasChanges(true);
    }
    window.addEventListener(LLM_PREFERENCE_CHANGED_EVENT, updateHasChanges);
    return () => {
      window.removeEventListener(
        LLM_PREFERENCE_CHANGED_EVENT,
        updateHasChanges
      );
    };
  }, []);

  useEffect(() => {
    const filtered = AVAILABLE_LLM_PROVIDERS.filter((llm) =>
      llm.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredLLMs(filtered);
  }, [searchQuery, selectedLLM]);

  const selectedLLMObject = AVAILABLE_LLM_PROVIDERS.find(
    (llm) => llm.value === selectedLLM
  );
  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <Sidebar />
      {loading ? (
        <div className="flex-1 h-screen flex justify-center items-center bg-theme-bg-secondary">
          <PreLoader />
        </div>
      ) : (
        <div className="flex-1 h-screen overflow-y-auto bg-theme-bg-secondary p-6 md:p-10">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="flex flex-col gap-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                    <span>Settings</span>
                    <span>/</span>
                    <span className="text-indigo-400">AI & Intelligence</span>
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">
                    {t("llm.title")}
                  </h1>
                  <p className="text-xs text-zinc-400">
                    {t("llm.description")}
                  </p>
                </div>
                {hasChanges && (
                  <CTAButton
                    onClick={() => handleSubmit()}
                    className="shadow-lg animate-pulse shrink-0"
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </CTAButton>
                )}
              </div>

              {/* Provider Selector Card */}
              <div className="p-5 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1">
                    {t("llm.provider")}
                  </label>
                  <p className="text-xs text-zinc-400">
                    Choose the primary AI intelligence provider for this instance.
                  </p>
                </div>

                <div className="relative max-w-xl">
                  <button
                    className="w-full h-16 bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-700/60 hover:border-indigo-500/50 rounded-xl flex items-center px-4 justify-between cursor-pointer transition-all shadow-sm group"
                    type="button"
                    onClick={() => setSearchMenuOpen(true)}
                  >
                    <div className="flex gap-x-3.5 items-center min-w-0">
                      <div className="w-10 h-10 rounded-lg p-1 bg-zinc-950 border border-white/10 flex items-center justify-center shrink-0">
                        <img
                          src={selectedLLMObject?.logo || OrionIcon}
                          alt={`${selectedLLMObject?.name} logo`}
                          className="w-7 h-7 rounded object-contain"
                        />
                      </div>
                      <div className="flex flex-col text-left truncate">
                        <div className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                          {selectedLLMObject?.name || "None selected"}
                        </div>
                        <div className="text-xs text-zinc-400 truncate">
                          {selectedLLMObject?.description || "Select an LLM provider"}
                        </div>
                      </div>
                    </div>
                    <CaretUpDown
                      size={18}
                      weight="bold"
                      className="text-zinc-400 group-hover:text-white shrink-0 ml-3 transition-colors"
                    />
                  </button>

                  {searchMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
                        onClick={() => setSearchMenuOpen(false)}
                      />
                      <div className="absolute top-0 left-0 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-40 overflow-hidden flex flex-col">
                        <div className="flex items-center px-3 py-2.5 bg-zinc-950 border-b border-zinc-800 gap-2">
                          <MagnifyingGlass
                            size={16}
                            className="text-zinc-400 shrink-0"
                          />
                          <input
                            type="text"
                            name="llm-search"
                            autoComplete="off"
                            placeholder="Search AI providers..."
                            className="bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none w-full py-1"
                            onChange={(e) => setSearchQuery(e.target.value)}
                            ref={searchInputRef}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleXButton}
                            className="p-1 text-zinc-400 hover:text-white transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <div className="p-2 space-y-1 overflow-y-auto max-h-64 modern-scrollbar">
                          {filteredLLMs.map((llm) => (
                            <LLMItem
                              key={llm.name}
                              name={llm.name}
                              value={llm.value}
                              image={llm.logo}
                              description={llm.description}
                              checked={selectedLLM === llm.value}
                              onClick={() => updateLLMChoice(llm.value)}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Provider-specific Options Card */}
              <div
                onChange={() => setHasChanges(true)}
                className="p-5 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-4"
              >
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  {selectedLLMObject?.name} Configuration
                </h3>
                {selectedLLM &&
                  AVAILABLE_LLM_PROVIDERS.find(
                    (llm) => llm.value === selectedLLM
                  )?.options?.(settings)}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
