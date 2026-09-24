import React, { useEffect, useState } from "react";
import { default as WorkspaceChatContainer } from "@/components/WorkspaceChat";
import Sidebar from "@/components/Sidebar";
import { useParams, useNavigate } from "react-router-dom";
import Workspace from "@/models/workspace";
import PasswordModal, { usePasswordModal } from "@/components/Modals/Password";
import { isMobile } from "react-device-detect";
import { FullScreenLoader } from "@/components/Preloader";
import { LAST_VISITED_WORKSPACE } from "@/utils/constants";
import { safeJsonParse } from "@/utils/request";
import paths from "@/utils/paths";

export default function WorkspaceChat() {
  const { loading, requiresAuth, mode } = usePasswordModal();

  if (loading) return <FullScreenLoader />;
  if (requiresAuth !== false) {
    return <>{requiresAuth !== null && <PasswordModal mode={mode} />}</>;
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-50 dark:bg-[#090a0b] flex">
      {!isMobile && <Sidebar />}
      <ShowWorkspaceChat />
    </div>
  );
}

function ShowWorkspaceChat() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  // Tracks which workspace `workspace` belongs to. While a new workspace's
  // data is in flight, we keep the previous workspace's chat mounted
  // (Slack/Linear-style transition) instead of flashing a skeleton.
  const [loadedSlug, setLoadedSlug] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    async function getWorkspace() {
      // Dynamic resolution when visiting /workspace without a slug
      if (!slug) {
        let targetWs = null;
        const lastVisited = safeJsonParse(
          localStorage.getItem(LAST_VISITED_WORKSPACE)
        );
        if (lastVisited?.slug) {
          targetWs = await Workspace.bySlug(lastVisited.slug);
        }
        if (!targetWs) {
          const allWs = await Workspace.all();
          if (allWs.length > 0) {
            targetWs = allWs[0];
          }
        }

        if (isCancelled) return;

        if (targetWs?.slug) {
          navigate(paths.workspace.chat(targetWs.slug), { replace: true });
          return;
        }

        setWorkspace(null);
        setLoadedSlug("none");
        return;
      }

      // Explicit slug in URL: /workspace/:slug
      try {
        const _workspace = await Workspace.bySlug(slug);
        if (isCancelled) return;

        if (!_workspace) {
          // If this invalid slug was cached, clean it up
          const lastVisited = safeJsonParse(
            localStorage.getItem(LAST_VISITED_WORKSPACE)
          );
          if (lastVisited?.slug === slug) {
            localStorage.removeItem(LAST_VISITED_WORKSPACE);
          }

          // Fallback check: If the requested slug is missing/deleted, check if other workspaces exist
          const allWs = await Workspace.all();
          if (isCancelled) return;

          if (allWs.length > 0) {
            // Gracefully redirect to the first available valid workspace
            navigate(paths.workspace.chat(allWs[0].slug), { replace: true });
            return;
          }

          setWorkspace(null);
          setLoadedSlug(slug);
          return;
        }

        // Auxiliary workspace data with safe fallbacks
        const [suggestedMessages, agentCmdRes] = await Promise.all([
          Workspace.getSuggestedMessages(slug).catch(() => []),
          Workspace.agentCommandAvailable(slug).catch(() => ({
            showAgentCommand: true,
          })),
        ]);

        if (isCancelled) return;

        setWorkspace({
          ..._workspace,
          suggestedMessages: suggestedMessages || [],
          showAgentCommand: agentCmdRes?.showAgentCommand ?? true,
        });
        setLoadedSlug(slug);
        localStorage.setItem(
          LAST_VISITED_WORKSPACE,
          JSON.stringify({
            slug: _workspace.slug,
            name: _workspace.name,
          })
        );
      } catch (err) {
        console.error("Error loading workspace:", err);
        if (isCancelled) return;
        setWorkspace(null);
        setLoadedSlug(slug);
      }
    }

    getWorkspace();

    return () => {
      isCancelled = true;
    };
  }, [slug, navigate]);

  return (
    <WorkspaceChatContainer
      loading={loadedSlug !== slug}
      workspace={workspace}
    />
  );
}
