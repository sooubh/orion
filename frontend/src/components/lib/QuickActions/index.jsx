import { useTranslation } from "react-i18next";
import useUser from "@/hooks/useUser";

/**
 * Quick action buttons for home and empty workspace states.
 * @param {Object} props
 * @param {boolean} props.hasAvailableWorkspace - Whether the user has a workspace they can use
 * @param {Function} props.onCreateAgent - Handler for "Create an Agent" action
 * @param {Function} props.onEditWorkspace - Handler for "Edit Workspace" action
 * @param {Function} props.onUploadDocument - Handler for "Upload a Document" action
 */
export default function QuickActions({
  hasAvailableWorkspace,
  onCreateAgent,
  onEditWorkspace,
  onUploadDocument,
  onManageDocuments,
}) {
  const { t } = useTranslation();
  const { user } = useUser();

  return (
    <div className="flex flex-wrap justify-center gap-2 mt-6">
      <QuickActionButton
        label={t("main-page.quickActions.createAgent")}
        onClick={onCreateAgent}
        show={!user || ["admin"].includes(user?.role)}
      />
      <QuickActionButton
        label={t("main-page.quickActions.editWorkspace")}
        onClick={onEditWorkspace}
        show={
          hasAvailableWorkspace &&
          (!user || ["admin", "manager"].includes(user?.role))
        }
      />
      <QuickActionButton
        label={t("main-page.quickActions.uploadDocument")}
        onClick={onUploadDocument}
        // Any user can upload documents.
        show={true}
      />
      {onManageDocuments && (
        <QuickActionButton
          label="Browse Documents"
          onClick={onManageDocuments}
          show={true}
        />
      )}
    </div>
  );
}

function QuickActionButton({ label, onClick, show = true }) {
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1c20] dark:hover:bg-[#25282e] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-[#2a2e35] text-xs font-medium leading-5 transition-colors cursor-pointer shadow-xs"
    >
      {label}
    </button>
  );
}
