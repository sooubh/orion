import React, { useEffect, useState, useRef } from "react";
import { isMobile } from "react-device-detect";
import Sidebar from "@/components/SettingsSidebar";
import System from "@/models/system";
import showToast from "@/utils/toast";
import PreLoader from "@/components/Preloader";
import GenericOpenAiLogo from "@/media/llmprovider/generic-openai.png";
import OrionIcon from "@/media/logo/sovereign-ai.svg";
import GenericOpenAiWhisperOptions from "@/components/TranscriptionSelection/GenericOpenAiOptions";
import NativeTranscriptionOptions from "@/components/TranscriptionSelection/NativeTranscriptionOptions";
import LLMItem from "@/components/LLMSelection/LLMItem";
import { CaretUpDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import CTAButton from "@/components/lib/CTAButton";
import { useTranslation } from "react-i18next";

const PROVIDERS = [
  {
    name: "Orion Built-In Whisper",
    value: "local",
    logo: OrionIcon,
    options: (settings) => <NativeTranscriptionOptions settings={settings} />,
    description: "Run a built-in whisper model on this instance privately.",
  },
  {
    name: "OpenAI Compatible",
    value: "generic-openai",
    logo: GenericOpenAiLogo,
    options: (settings) => <GenericOpenAiWhisperOptions settings={settings} />,
    description:
      "Transcribe audio using any local OpenAI-compatible API via custom configuration.",
  },
];

export default function TranscriptionModelPreference() {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const searchInputRef = useRef(null);
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = { WhisperProvider: selectedProvider };
    const formData = new FormData(form);

    for (var [key, value] of formData.entries()) data[key] = value;
    const { error } = await System.updateSystem(data);
    setSaving(true);

    if (error) {
      showToast(`Failed to save preferences: ${error}`, "error");
    } else {
      showToast("Transcription preferences saved successfully.", "success");
    }
    setSaving(false);
    setHasChanges(!!error);
  };

  const updateProviderChoice = (selection) => {
    setSearchQuery("");
    setSelectedProvider(selection);
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
      setSelectedProvider(_settings?.WhisperProvider || "local");
      setLoading(false);
    }
    fetchKeys();
  }, []);

  useEffect(() => {
    const filtered = PROVIDERS.filter((provider) =>
      provider.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredProviders(filtered);
  }, [searchQuery, selectedProvider]);

  const selectedProviderObject = PROVIDERS.find(
    (provider) => provider.value === selectedProvider
  );

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <Sidebar />
      {loading ? (
        <div
          style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
          className="relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
        >
          <div className="w-full h-full flex justify-center items-center">
            <PreLoader />
          </div>
        </div>
      ) : (
        <div
          style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
          className="relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-auto modern-scrollbar p-4 md:p-8"
        >
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
                    {t("transcription.title")}
                  </h1>
                  <p className="text-xs text-zinc-400">
                    {t("transcription.description")}
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
                    {t("transcription.provider")}
                  </label>
                  <p className="text-xs text-zinc-400">
                    Select the audio transcription provider for speech recognition.
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
                          src={selectedProviderObject.logo}
                          alt={`${selectedProviderObject.name} logo`}
                          className="w-7 h-7 rounded object-contain"
                        />
                      </div>
                      <div className="flex flex-col text-left truncate">
                        <div className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                          {selectedProviderObject.name}
                        </div>
                        <div className="text-xs text-zinc-400 truncate">
                          {selectedProviderObject.description}
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
                            name="provider-search"
                            autoComplete="off"
                            placeholder="Search audio transcription providers..."
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
                          {filteredProviders.map((provider) => (
                            <LLMItem
                              key={provider.name}
                              name={provider.name}
                              value={provider.value}
                              image={provider.logo}
                              description={provider.description}
                              checked={selectedProvider === provider.value}
                              onClick={() => updateProviderChoice(provider.value)}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Provider Options Card */}
              <div
                onChange={() => setHasChanges(true)}
                className="p-5 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-4"
              >
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  {selectedProviderObject.name} Configuration
                </h3>
                {selectedProvider &&
                  PROVIDERS.find(
                    (provider) => provider.value === selectedProvider
                  )?.options(settings)}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
