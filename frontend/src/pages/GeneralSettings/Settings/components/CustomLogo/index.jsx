import useLogo from "@/hooks/useLogo";
import System from "@/models/system";
import showToast from "@/utils/toast";
import { useEffect, useRef, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

export default function CustomLogo() {
  const { t } = useTranslation();
  const { logo: _initLogo, setLogo: _setLogo } = useLogo();
  const [logo, setLogo] = useState("");
  const [isDefaultLogo, setIsDefaultLogo] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function logoInit() {
      setLogo(_initLogo || "");
      const _isDefaultLogo = await System.isDefaultLogo();
      setIsDefaultLogo(_isDefaultLogo);
    }
    logoInit();
  }, [_initLogo]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return false;

    const objectURL = URL.createObjectURL(file);
    setLogo(objectURL);

    const formData = new FormData();
    formData.append("logo", file);
    const { success, error } = await System.uploadLogo(formData);
    if (!success) {
      showToast(`Failed to upload logo: ${error}`, "error");
      setLogo(_initLogo);
      return;
    }

    const { logoURL } = await System.fetchLogo();
    _setLogo(logoURL);

    showToast("Image uploaded successfully.", "success");
    setIsDefaultLogo(false);
  };

  const handleRemoveLogo = async () => {
    setLogo("");
    setIsDefaultLogo(true);

    const { success, error } = await System.removeCustomLogo();
    if (!success) {
      console.error("Failed to remove logo:", error);
      showToast(`Failed to remove logo: ${error}`, "error");
      const { logoURL } = await System.fetchLogo();
      setLogo(logoURL);
      setIsDefaultLogo(false);
      return;
    }

    const { logoURL } = await System.fetchLogo();
    _setLogo(logoURL);

    showToast("Image successfully removed.", "success");
  };

  const triggerFileInputClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="p-5 rounded-2xl bg-theme-bg-sidebar/70 border border-theme-sidebar-border/30 space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-semibold text-white block">
          {t("customization.items.logo.title")}
        </label>
        <p className="text-xs text-zinc-400">
          {t("customization.items.logo.description")}
        </p>
      </div>
      {isDefaultLogo ? (
        <div className="flex md:flex-row flex-col items-center">
          <div className="flex flex-row gap-x-8">
            <label
              className="transition-all duration-300 hover:opacity-80"
              hidden={!isDefaultLogo}
            >
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div
                className="w-80 py-6 bg-zinc-900/60 rounded-xl border border-dashed border-zinc-700 hover:border-indigo-500/50 justify-center items-center inline-flex cursor-pointer transition-colors"
                htmlFor="logo-upload"
              >
                <div className="flex flex-col items-center justify-center">
                  <div className="rounded-full bg-zinc-800 p-2 text-zinc-300">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div className="text-white text-xs font-semibold mt-2">
                    {t("customization.items.logo.add")}
                  </div>
                  <div className="text-zinc-500 text-[11px] font-medium mt-0.5">
                    {t("customization.items.logo.recommended")}
                  </div>
                </div>
              </div>
            </label>
          </div>
        </div>
      ) : (
        <div className="flex md:flex-row flex-col items-center relative">
          <div className="group w-80 h-[130px] overflow-hidden rounded-xl border border-zinc-700/60 relative">
            <img
              src={logo}
              alt="Uploaded Logo"
              className="w-full h-full object-cover p-1 rounded-xl"
            />

            <div className="absolute inset-0 flex flex-col gap-y-2 justify-center items-center rounded-xl bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out backdrop-blur-xs">
              <button
                type="button"
                onClick={triggerFileInputClick}
                className="text-white text-xs font-medium hover:text-indigo-300 px-3 py-1.5 rounded bg-zinc-800/80 transition-colors cursor-pointer"
              >
                {t("customization.items.logo.replace")}
              </button>

              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                ref={fileInputRef}
              />
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="text-red-400 text-xs font-medium hover:text-red-300 px-3 py-1.5 rounded bg-zinc-800/80 transition-colors cursor-pointer"
              >
                {t("customization.items.logo.remove")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
