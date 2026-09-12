import React, { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/SettingsSidebar";
import { isMobile } from "react-device-detect";
import System from "@/models/system";
import showToast from "@/utils/toast";
import { useModal } from "@/hooks/useModal";
import CTAButton from "@/components/lib/CTAButton";
import { CaretUpDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import PreLoader from "@/components/Preloader";
import ChangeWarningModal from "@/components/ChangeWarning";
import Modal from "@/components/lib/Modal";
import VectorDBItem from "@/components/VectorDBSelection/VectorDBItem";

import LanceDbLogo from "@/media/vectordbs/lancedb.png";
import ChromaLogo from "@/media/vectordbs/chroma.png";
import WeaviateLogo from "@/media/vectordbs/weaviate.png";
import QDrantLogo from "@/media/vectordbs/qdrant.png";
import MilvusLogo from "@/media/vectordbs/milvus.png";
import PGVectorLogo from "@/media/vectordbs/pgvector.png";

import LanceDBOptions from "@/components/VectorDBSelection/LanceDBOptions";
import ChromaDBOptions from "@/components/VectorDBSelection/ChromaDBOptions";
import WeaviateDBOptions from "@/components/VectorDBSelection/WeaviateDBOptions";
import QDrantDBOptions from "@/components/VectorDBSelection/QDrantDBOptions";
import MilvusDBOptions from "@/components/VectorDBSelection/MilvusDBOptions";
import PGVectorOptions from "@/components/VectorDBSelection/PGVectorOptions";

const VECTOR_DBS = [
  {
    name: "LanceDB",
    value: "lancedb",
    logo: LanceDbLogo,
    options: (_) => <LanceDBOptions />,
    description:
      "100% local vector DB that runs on the same instance as Orion.",
  },
  {
    name: "PGVector",
    value: "pgvector",
    logo: PGVectorLogo,
    options: (settings) => <PGVectorOptions settings={settings} />,
    description: "Vector search powered by local PostgreSQL.",
  },
  {
    name: "Chroma",
    value: "chroma",
    logo: ChromaLogo,
    options: (settings) => <ChromaDBOptions settings={settings} />,
    description:
      "Open source vector database you can host yourself locally.",
  },
  {
    name: "QDrant",
    value: "qdrant",
    logo: QDrantLogo,
    options: (settings) => <QDrantDBOptions settings={settings} />,
    description: "Open source local vector database.",
  },
  {
    name: "Weaviate",
    value: "weaviate",
    logo: WeaviateLogo,
    options: (settings) => <WeaviateDBOptions settings={settings} />,
    description:
      "Open source local multi-modal vector database.",
  },
  {
    name: "Milvus",
    value: "milvus",
    logo: MilvusLogo,
    options: (settings) => <MilvusDBOptions settings={settings} />,
    description: "Open-source, highly scalable, and blazing fast local vector DB.",
  },
];

export default function GeneralVectorDatabase() {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasEmbeddings, setHasEmbeddings] = useState(false);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredVDBs, setFilteredVDBs] = useState([]);
  const [selectedVDB, setSelectedVDB] = useState(null);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const searchInputRef = useRef(null);
  const { isOpen, openModal, closeModal } = useModal();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedVDB !== settings?.VectorDB && hasChanges && hasEmbeddings) {
      openModal();
    } else {
      await handleSaveSettings();
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    const form = document.getElementById("vectordb-form");
    const settingsData = {};
    const formData = new FormData(form);
    settingsData.VectorDB = selectedVDB;
    for (var [key, value] of formData.entries()) settingsData[key] = value;

    const { error } = await System.updateSystem(settingsData);
    if (error) {
      showToast(`Failed to save vector database settings: ${error}`, "error");
      setHasChanges(true);
    } else {
      showToast("Vector database preferences saved successfully.", "success");
      setHasChanges(false);
    }
    setSaving(false);
    closeModal();
  };

  const updateVectorChoice = (selection) => {
    setSearchQuery("");
    setSelectedVDB(selection);
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
      setSelectedVDB(_settings?.VectorDB || "lancedb");
      setHasEmbeddings(_settings?.HasExistingEmbeddings || false);
      setLoading(false);
    }
    fetchKeys();
  }, []);

  useEffect(() => {
    const filtered = VECTOR_DBS.filter((vdb) =>
      vdb.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredVDBs(filtered);
  }, [searchQuery, selectedVDB]);

  const selectedVDBObject =
    VECTOR_DBS.find((vdb) => vdb.value === selectedVDB) ?? VECTOR_DBS[0];

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
            <form
              id="vectordb-form"
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
                    {t("vector.title")}
                  </h1>
                  <p className="text-xs text-zinc-400">
                    {t("vector.description")}
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

              {/* Vector DB Selector Card */}
              <div className="p-5 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1">
                    {t("vector.provider.title")}
                  </label>
                  <p className="text-xs text-zinc-400">
                    Select the local vector index engine for embedding storage.
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
                          src={selectedVDBObject.logo}
                          alt={`${selectedVDBObject.name} logo`}
                          className="w-7 h-7 rounded object-contain"
                        />
                      </div>
                      <div className="flex flex-col text-left truncate">
                        <div className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                          {selectedVDBObject.name}
                        </div>
                        <div className="text-xs text-zinc-400 truncate">
                          {selectedVDBObject.description}
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
                            name="vdb-search"
                            autoComplete="off"
                            placeholder="Search vector engines..."
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
                          {filteredVDBs.map((vdb) => (
                            <VectorDBItem
                              key={vdb.name}
                              name={vdb.name}
                              value={vdb.value}
                              image={vdb.logo}
                              description={vdb.description}
                              checked={selectedVDB === vdb.value}
                              onClick={() => updateVectorChoice(vdb.value)}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Engine-specific Options Card */}
              <div
                onChange={() => setHasChanges(true)}
                className="p-5 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-4"
              >
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  {selectedVDBObject.name} Configuration
                </h3>
                {selectedVDB &&
                  VECTOR_DBS.find((vdb) => vdb.value === selectedVDB)?.options(
                    settings
                  )}
              </div>
            </form>
          </div>
        </div>
      )}
      <Modal isOpen={isOpen} onClose={closeModal} size="lg">
        <ChangeWarningModal
          warningText="Switching the vector database will reset all previously embedded documents in all workspaces.\n\nConfirming will clear all embeddings from your vector database and remove all documents from your workspaces. Your uploaded documents will not be deleted, they will be available for re-embedding."
          onClose={closeModal}
          onConfirm={handleSaveSettings}
        />
      </Modal>
    </div>
  );
}
