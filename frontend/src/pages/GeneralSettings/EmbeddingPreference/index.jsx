import React, { useEffect, useState, useRef } from "react";
import Sidebar from "@/components/SettingsSidebar";
import { isMobile } from "react-device-detect";
import System from "@/models/system";
import showToast from "@/utils/toast";
import OrionIcon from "@/media/logo/sovereign-ai.svg";
import LocalAiLogo from "@/media/llmprovider/localai.png";
import OllamaLogo from "@/media/llmprovider/ollama.png";
import LMStudioLogo from "@/media/llmprovider/lmstudio.png";
import GenericOpenAiLogo from "@/media/llmprovider/generic-openai.png";
import LemonadeLogo from "@/media/llmprovider/lemonade.png";

import PreLoader from "@/components/Preloader";
import ChangeWarningModal from "@/components/ChangeWarning";
import LocalAiOptions from "@/components/EmbeddingSelection/LocalAiOptions";
import NativeEmbeddingOptions from "@/components/EmbeddingSelection/NativeEmbeddingOptions";
import OllamaEmbeddingOptions from "@/components/EmbeddingSelection/OllamaOptions";
import LMStudioEmbeddingOptions from "@/components/EmbeddingSelection/LMStudioOptions";
import GenericOpenAiEmbeddingOptions from "@/components/EmbeddingSelection/GenericOpenAiOptions";
import LemonadeOptions from "@/components/EmbeddingSelection/LemonadeOptions";

import EmbedderItem from "@/components/EmbeddingSelection/EmbedderItem";
import { CaretUpDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useModal } from "@/hooks/useModal";
import Modal from "@/components/lib/Modal";
import CTAButton from "@/components/lib/CTAButton";
import { useTranslation } from "react-i18next";

const EMBEDDERS = [
  {
    name: "Orion Native Embedder",
    value: "native",
    logo: OrionIcon,
    options: (settings) => <NativeEmbeddingOptions settings={settings} />,
    description: "Use the built-in embedding provider for Orion. Zero setup!",
  },
  {
    name: "Ollama",
    value: "ollama",
    logo: OllamaLogo,
    options: (settings) => <OllamaEmbeddingOptions settings={settings} />,
    description: "Run embedding models locally on your own machine.",
  },
  {
    name: "LM Studio",
    value: "lmstudio",
    logo: LMStudioLogo,
    options: (settings) => <LMStudioEmbeddingOptions settings={settings} />,
    description:
      "Discover, download, and run thousands of cutting edge LLMs in a few clicks.",
  },
  {
    name: "Local AI",
    value: "localai",
    logo: LocalAiLogo,
    options: (settings) => <LocalAiOptions settings={settings} />,
    description: "Run embedding models locally on your own machine.",
  },
  {
    name: "Lemonade",
    value: "lemonade",
    logo: LemonadeLogo,
    options: (settings) => <LemonadeOptions settings={settings} />,
    description:
      "Run embedding models locally on your own machine using Lemonade.",
  },
  {
    name: "Generic OpenAI",
    value: "generic-openai",
    logo: GenericOpenAiLogo,
    options: (settings) => (
      <GenericOpenAiEmbeddingOptions settings={settings} />
    ),
    description: "Run embedding models from any local OpenAI compatible API service.",
  },
];

export default function GeneralEmbeddingPreference() {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasEmbeddings, setHasEmbeddings] = useState(false);
  const [hasCachedEmbeddings, setHasCachedEmbeddings] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredEmbedders, setFilteredEmbedders] = useState([]);
  const [selectedEmbedder, setSelectedEmbedder] = useState(null);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const searchInputRef = useRef(null);
  const { isOpen, openModal, closeModal } = useModal();
  const { t } = useTranslation();

  function embedderModelChanged(formEl) {
    try {
      const newModel = new FormData(formEl).get("EmbeddingModelPref") ?? null;
      if (newModel === null) return false;
      return settings?.EmbeddingModelPref !== newModel;
    } catch (error) {
      console.error(error);
    }
    return false;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      (selectedEmbedder !== settings?.EmbeddingEngine ||
        embedderModelChanged(e.target)) &&
      hasChanges &&
      (hasEmbeddings || hasCachedEmbeddings)
    ) {
      openModal();
    } else {
      await handleSaveSettings();
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    const form = document.getElementById("embedding-form");
    const settingsData = {};
    const formData = new FormData(form);
    settingsData.EmbeddingEngine = selectedEmbedder;
    for (var [key, value] of formData.entries()) settingsData[key] = value;

    const { error } = await System.updateSystem(settingsData);
    if (error) {
      showToast(`Failed to save embedding settings: ${error}`, "error");
      setHasChanges(true);
    } else {
      showToast("Embedding preferences saved successfully.", "success");
      setHasChanges(false);
    }
    setSaving(false);
    closeModal();
  };

  const updateChoice = (selection) => {
    setSearchQuery("");
    setSelectedEmbedder(selection);
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
      setSelectedEmbedder(_settings?.EmbeddingEngine || "native");
      setHasEmbeddings(_settings?.HasExistingEmbeddings || false);
      setHasCachedEmbeddings(_settings?.HasCachedEmbeddings || false);
      setLoading(false);
    }
    fetchKeys();
  }, []);

  useEffect(() => {
    const filtered = EMBEDDERS.filter((embedder) =>
      embedder.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredEmbedders(filtered);
  }, [searchQuery, selectedEmbedder]);

  const selectedEmbedderObject = EMBEDDERS.find(
    (embedder) => embedder.value === selectedEmbedder
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
            <form
              id="embedding-form"
              onSubmit={handleSubmit}
              className="flex flex-col gap-y-6"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                    <span>Settings</span>
                    <span>/</span>
                    <span className="text-indigo-400">AI & Intelligence</span>
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">
                    {t("embedding.title")}
                  </h1>
                  <p className="text-xs text-zinc-400">
                    {t("embedding.desc-start")} {t("embedding.desc-end")}
                  </p>
                </div>
                {hasChanges && (
                  <CTAButton
                    onClick={() => handleSubmit()}
                    className="shadow-lg animate-pulse shrink-0"
                  >
                    {saving ? t("common.saving") : t("common.save")}
                  </CTAButton>
                )}
              </div>

              {/* Embedder Selector Card */}
              <div className="p-5 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1">
                    {t("embedding.provider.title")}
                  </label>
                  <p className="text-xs text-zinc-400">
                    Select the embedding provider for semantic search and document vectorization.
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
                          src={selectedEmbedderObject.logo}
                          alt={`${selectedEmbedderObject.name} logo`}
                          className="w-7 h-7 rounded object-contain"
                        />
                      </div>
                      <div className="flex flex-col text-left truncate">
                        <div className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                          {selectedEmbedderObject.name}
                        </div>
                        <div className="text-xs text-zinc-400 truncate">
                          {selectedEmbedderObject.description}
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
                            name="embedder-search"
                            autoComplete="off"
                            placeholder="Search embedding providers..."
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
                          {filteredEmbedders.map((embedder) => (
                            <EmbedderItem
                              key={embedder.name}
                              name={embedder.name}
                              value={embedder.value}
                              image={embedder.logo}
                              description={embedder.description}
                              checked={selectedEmbedder === embedder.value}
                              onClick={() => updateChoice(embedder.value)}
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
                  {selectedEmbedderObject.name} Configuration
                </h3>
                {selectedEmbedder &&
                  EMBEDDERS.find(
                    (embedder) => embedder.value === selectedEmbedder
                  )?.options(settings)}
              </div>
            </form>
          </div>
        </div>
      )}
      <Modal isOpen={isOpen} onClose={closeModal} size="lg">
        <ChangeWarningModal
          warningText="Switching the embedding model will reset all previously embedded documents in all workspaces.\n\nConfirming will clear all embeddings from your vector database and remove all documents from your workspaces. Your uploaded documents will not be deleted, they will be available for re-embedding."
          onClose={closeModal}
          onConfirm={handleSaveSettings}
        />
      </Modal>
    </div>
  );
}
