import { Children } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { useModalEscape } from "@/hooks/useModalEscape";

/** @type {Record<string, string>} max-width per size, matched to the Figma modal frames */
const SIZE_CLASSES = {
  sm: "max-w-[400px]",
  md: "max-w-[500px]",
  lg: "max-w-[640px]",
  xl: "max-w-[868px]",
};

/**
 * Single, reusable modal shell for the app. Renders a centered, blurred
 * backdrop and the uniform modal card, then portals to the app root. Compose
 * the inner layout with the exported `ModalHeader`, `ModalBody`, and
 * `ModalFooter` pieces - the body stays unopinionated and accepts whatever JSX
 * you need.
 *
 * For modals that are not card-shaped (lightboxes, citations, etc.) pass
 * `variant="bare"` to skip the card chrome and just center the children.
 *
 * @param {Object} props - Component props
 * @param {import("react").ReactNode} props.children - The DOM/JSX to render inside the modal
 * @param {boolean} props.isOpen - Renders the modal when true
 * @param {() => void} [props.onClose] - Called when the modal requests to close (e.g. Escape key)
 * @param {"sm"|"md"|"lg"|"xl"} [props.size="md"] - Card max-width preset (400/500/640/868px)
 * @param {"default"|"bare"} [props.variant="default"] - `default` renders the uniform card; `bare` centers raw children
 * @param {string} [props.className] - Extra classes appended to the backdrop container (e.g. a higher `z-` to clear a page's fixed top bar)
 * @param {boolean} [props.closeOnEsc=true] - Whether pressing Escape calls `onClose`. Some modals require a forced choice and should opt out.
 * @param {boolean} [props.noPortal=false] - Render inline instead of portaling to #root. Used for sub-DOM modals that must render as a child element.
 *   Note: this can impact the backdrop presentation due to conflicting DOM positions, so double check it renders as desired.
 */
export default function Modal({
  children,
  isOpen,
  onClose,
  size = "md",
  variant = "default",
  className = "",
  closeOnEsc = true,
  noPortal = false,
}) {
  useModalEscape(isOpen && closeOnEsc, onClose);

  if (!isOpen) return null;

  const backdrop =
    `bg-black/60 backdrop-blur-sm fixed top-0 left-0 outline-none w-screen h-screen flex items-center justify-center z-99 ${className}`.trim();

  if (variant === "bare") {
    const bare = <div className={backdrop}>{children}</div>;
    if (noPortal) return bare;
    return createPortal(bare, document.getElementById("root"));
  }

  const content = (
    <div className={backdrop}>
      <div
        className={`relative w-full ${SIZE_CLASSES[size] || SIZE_CLASSES.md} mx-4 flex flex-col gap-y-5 p-6 rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] text-slate-900 dark:text-white`}
      >
        {children}
      </div>
    </div>
  );

  if (noPortal) return content;
  return createPortal(content, document.getElementById("root"));
}

/**
 * Modal header: title (required), optional muted subtitle, and a close button.
 *
 * @param {Object} props - Component props
 * @param {import("react").ReactNode} props.title - The header title
 * @param {import("react").ReactNode} [props.subtitle] - Muted helper line under the title
 * @param {() => void} [props.onClose] - Renders the close button when provided
 * @param {import("react").ReactNode} [props.children] - Extra header content rendered below the subtitle
 */
export function ModalHeader({ title, subtitle, onClose, children }) {
  return (
    <div className="flex flex-col gap-y-1 w-full">
      <div className="flex items-start justify-between gap-x-2 w-full">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white break-words">
          {title}
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            type="button"
            aria-label="Close"
            className="border-none bg-transparent p-1 -m-1 rounded-lg text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors duration-200 cursor-pointer"
          >
            <X size={16} weight="bold" />
          </button>
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-slate-500 dark:text-zinc-400">{subtitle}</p>
      )}
      {children}
    </div>
  );
}

/**
 * Modal body: the unopinionated content region. Stacks children with the
 * standard field spacing; pass `className` to override the layout.
 *
 * @param {Object} props - Component props
 * @param {import("react").ReactNode} props.children - Body content
 * @param {string} [props.className] - Extra classes appended to the body container
 */
export function ModalBody({ children, className = "" }) {
  return (
    <div className={`flex flex-col gap-y-4 w-full ${className}`}>
      {children}
    </div>
  );
}

/**
 * Modal footer: the action row. With multiple actions it defaults to
 * `justify-between` (Cancel left, primary right) to match the design; with a
 * single action it right-aligns. Override with `className` when needed.
 *
 * @param {Object} props - Component props
 * @param {import("react").ReactNode} props.children - Footer actions
 * @param {string} [props.className] - Extra classes appended to the footer container
 */
export function ModalFooter({ children, className = "" }) {
  const align =
    Children.count(children) > 1 ? "justify-between" : "justify-end";
  return (
    <div className={`flex items-center ${align} gap-x-2 w-full ${className}`}>
      {children}
    </div>
  );
}

const FIELD_BASE =
  "w-full text-sm rounded-lg outline-none bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#1f2328] text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-sky-500 dark:focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Field label matching the Figma input label (Medium 14).
 *
 * @param {Object} props - Component props (forwarded to the label element)
 * @param {boolean} [props.optional] - Appends a muted "(Optional)" suffix
 * @param {string} [props.className] - Extra classes appended to the label
 */
export function ModalLabel({ children, optional, className = "", ...props }) {
  return (
    <label
      {...props}
      className={`text-sm font-medium text-slate-800 dark:text-zinc-200 ${className}`}
    >
      {children}
      {optional && (
        <span className="font-normal text-slate-500 dark:text-zinc-400">
          {" "}
          (Optional)
        </span>
      )}
    </label>
  );
}

/**
 * Muted helper/hint line shown under a label or field (Regular 12).
 *
 * @param {Object} props - Component props
 * @param {string} [props.className] - Extra classes appended to the hint
 */
export function ModalHint({ children, className = "" }) {
  return (
    <p className={`text-xs text-slate-500 dark:text-zinc-400 ${className}`}>
      {children}
    </p>
  );
}

/**
 * Labeled text input - the most-reused modal field. Renders label, input, and
 * optional hint with the uniform field styling. Extra props pass to `<input>`.
 *
 * @param {Object} props - Component props (forwarded to the input element)
 * @param {import("react").ReactNode} [props.label] - Field label
 * @param {import("react").ReactNode} [props.hint] - Helper line under the input
 * @param {boolean} [props.optional] - Marks the label "(Optional)"
 * @param {import("react").ReactNode} [props.leading] - Inline content rendered before the input (e.g. a "/" prefix)
 * @param {string} [props.className] - Extra classes appended to the input
 */
export function ModalInput({
  label,
  hint,
  optional,
  leading,
  className = "",
  id,
  name,
  ...props
}) {
  const inputId = id || name;
  return (
    <div className="flex flex-col gap-y-1.5 w-full">
      {label && (
        <ModalLabel htmlFor={inputId} optional={optional}>
          {label}
        </ModalLabel>
      )}
      <div className="relative flex items-center w-full">
        {leading && (
          <span className="absolute left-3.5 text-sm text-slate-400 dark:text-zinc-500 pointer-events-none">
            {leading}
          </span>
        )}
        <input
          id={inputId}
          name={name}
          className={`${FIELD_BASE} h-[34px] px-3.5 ${leading ? "pl-7" : ""} ${className}`}
          {...props}
        />
      </div>
      {hint && <ModalHint>{hint}</ModalHint>}
    </div>
  );
}

/**
 * Labeled textarea matching `ModalInput`. Extra props pass to `<textarea>`.
 *
 * @param {Object} props - Component props (forwarded to the textarea element)
 * @param {import("react").ReactNode} [props.label] - Field label
 * @param {import("react").ReactNode} [props.hint] - Helper line under the textarea
 * @param {boolean} [props.optional] - Marks the label "(Optional)"
 * @param {number} [props.rows=4] - Visible text rows
 * @param {string} [props.className] - Extra classes appended to the textarea
 */
export function ModalTextarea({
  label,
  hint,
  optional,
  rows = 4,
  className = "",
  id,
  name,
  ...props
}) {
  const inputId = id || name;
  return (
    <div className="flex flex-col gap-y-1.5 w-full">
      {label && (
        <ModalLabel htmlFor={inputId} optional={optional}>
          {label}
        </ModalLabel>
      )}
      <textarea
        id={inputId}
        name={name}
        rows={rows}
        className={`${FIELD_BASE} px-3.5 py-2.5 resize-none ${className}`}
        {...props}
      />
      {hint && <ModalHint>{hint}</ModalHint>}
    </div>
  );
}

const BUTTON_BASE =
  "flex items-center justify-center h-[34px] px-4 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

/**
 * Filled primary action button (Save/Create). Dark: light fill on dark text;
 * Light: dark fill on white text.
 *
 * @param {Object} props - Component props (forwarded to the button element)
 * @param {string} [props.className] - Extra classes appended to the button
 */
export function ModalPrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`${BUTTON_BASE} border-none bg-slate-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-slate-800 dark:hover:bg-zinc-200 font-semibold shadow-xs ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Outlined secondary action button (Cancel).
 *
 * @param {Object} props - Component props (forwarded to the button element)
 * @param {string} [props.className] - Extra classes appended to the button
 */
export function ModalSecondaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`${BUTTON_BASE} bg-transparent border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Destructive action button (Delete). Filled red.
 *
 * @param {Object} props - Component props (forwarded to the button element)
 * @param {string} [props.className] - Extra classes appended to the button
 */
export function ModalDangerButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`${BUTTON_BASE} border-none bg-rose-600 hover:bg-rose-500 text-white font-semibold ${className}`}
    >
      {children}
    </button>
  );
}
