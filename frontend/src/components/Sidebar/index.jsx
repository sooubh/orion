import React, { useRef, useState, useEffect } from "react";
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
import { useSidebarToggle, ToggleSidebarButton, SIDEBAR_TOGGLE_EVENT } from "./SidebarToggle";
import OrionBrand from "@/components/OrionBrand";
import Workspace from "@/models/workspace";
import { LAST_VISITED_WORKSPACE } from "@/utils/constants";
import { safeJsonParse } from "@/utils/request";

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
  const [activeSlug, setActiveSlug] = useState(() => {
    const lastVisited = safeJsonParse(
      localStorage.getItem(LAST_VISITED_WORKSPACE)
    );
    return lastVisited?.slug || null;
  });

  useEffect(() => {
    async function resolveActiveWorkspace() {
      const allWs = await Workspace.all();
      const lastVisited = safeJsonParse(
        localStorage.getItem(LAST_VISITED_WORKSPACE)
      );
      if (
        lastVisited?.slug &&
        allWs.some((ws) => ws.slug === lastVisited.slug)
      ) {
        setActiveSlug(lastVisited.slug);
      } else if (allWs.length > 0) {
        setActiveSlug(allWs[0].slug);
      } else {
        setActiveSlug(null);
      }
    }
    resolveActiveWorkspace();
  }, [currentPath]);

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
      path: activeSlug ? paths.workspace.chat(activeSlug) : "/workspace",
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
        className="relative h-screen flex-shrink-0 transition-all duration-300 select-none bg-white dark:bg-[#090a0b] border-r border-slate-200 dark:border-[#1f2328] flex flex-col z-30 font-sans shadow-sm dark:shadow-none"
      >
        {canToggleSidebar && (
          <ToggleSidebarButton
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
          />
        )}

        <div className={`flex flex-col h-full overflow-hidden ${showSidebar ? "opacity-100" : "opacity-0 pointer-events-none"} transition-opacity duration-200`}>
          {/* Header Brand */}
          <div className="h-16 flex items-center px-5 border-b border-slate-200 dark:border-[#1f2328] justify-between">
            <OrionBrand to={paths.dashboard()} size="lg" />
          </div>

          {/* Navigation Links */}
          <div
            ref={sidebarRef}
            className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto no-scroll"
          >
            <div className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-zinc-500 uppercase px-2 mb-2 font-mono">
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
                          const target = activeSlug
                            ? paths.workspace.chat(activeSlug)
                            : "/workspace";
                          navigate(target);
                        }
                      }}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all text-xs font-semibold ${
                        item.isActive
                          ? "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 font-bold"
                          : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-[#111215]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={18} weight={item.isActive ? "fill" : "duotone"} className={item.isActive ? "text-sky-700 dark:text-sky-400" : "text-slate-500 dark:text-zinc-400"} />
                        <span>{item.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            showNewWsModal();
                          }}
                          className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white transition-colors"
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
                          className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white transition-colors"
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
                      ? "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 font-bold"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-[#111215]"
                  }`}
                >
                  <Icon size={18} weight={item.isActive ? "fill" : "duotone"} className={item.isActive ? "text-sky-700 dark:text-sky-400" : "text-slate-500 dark:text-zinc-400"} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Footer Security Badge & Vitals */}
          <div className="p-3 border-t border-slate-200 dark:border-[#1f2328] bg-slate-50/70 dark:bg-[#090a0b] space-y-2">
            <Link
              to={paths.security()}
              className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] text-slate-700 dark:text-zinc-300 hover:border-sky-400 dark:hover:border-sky-500/30 transition-all text-xs group shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <div className="flex flex-col">
                  <span className="font-bold text-[11px] text-slate-900 dark:text-zinc-200 group-hover:text-sky-700 dark:group-hover:text-white font-mono">LOCAL ONLY</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono">External connections: 0</span>
                </div>
              </div>
              <Shield size={16} className="text-slate-400 dark:text-zinc-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors" weight="duotone" />
            </Link>

            <div className="flex items-center justify-between px-2 pt-1 text-xs text-slate-500 dark:text-zinc-500">
              <span className="truncate max-w-[120px] font-mono text-[11px] text-slate-700 dark:text-zinc-400 font-medium">
                {user?.username || "Admin"}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTheme(isLight ? "dark" : "light")}
                  className="text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 dark:text-zinc-400 dark:hover:text-white p-1.5 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
                >
                  {isLight ? <Moon size={15} weight="bold" /> : <Sun size={15} weight="bold" className="text-amber-400" />}
                </button>
                <Link
                  to="/settings"
                  className="text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 dark:text-zinc-400 dark:hover:text-white p-1.5 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  title="System Settings"
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
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <header className="md:hidden h-14 bg-white dark:bg-[#090a0b] border-b border-slate-200 dark:border-[#1f2328] px-4 flex items-center justify-between z-40 fixed top-0 left-0 right-0 font-sans shadow-sm">
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(
            new CustomEvent(SIDEBAR_TOGGLE_EVENT, { detail: { open: true } })
          );
        }}
        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-900 transition-colors"
      >
        <List size={22} />
      </button>
      <OrionBrand to={paths.dashboard()} size="md" />
      <Link
        to={paths.security()}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-bold text-emerald-800 dark:text-emerald-400 font-mono"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse"></span>
        <span>Local</span>
      </Link>
    </header>
  );
}
