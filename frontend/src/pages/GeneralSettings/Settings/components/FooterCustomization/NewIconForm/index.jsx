import { ICON_COMPONENTS } from "@/components/Footer";
import React, { useEffect, useRef, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";

export default function NewIconForm({ icon, url, onSave, onRemove }) {
  const [selectedIcon, setSelectedIcon] = useState(icon || "Plus");
  const [selectedUrl, setSelectedUrl] = useState(url || "");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEdited, setIsEdited] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setSelectedIcon(icon || "Plus");
    setSelectedUrl(url || "");
    setIsEdited(false);
  }, [icon, url]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedIcon !== "Plus" && selectedUrl) {
      onSave(selectedIcon, selectedUrl);
      setIsEdited(false);
    }
  };

  const handleRemove = () => {
    onRemove();
    setSelectedIcon("Plus");
    setSelectedUrl("");
    setIsEdited(false);
  };

  const handleIconChange = (iconName) => {
    setSelectedIcon(iconName);
    setIsDropdownOpen(false);
    setIsEdited(true);
  };

  const handleUrlChange = (e) => {
    setSelectedUrl(e.target.value);
    setIsEdited(true);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-x-2">
      <div className="relative" ref={dropdownRef}>
        <div
          className="h-9 w-9 bg-zinc-900 border border-zinc-700/60 hover:border-indigo-500/50 rounded-xl flex items-center justify-center cursor-pointer transition-all shadow-sm"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          {React.createElement(ICON_COMPONENTS[selectedIcon] || Plus, {
            className: "h-4 w-4",
            weight: selectedIcon === "Plus" ? "bold" : "fill",
            color: "var(--theme-sidebar-footer-icon-fill)",
          })}
        </div>
        {isDropdownOpen && (
          <div className="absolute z-20 grid grid-cols-4 bg-zinc-900 mt-2 p-1.5 rounded-xl w-[160px] h-[86px] overflow-y-auto border border-zinc-700 shadow-2xl">
            {Object.keys(ICON_COMPONENTS).map((iconName) => (
              <button
                key={iconName}
                type="button"
                className="flex justify-center items-center border border-transparent hover:bg-zinc-800 rounded-lg p-2 transition-colors cursor-pointer"
                onClick={() => handleIconChange(iconName)}
              >
                {React.createElement(ICON_COMPONENTS[iconName], {
                  className: "h-4 w-4",
                  weight: "fill",
                  color: "var(--theme-sidebar-footer-icon-fill)",
                })}
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        type="url"
        value={selectedUrl}
        onChange={handleUrlChange}
        placeholder="https://example.com"
        className="bg-zinc-900 border border-zinc-700/60 focus:border-indigo-500 rounded-xl text-white placeholder:text-zinc-500 text-sm px-3.5 py-2 w-[320px] outline-none transition-all"
        required
      />
      {selectedIcon !== "Plus" && (
        <>
          {isEdited ? (
            <button
              type="submit"
              className="text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-950/60 border border-indigo-700/40 transition-colors cursor-pointer"
            >
              Save
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRemove}
              className="text-zinc-400 hover:text-red-400 p-2 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </>
      )}
    </form>
  );
}
