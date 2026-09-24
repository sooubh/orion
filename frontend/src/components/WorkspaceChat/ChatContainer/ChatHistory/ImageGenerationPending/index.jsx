import { memo } from "react";
import { useTranslation } from "react-i18next";
import { CircleNotch, XCircle } from "@phosphor-icons/react";

/**
 * Placeholder shown while an `/img` generation is in progress, or after it was
 * aborted by the user. When `aborted` is true the spinner is replaced with a
 * static notice so the card doesn't stay in a loading state forever.
 */
function ImageGenerationPending({ aborted = false }) {
  const { t } = useTranslation();

  if (aborted) {
    return (
      <div className="my-2">
        <div className="w-full max-w-[280px]">
          <div className="relative rounded-xl overflow-hidden aspect-square border border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-900" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-y-3 text-center px-5">
              <XCircle
                size={32}
                weight="bold"
                className="text-slate-500 dark:text-white/60"
              />
              <p className="text-slate-700 dark:text-zinc-300 text-sm font-medium">
                {t("imageGeneration.pending.aborted")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-2">
      <div className="w-full max-w-[280px]">
        <div className="relative rounded-xl overflow-hidden aspect-square border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 dark:from-zinc-600 dark:via-zinc-800 dark:to-zinc-900 blur-2xl animate-pulse" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-y-3 text-center px-5">
            <CircleNotch
              size={32}
              weight="bold"
              className="animate-spin text-slate-700 dark:text-white"
            />
            <p className="text-slate-900 dark:text-white text-sm font-semibold">
              {t("imageGeneration.pending.heading")}
            </p>
            <p className="text-slate-600 dark:text-zinc-400 text-xs leading-relaxed">
              {t("imageGeneration.pending.description")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ImageGenerationPending);
