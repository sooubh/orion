import { useEffect, useState } from "react";
import Sidebar from "@/components/SettingsSidebar";
import { isMobile } from "react-device-detect";
import showToast from "@/utils/toast";
import System from "@/models/system";
import paths from "@/utils/paths";
import { AUTH_TIMESTAMP, AUTH_TOKEN, AUTH_USER } from "@/utils/constants";
import PreLoader from "@/components/Preloader";
import CTAButton from "@/components/lib/CTAButton";
import { useTranslation } from "react-i18next";
import Toggle from "@/components/lib/Toggle";
import { ShieldCheck, Users, LockKey } from "@phosphor-icons/react";
import {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_PATTERN,
} from "@/utils/username";

export default function GeneralSecurity() {
  const { t } = useTranslation();
  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <Sidebar />
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-auto modern-scrollbar p-4 md:p-8"
      >
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Breadcrumb & Header */}
          <div className="pb-6 border-b border-theme-sidebar-border/40">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-1.5">
              <span>Settings</span>
              <span>/</span>
              <span>Security</span>
              <span>/</span>
              <span className="text-indigo-400 font-semibold">Access Control</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <ShieldCheck size={24} className="text-indigo-400" weight="duotone" />
              {t("security.title")}
            </h1>
            <p className="text-xs md:text-sm text-zinc-400 mt-1">
              Configure system authentication, multi-user role management, and access controls.
            </p>
          </div>

          <MultiUserMode />
          <PasswordProtection />
        </div>
      </div>
    </div>
  );
}

function MultiUserMode() {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [useMultiUserMode, setUseMultiUserMode] = useState(false);
  const [multiUserModeEnabled, setMultiUserModeEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setHasChanges(false);
    if (useMultiUserMode) {
      const form = new FormData(e.target);
      const data = {
        username: form.get("username"),
        password: form.get("password"),
      };

      const { success, error } = await System.setupMultiUser(data);
      if (success) {
        showToast("Multi-User mode enabled successfully.", "success");
        setSaving(false);
        setTimeout(() => {
          window.localStorage.removeItem(AUTH_USER);
          window.localStorage.removeItem(AUTH_TOKEN);
          window.localStorage.removeItem(AUTH_TIMESTAMP);
          window.location = paths.settings.users();
        }, 2_000);
        return;
      }

      showToast(`Failed to enable Multi-User mode: ${error}`, "error");
      setSaving(false);
      return;
    }
  };

  useEffect(() => {
    async function fetchIsMultiUserMode() {
      setLoading(true);
      const multiUserModeEnabled = await System.isMultiUserMode();
      setMultiUserModeEnabled(multiUserModeEnabled);
      setLoading(false);
    }
    fetchIsMultiUserMode();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <PreLoader />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onChange={() => setHasChanges(true)}
      className="rounded-2xl bg-theme-bg-sidebar/40 border border-theme-sidebar-border/50 p-6 space-y-6 shadow-sm"
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
            <Users size={22} weight="duotone" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              {t("security.multiuser.title")}
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
              {t("security.multiuser.description")}
            </p>
          </div>
        </div>

        {multiUserModeEnabled ? (
          <span className="self-start px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {t("security.multiuser.enable.is-enable")}
          </span>
        ) : (
          <div className="self-start">
            <Toggle
              size="md"
              label={t("security.multiuser.enable.enable")}
              enabled={useMultiUserMode}
              onChange={(checked) => setUseMultiUserMode(checked)}
            />
          </div>
        )}
      </div>

      {useMultiUserMode && !multiUserModeEnabled && (
        <div className="pt-4 border-t border-theme-sidebar-border/40 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label
              htmlFor="username"
              className="text-xs font-semibold text-zinc-300 block"
            >
              {t("security.multiuser.enable.username")}
            </label>
            <input
              name="username"
              type="text"
              className="w-full px-3.5 py-2.5 rounded-xl bg-theme-settings-input-bg border border-theme-sidebar-border/60 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              placeholder="Your admin username"
              minLength={USERNAME_MIN_LENGTH}
              maxLength={USERNAME_MAX_LENGTH}
              pattern={USERNAME_PATTERN}
              required={true}
              autoComplete="off"
            />
            <p className="text-[11px] text-zinc-500">
              {t("common.username_requirements")}
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-xs font-semibold text-zinc-300 block"
            >
              {t("security.multiuser.enable.password")}
            </label>
            <input
              name="password"
              type="password"
              className="w-full px-3.5 py-2.5 rounded-xl bg-theme-settings-input-bg border border-theme-sidebar-border/60 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              placeholder="Your admin password"
              minLength={8}
              required={true}
              autoComplete="off"
            />
            <p className="text-[11px] text-zinc-500">
              Minimum 8 characters required.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-theme-sidebar-border/30">
        <p className="text-xs text-zinc-500 leading-relaxed max-w-lg">
          {t("security.multiuser.enable.description")}
        </p>
        {hasChanges && (
          <CTAButton onClick={() => handleSubmit()} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </CTAButton>
        )}
      </div>
    </form>
  );
}

export const PW_REGEX = new RegExp(/^[a-zA-Z0-9_\-!@$%^&*();]+$/);
function PasswordProtection() {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [multiUserModeEnabled, setMultiUserModeEnabled] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (multiUserModeEnabled) return false;
    const form = new FormData(e.target);

    if (!PW_REGEX.test(form.get("password"))) {
      showToast(
        `Your password has restricted characters in it. Allowed symbols are _,-,!,@,$,%,^,&,*,(,),;`,
        "error"
      );
      setSaving(false);
      return;
    }

    setSaving(true);
    setHasChanges(false);
    const data = {
      usePassword,
      newPassword: form.get("password"),
    };

    const { success, error } = await System.updateSystemPassword(data);
    if (success) {
      showToast("Your page will refresh in a few seconds.", "success");
      setSaving(false);
      setTimeout(() => {
        window.localStorage.removeItem(AUTH_USER);
        window.localStorage.removeItem(AUTH_TOKEN);
        window.localStorage.removeItem(AUTH_TIMESTAMP);
        window.location.reload();
      }, 3_000);
      return;
    } else {
      showToast(`Failed to update password: ${error}`, "error");
      setSaving(false);
    }
  };

  useEffect(() => {
    async function fetchIsMultiUserMode() {
      setLoading(true);
      const multiUserModeEnabled = await System.isMultiUserMode();
      const settings = await System.keys();
      setMultiUserModeEnabled(multiUserModeEnabled);
      setUsePassword(settings?.RequiresAuth);
      setLoading(false);
    }
    fetchIsMultiUserMode();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <PreLoader />
      </div>
    );
  }

  if (multiUserModeEnabled) return null;
  return (
    <form
      onSubmit={handleSubmit}
      onChange={() => setHasChanges(true)}
      className="rounded-2xl bg-theme-bg-sidebar/40 border border-theme-sidebar-border/50 p-6 space-y-6 shadow-sm"
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
            <LockKey size={22} weight="duotone" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              {t("security.password.title")}
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
              {t("security.password.description")}
            </p>
          </div>
        </div>

        <div className="self-start">
          <Toggle
            size="md"
            label={t("security.password.title")}
            enabled={usePassword}
            onChange={(checked) => setUsePassword(checked)}
          />
        </div>
      </div>

      {usePassword && (
        <div className="pt-4 border-t border-theme-sidebar-border/40 max-w-md space-y-2">
          <label
            htmlFor="password"
            className="text-xs font-semibold text-zinc-300 block"
          >
            {t("security.password.password-label")}
          </label>
          <input
            name="password"
            type="password"
            className="w-full px-3.5 py-2.5 rounded-xl bg-theme-settings-input-bg border border-theme-sidebar-border/60 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
            placeholder="Your Instance Password"
            minLength={8}
            required={true}
            autoComplete="off"
            defaultValue={usePassword ? "********" : ""}
          />
          <p className="text-[11px] text-zinc-500">
            Allowed symbols: _ - ! @ $ % ^ &amp; * ( ) ;
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-theme-sidebar-border/30">
        <p className="text-xs text-zinc-500 leading-relaxed max-w-lg">
          {t("security.password.description")}
        </p>
        {hasChanges && (
          <CTAButton onClick={() => handleSubmit()} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </CTAButton>
        )}
      </div>
    </form>
  );
}

