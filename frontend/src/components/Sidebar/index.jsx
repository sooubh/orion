import React, { useRef, useState } from "react";
import {
  SquaresFour,
  ChatCircleDots,
  Files,
  Database,
  ShieldCheck,
  Package,
  Shield,
  Plus,
  CaretRight,
  List,
  GearSix,
  Sun,
  Moon,
} from "@phosphor-icons/react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import paths from "@/utils/paths";
import useUser from "@/hooks/useUser";
import { useTheme } from "@/hooks/useTheme";
import NewWorkspaceModal, {
  useNewWorkspaceModal,
} from "../Modals/NewWorkspace";
import ActiveWorkspaces from "./ActiveWorkspaces";
import { useSidebarToggle, ToggleSidebarButton } from "./SidebarToggle";
import SovereignLogo from "@/media/logo/sovereign-ai.svg";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();
  const { theme, setTheme, isLight } = useTheme();
  const sidebarRef = useRef(null);
  const { showSidebar, setShowSidebar, canToggleSidebar } = useSidebarToggle();
  const [workspaceSectionOpen, setWorkspaceSectionOpen] = useState(true);
  const {
    showing: showingNewWsModal,
    showModal: showNewWsModal,
    hideModal: hideNewWsModal,
  } = useNewWorkspaceModal();

  const currentPath = location.pathname;

  const navItems = [
    {
      id: "dashboard",
      name: "Dashboard",
      icon: SquaresFour,
      path: paths.dashboard(),
      isActive: currentPath === "/" || currentPath === "/dashboard",
    },
    {
      id: "workspace",
      name: "Workspace",
      icon: ChatCircleDots,
      path: paths.workspace.chat("primary"),
      isActive: currentPath.startsWith("/workspace"),
      isWorkspace: true,
    },
    {
      id: "documents",
      name: "Documents",
      icon: Files,
      path: paths.documents(),
      isActive: currentPath.startsWith("/documents"),
    },
    {
      id: "knowledge",
      name: "Knowledge",
      icon: Database,
      path: paths.knowledge(),
      isActive: currentPath.startsWith("/knowledge"),
    },
    {
      id: "review",
      name: "AI Review",
      icon: ShieldCheck,
      path: paths.review(),
      isActive: currentPath.startsWith("/review"),
    },
    {
      id: "deliverables",
      name: "Deliverables",
      icon: Package,
      path: paths.deliverables(),
      isActive: currentPath.startsWith("/deliverables"),
    },
    {
      id: "security",
      name: "Security",
      icon: Shield,
      path: paths.security(),
      isActive: currentPath.startsWith("/security"),
    },
  ];

  return (
    <>
      <aside
        style={{
          width: showSidebar ? "272px" : "0px",
          minWidth: showSidebar ? "272px" : "0px",
        }}
        className="relative h-screen flex-shrink-0 transition-all duration-300 select-none bg-[#090a0b] border-r border-[#1f2328] flex flex-col z-30 font-sans"
      >
        {canToggleSidebar && (
          <ToggleSidebarButton
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
          />
        )}

        <div className={`flex flex-col h-full overflow-hidden ${showSidebar ? "opacity-100" : "opacity-0 pointer-events-none"} transition-opacity duration-200`}>
          {/* Header Brand */}
          <div className="h-16 flex items-center px-5 border-b border-[#1f2328] justify-between">
            <Link to={paths.dashboard()} className="flex items-center gap-2 group">
              <img
                src={SovereignLogo}
                alt="Sovereign AI"
                className="h-8 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Navigation Links */}
          <div
            ref={sidebarRef}
            className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto no-scroll"
          >
            <div className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase px-2 mb-2 font-mono">
              Sovereign Core
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;

              if (item.isWorkspace) {
                return (
                  <div key={item.id} className="flex flex-col">
                    <div
                      onClick={() => {
                        if (!currentPath.startsWith("/workspace")) {
                          navigate(item.path);
                        }
                      }}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all text-xs font-semibold ${
                        item.isActive
                          ? "bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold"
                          : "text-zinc-400 hover:text-zinc-100 hover:bg-[#111215]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={18} weight={item.isActive ? "fill" : "duotone"} className={item.isActive ? "text-sky-400" : "text-zinc-400"} />
                        <span>{item.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            showNewWsModal();
                          }}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                          title="New Workspace"
                        >
                          <Plus size={13} weight="bold" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWorkspaceSectionOpen(!workspaceSectionOpen);
                          }}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        >
                          <CaretRight
                            size={12}
                            weight="bold"
                            className={`transform transition-transform ${workspaceSectionOpen ? "rotate-90" : ""}`}
                          />
                        </button>
                      </div>
                    </div>

                    {workspaceSectionOpen && (
                      <div className="mt-1 pl-4 space-y-0.5">
                        <ActiveWorkspaces />
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-xs font-semibold ${
                    item.isActive
                      ? "bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-[#111215]"
                  }`}
                >
                  <Icon size={18} weight={item.isActive ? "fill" : "duotone"} className={item.isActive ? "text-sky-400" : "text-zinc-400"} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Footer Security Badge & Vitals */}
          <div className="p-3 border-t border-[#1f2328] bg-[#090a0b] space-y-2">
            <Link
              to={paths.security()}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[#111215] border border-[#1f2328] text-zinc-300 hover:border-sky-500/30 transition-all text-xs group shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <div className="flex flex-col">
                  <span className="font-bold text-[11px] text-zinc-200 group-hover:text-white font-mono">LOCAL ONLY</span>
                  <span className="text-[10px] text-zinc-500 font-mono">External connections: 0</span>
                </div>
              </div>
              <Shield size={16} className="text-zinc-400 group-hover:text-sky-400 transition-colors" weight="duotone" />
            </Link>

            <div className="flex items-center justify-between px-2 pt-1 text-xs text-zinc-500">
              <span className="truncate max-w-[120px] font-mono text-[11px] text-zinc-400">
                {user?.username || "Admin"}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTheme(isLight ? "dark" : "light")}
                  className="text-zinc-400 hover:text-white p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
                  title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
                >
                  {isLight ? <Moon size={15} weight="bold" /> : <Sun size={15} weight="bold" className="text-amber-400" />}
                </button>
                <Link
                  to="/settings/llm-preference"
                  className="text-zinc-400 hover:text-white p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
                  title="Settings & LLM Preference"
                >
                  <GearSix size={15} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {showingNewWsModal && <NewWorkspaceModal hideModal={hideNewWsModal} />}
    </>
  );
}

export function SidebarMobileHeader() {
  const [showSidebar, setShowSidebar] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <header className="md:hidden h-14 bg-[#090a0b] border-b border-[#1f2328] px-4 flex items-center justify-between z-40 fixed top-0 left-0 right-0 font-sans">
      <button
        type="button"
        onClick={() => setShowSidebar(true)}
        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900"
      >
        <List size={22} />
      </button>
      <Link to={paths.dashboard()} className="flex items-center">
        <img
          src={SovereignLogo}
          alt="Sovereign AI"
          className="h-6 w-auto object-contain"
        />
      </Link>
      <Link
        to={paths.security()}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-bold text-emerald-400 font-mono"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Local</span>
      </Link>
    </header>
  );
}
