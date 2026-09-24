import React, { useState, useEffect } from "react";
import * as Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import Workspace from "@/models/workspace";
import ManageWorkspace, {
  useManageWorkspaceModal,
} from "../../Modals/ManageWorkspace";
import paths from "@/utils/paths";
import { Link, useParams, useNavigate, useMatch } from "react-router-dom";
import { GearSix, UploadSimple, DotsSixVertical } from "@phosphor-icons/react";
import useUser from "@/hooks/useUser";
import ThreadContainer from "./ThreadContainer";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import showToast from "@/utils/toast";
import { LAST_VISITED_WORKSPACE } from "@/utils/constants";
import { safeJsonParse } from "@/utils/request";

export default function ActiveWorkspaces() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWs, setSelectedWs] = useState(null);
  const { showing, showModal, hideModal } = useManageWorkspaceModal();
  const { user } = useUser();
  const isInWorkspaceSettings = !!useMatch("/workspace/:slug/settings/:tab");
  const isHomePage = !!useMatch("/");

  useEffect(() => {
    async function getWorkspaces() {
      const workspaces = await Workspace.all();
      setLoading(false);
      setWorkspaces(Workspace.orderWorkspaces(workspaces));
    }
    getWorkspaces();
  }, []);

  if (loading) {
    return (
      <Skeleton.default
        height={40}
        width="100%"
        count={5}
        baseColor="var(--theme-sidebar-item-default)"
        highlightColor="var(--theme-sidebar-item-hover)"
        enableAnimation={true}
        className="my-1"
      />
    );
  }

  /**
   * Reorders workspaces in the UI via localstorage on client side.
   * @param {number} startIndex - the index of the workspace to move
   * @param {number} endIndex - the index to move the workspace to
   */
  function reorderWorkspaces(startIndex, endIndex) {
    const reorderedWorkspaces = Array.from(workspaces);
    const [removed] = reorderedWorkspaces.splice(startIndex, 1);
    reorderedWorkspaces.splice(endIndex, 0, removed);
    setWorkspaces(reorderedWorkspaces);
    const success = Workspace.storeWorkspaceOrder(
      reorderedWorkspaces.map((w) => w.id)
    );
    if (!success) {
      showToast("Failed to reorder workspaces", "error");
      Workspace.all().then((workspaces) => setWorkspaces(workspaces));
    }
  }

  const onDragEnd = (result) => {
    if (!result.destination) return;
    reorderWorkspaces(result.source.index, result.destination.index);
  };

  // When on the home page, resolve which workspace should be virtually active
  const virtualActiveSlug = (() => {
    if (!isHomePage || workspaces.length === 0) return null;
    const lastVisited = safeJsonParse(
      localStorage.getItem(LAST_VISITED_WORKSPACE)
    );
    if (
      lastVisited?.slug &&
      workspaces.some((ws) => ws.slug === lastVisited.slug)
    )
      return lastVisited.slug;
    return workspaces[0]?.slug ?? null;
  })();

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="workspaces">
        {(provided) => (
          <div
            role="list"
            aria-label="Workspaces"
            className="flex flex-col gap-y-2"
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {workspaces.map((workspace, index) => {
              const isVirtuallyActive = workspace.slug === virtualActiveSlug;
              const isActive = workspace.slug === slug || isVirtuallyActive;
              return (
                <Draggable
                  key={workspace.id}
                  draggableId={workspace.id.toString()}
                  index={index}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`flex flex-col w-full group ${
                        snapshot.isDragging ? "opacity-50" : ""
                      }`}
                      role="listitem"
                    >
                      <div className="flex gap-x-2 items-center justify-between">
                        <Link
                          to={paths.workspace.chat(workspace.slug)}
                          aria-current={isActive ? "page" : ""}
                          className={`
                            transition-all duration-[200ms]
                            flex flex-grow w-[75%] gap-x-2 py-[6px] pl-[6px] pr-[6px] rounded-[6px] justify-start items-center
                            ${isActive
                              ? "bg-sky-50 dark:bg-sky-500/15 text-sky-950 dark:text-white font-bold border border-sky-200 dark:border-sky-500/30 shadow-sm"
                              : "text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-theme-sidebar-subitem-hover"}
                          `}
                        >
                          <div className="flex flex-row justify-between w-full items-center">
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab mr-[3px]"
                            >
                              <DotsSixVertical
                                size={18}
                                className={`${isActive ? "text-sky-700 dark:text-sky-300" : "text-slate-400 dark:text-zinc-500"}`}
                                weight="bold"
                              />
                            </div>
                            <div
                              data-tooltip-id="workspace-name"
                              data-tooltip-content={workspace.name}
                              className="flex items-center space-x-2 overflow-hidden flex-grow"
                            >
                              <div className="w-[130px] overflow-hidden">
                                <p
                                  className={`
                                  text-[13px] leading-snug whitespace-nowrap overflow-hidden
                                  ${isActive ? "font-bold text-sky-950 dark:text-white" : "font-medium text-slate-700 dark:text-zinc-300"} truncate
                                  w-full group-hover:w-[130px] group-hover:duration-200
                                `}
                                >
                                  {workspace.name}
                                </p>
                              </div>
                            </div>
                            {user?.role !== "default" && (
                              <div
                                className={`flex items-center gap-x-[2px] transition-opacity duration-200 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setSelectedWs(workspace);
                                    showModal();
                                  }}
                                  data-tooltip-id="upload-workspace"
                                  data-tooltip-content="Upload documents to this workspace for RAG indexing"
                                  className={`group/upload border-none rounded-md flex items-center justify-center ml-auto p-[2px] ${isActive ? "hover:bg-sky-100 dark:hover:bg-zinc-700 text-sky-700 dark:text-zinc-300" : "hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400"}`}
                                >
                                  <UploadSimple
                                    className="h-[16px] w-[16px] hover:text-sky-900 dark:hover:text-white transition-colors"
                                  />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    navigate(
                                      isInWorkspaceSettings
                                        ? paths.workspace.chat(workspace.slug)
                                        : paths.workspace.settings.generalAppearance(
                                            workspace.slug
                                          )
                                    );
                                  }}
                                  className={`group/gear rounded-md flex items-center justify-center ml-auto p-[2px] ${isActive ? "hover:bg-sky-100 dark:hover:bg-zinc-700 text-sky-700 dark:text-zinc-300" : "hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400"}`}
                                  aria-label="General appearance settings"
                                  data-tooltip-id="gear-workspace"
                                  data-tooltip-content="General appearance settings"
                                >
                                  <GearSix
                                    color={
                                      isInWorkspaceSettings &&
                                      workspace.slug === slug
                                        ? "#0284c7"
                                        : undefined
                                    }
                                    className="h-[16px] w-[16px] hover:text-sky-900 dark:hover:text-white transition-colors"
                                  />
                                </button>
                              </div>
                            )}
                          </div>
                        </Link>
                      </div>
                      {isActive && (
                        <ThreadContainer
                          workspace={workspace}
                          isActive={isActive}
                          isVirtualThread={isVirtuallyActive}
                        />
                      )}
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
            {showing && (
              <ManageWorkspace
                hideModal={hideModal}
                providedSlug={selectedWs ? selectedWs.slug : null}
              />
            )}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
