import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "@/App.jsx";
import PrivateRoute, {
  AdminRoute,
  ManagerRoute,
  SingleUserRoute,
} from "@/components/PrivateRoute";
import Login from "@/pages/Login";
import SimpleSSOPassthrough from "@/pages/Login/SSO/simple";
import OnboardingFlow from "@/pages/OnboardingFlow";
import "@/index.css";
import { migrateLocalStorage } from "@/utils/storageMigration";

migrateLocalStorage();

const isDev = import.meta.env.DEV;
const REACTWRAP = isDev ? React.Fragment : React.StrictMode;

const withPrivate = (Component) => () => <PrivateRoute Component={Component} />;
const withAdmin = (Component, hideUserMenu = false) => () => (
  <AdminRoute Component={Component} hideUserMenu={hideUserMenu} />
);
const withManager = (Component) => () => <ManagerRoute Component={Component} />;

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        lazy: async () => {
          const { default: Dashboard } = await import("@/pages/Dashboard");
          return { Component: withPrivate(Dashboard) };
        },
      },
      {
        path: "/dashboard",
        lazy: async () => {
          const { default: Dashboard } = await import("@/pages/Dashboard");
          return { Component: withPrivate(Dashboard) };
        },
      },
      {
        path: "/documents",
        lazy: async () => {
          const { default: DocumentsPage } = await import("@/pages/Documents");
          return { Component: withPrivate(DocumentsPage) };
        },
      },
      {
        path: "/knowledge",
        lazy: async () => {
          const { default: KnowledgePage } = await import("@/pages/Knowledge");
          return { Component: withPrivate(KnowledgePage) };
        },
      },
      {
        path: "/review",
        lazy: async () => {
          const { default: ReviewPage } = await import("@/pages/Review");
          return { Component: withPrivate(ReviewPage) };
        },
      },
      {
        path: "/ai-review",
        lazy: async () => {
          const { default: ReviewPage } = await import("@/pages/Review");
          return { Component: withPrivate(ReviewPage) };
        },
      },
      {
        path: "/deliverables",
        lazy: async () => {
          const { default: DeliverablesPage } = await import("@/pages/Deliverables");
          return { Component: withPrivate(DeliverablesPage) };
        },
      },
      {
        path: "/security",
        lazy: async () => {
          const { default: SecurityPage } = await import("@/pages/Security");
          return { Component: withPrivate(SecurityPage) };
        },
      },
      {
        path: "/security-center",
        lazy: async () => {
          const { default: SecurityPage } = await import("@/pages/Security");
          return { Component: withPrivate(SecurityPage) };
        },
      },
      {
        path: "/login",
        element: <Login />,
      },
      {
        path: "/sso/simple",
        element: <SimpleSSOPassthrough />,
      },
      {
        path: "/workspace",
        lazy: async () => {
          const { default: WorkspaceChat } = await import(
            "@/pages/WorkspaceChat"
          );
          return { Component: withPrivate(WorkspaceChat) };
        },
      },
      {
        path: "/workspace/:slug/settings/:tab",
        lazy: async () => {
          const { default: WorkspaceSettings } = await import(
            "@/pages/WorkspaceSettings"
          );
          return { Component: withManager(WorkspaceSettings) };
        },
      },
      {
        path: "/workspace/:slug",
        lazy: async () => {
          const { default: WorkspaceChat } = await import(
            "@/pages/WorkspaceChat"
          );
          return { Component: withPrivate(WorkspaceChat) };
        },
        children: [{ path: "t/:threadSlug" }],
      },
      {
        path: "/accept-invite/:code",
        lazy: async () => {
          const { default: InvitePage } = await import("@/pages/Invite");
          return { Component: InvitePage };
        },
      },
      // Settings Hub & Admin routes
      {
        path: "/settings",
        lazy: async () => {
          const { default: GeneralSettingsHub } = await import(
            "@/pages/GeneralSettings"
          );
          return { Component: withManager(GeneralSettingsHub) };
        },
      },
      {
        path: "/settings/llm-preference",
        lazy: async () => {
          const { default: GeneralLLMPreference } = await import(
            "@/pages/GeneralSettings/LLMPreference"
          );
          return { Component: withAdmin(GeneralLLMPreference) };
        },
      },
      {
        path: "/settings/transcription-preference",
        lazy: async () => {
          const { default: GeneralTranscriptionPreference } = await import(
            "@/pages/GeneralSettings/TranscriptionPreference"
          );
          return {
            Component: withAdmin(GeneralTranscriptionPreference),
          };
        },
      },
      {
        path: "/settings/audio-preference",
        lazy: async () => {
          const { default: GeneralAudioPreference } = await import(
            "@/pages/GeneralSettings/AudioPreference"
          );
          return {
            Component: withAdmin(GeneralAudioPreference),
          };
        },
      },
      {
        path: "/settings/embedding-preference",
        lazy: async () => {
          const { default: GeneralEmbeddingPreference } = await import(
            "@/pages/GeneralSettings/EmbeddingPreference"
          );
          return {
            Component: withAdmin(GeneralEmbeddingPreference),
          };
        },
      },
      {
        path: "/settings/image-generation-preference",
        lazy: async () => {
          const { default: ImageGenerationPreference } = await import(
            "@/pages/GeneralSettings/ImageGenerationPreference"
          );
          return {
            Component: withAdmin(ImageGenerationPreference),
          };
        },
      },
      {
        path: "/settings/text-splitter-preference",
        lazy: async () => {
          const { default: EmbeddingTextSplitterPreference } = await import(
            "@/pages/GeneralSettings/EmbeddingTextSplitterPreference"
          );
          return {
            Component: withAdmin(EmbeddingTextSplitterPreference),
          };
        },
      },
      {
        path: "/settings/vector-database",
        lazy: async () => {
          const { default: GeneralVectorDatabase } = await import(
            "@/pages/GeneralSettings/VectorDatabase"
          );
          return {
            Component: withAdmin(GeneralVectorDatabase),
          };
        },
      },
      {
        path: "/settings/agents",
        lazy: async () => {
          const { default: AdminAgents } = await import("@/pages/Admin/Agents");
          return { Component: withAdmin(AdminAgents) };
        },
      },
      {
        path: "/settings/agents/builder",
        lazy: async () => {
          const { default: AgentBuilder } = await import(
            "@/pages/Admin/AgentBuilder"
          );
          return {
            Component: withAdmin(AgentBuilder, true),
          };
        },
      },
      {
        path: "/settings/agents/builder/:flowId",
        lazy: async () => {
          const { default: AgentBuilder } = await import(
            "@/pages/Admin/AgentBuilder"
          );
          return {
            Component: withAdmin(AgentBuilder, true),
          };
        },
      },
      {
        path: "/settings/event-logs",
        lazy: async () => {
          const { default: AdminLogs } = await import("@/pages/Admin/Logging");
          return { Component: withAdmin(AdminLogs) };
        },
      },
      {
        path: "/settings/embed-chat-widgets",
        lazy: async () => {
          const { default: ChatEmbedWidgets } = await import(
            "@/pages/GeneralSettings/ChatEmbedWidgets"
          );
          return { Component: withAdmin(ChatEmbedWidgets) };
        },
      },
      // Manager routes
      {
        path: "/settings/security",
        lazy: async () => {
          const { default: GeneralSecurity } = await import(
            "@/pages/GeneralSettings/Security"
          );
          return { Component: withManager(GeneralSecurity) };
        },
      },
      {
        path: "/settings/privacy",
        lazy: async () => {
          const { default: PrivacyAndData } = await import(
            "@/pages/GeneralSettings/PrivacyAndData"
          );
          return { Component: withAdmin(PrivacyAndData) };
        },
      },
      {
        path: "/settings/interface",
        lazy: async () => {
          const { default: InterfaceSettings } = await import(
            "@/pages/GeneralSettings/Settings/Interface"
          );
          return { Component: withManager(InterfaceSettings) };
        },
      },
      {
        path: "/settings/branding",
        lazy: async () => {
          const { default: BrandingSettings } = await import(
            "@/pages/GeneralSettings/Settings/Branding"
          );
          return { Component: withManager(BrandingSettings) };
        },
      },
      {
        path: "/settings/default-system-prompt",
        lazy: async () => {
          const { default: DefaultSystemPrompt } = await import(
            "@/pages/Admin/DefaultSystemPrompt"
          );
          return { Component: withAdmin(DefaultSystemPrompt) };
        },
      },
      {
        path: "/settings/chat",
        lazy: async () => {
          const { default: ChatSettings } = await import(
            "@/pages/GeneralSettings/Settings/Chat"
          );
          return { Component: withManager(ChatSettings) };
        },
      },
      {
        path: "/settings/api-keys",
        lazy: async () => {
          const { default: GeneralApiKeys } = await import(
            "@/pages/GeneralSettings/ApiKeys"
          );
          return { Component: withAdmin(GeneralApiKeys) };
        },
      },
      {
        path: "/settings/model-routers",
        lazy: async () => {
          const { default: ModelRouters } = await import(
            "@/pages/GeneralSettings/ModelRouters"
          );
          return { Component: withAdmin(ModelRouters) };
        },
      },
      {
        path: "/settings/model-routers/:id",
        lazy: async () => {
          const { default: RouterRulesPage } = await import(
            "@/pages/GeneralSettings/ModelRouters/RouterRulesPage"
          );
          return { Component: withAdmin(RouterRulesPage) };
        },
      },
      {
        path: "/settings/system-prompt-variables",
        lazy: async () => {
          const { default: SystemPromptVariables } = await import(
            "@/pages/Admin/SystemPromptVariables"
          );
          return {
            Component: withAdmin(SystemPromptVariables),
          };
        },
      },
      {
        path: "/settings/browser-extension",
        lazy: async () => {
          const { default: GeneralBrowserExtension } = await import(
            "@/pages/GeneralSettings/BrowserExtensionApiKey"
          );
          return {
            Component: withManager(GeneralBrowserExtension),
          };
        },
      },
      {
        path: "/settings/workspace-chats",
        lazy: async () => {
          const { default: GeneralChats } = await import(
            "@/pages/GeneralSettings/Chats"
          );
          return { Component: withManager(GeneralChats) };
        },
      },
      {
        path: "/settings/invites",
        lazy: async () => {
          const { default: AdminInvites } = await import(
            "@/pages/Admin/Invitations"
          );
          return { Component: withManager(AdminInvites) };
        },
      },
      {
        path: "/settings/users",
        lazy: async () => {
          const { default: AdminUsers } = await import("@/pages/Admin/Users");
          return { Component: withManager(AdminUsers) };
        },
      },
      {
        path: "/settings/workspaces",
        lazy: async () => {
          const { default: AdminWorkspaces } = await import(
            "@/pages/Admin/Workspaces"
          );
          return { Component: withManager(AdminWorkspaces) };
        },
      },
      // Onboarding Flow
      {
        path: "/onboarding",
        element: <OnboardingFlow />,
      },
      {
        path: "/onboarding/:step",
        element: <OnboardingFlow />,
      },
      // Catch-all route for 404s
      {
        path: "*",
        lazy: async () => {
          const { default: NotFound } = await import("@/pages/404");
          return { Component: NotFound };
        },
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <REACTWRAP>
    <RouterProvider router={router} />
  </REACTWRAP>
);
