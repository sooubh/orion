import { Shuffle } from "@phosphor-icons/react";
import RouterAnimation from "@/media/animations/router-animation.webm";
import { Trans } from "react-i18next";

/**
 * Ephemeral notification shown during streaming when the model router
 * switches to a different model via a matched rule. Disappears on page refresh.
 * @param {Object} props
 * @param {Object} props.routedTo - { model, ruleTitle, routerName }
 * @param {boolean} [props.isStreaming] - whether the response is still streaming
 */
export default function ModelRouteNotification({ routedTo, isStreaming }) {
  if (!routedTo) return null;

  return (
    <div className="flex w-full my-2">
      <div className="rounded-full bg-slate-100 dark:bg-[#16181d] border border-slate-200 dark:border-[#22262d] px-4 py-1.5 flex items-center gap-2 shadow-xs">
        <RouterIcon isStreaming={isStreaming} />
        <span className="text-sm text-slate-700 dark:text-zinc-300 whitespace-nowrap">
          {routedTo.ruleTitle ? (
            <Trans
              i18nKey="model-router.chat.routed-to-rule"
              values={{
                model: routedTo.model,
                ruleTitle: routedTo.ruleTitle,
              }}
              components={{
                route: <span className="text-slate-950 dark:text-white font-semibold" />,
                rule: <span />,
              }}
            />
          ) : (
            <Trans
              i18nKey="model-router.chat.routed-to"
              values={{
                model: routedTo.model,
              }}
              components={{
                route: <span className="text-slate-950 dark:text-white font-semibold" />,
              }}
            />
          )}
        </span>
      </div>
    </div>
  );
}

function RouterIcon({ isStreaming }) {
  if (!isStreaming)
    return (
      <Shuffle className="w-4 h-4 text-slate-900 dark:text-white flex-shrink-0" />
    );

  return (
    <video
      autoPlay
      muted
      playsInline
      className="w-4 h-4 flex-shrink-0 scale-[134%] dark:invert"
      aria-label="Routing to model..."
    >
      <source src={RouterAnimation} type="video/webm" />
    </video>
  );
}
