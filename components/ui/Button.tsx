import { Slot } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Spinner } from "@/components/ui/Spinner";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-sm " +
  "transition-control cursor-pointer active:translate-y-px " +
  "disabled:cursor-not-allowed disabled:active:translate-y-0 disabled:shadow-none " +
  "aria-disabled:cursor-not-allowed aria-disabled:active:translate-y-0 aria-disabled:shadow-none";

/**
 * primary — the one next step of a region: accent fill with a lit top edge.
 * secondary — the single alternative beside it: a quiet outline.
 * quiet — repeated actions (card and row buttons, toolbars): a filled surface, no bright outline,
 *   so a grid of them does not read as a wall of boxes.
 */
const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.24)] hover:bg-accent-hover " +
    "active:bg-accent-active active:shadow-none focus-ring-inverse " +
    "disabled:bg-surface-2 disabled:text-ink-4 aria-disabled:bg-surface-2 aria-disabled:text-ink-4",
  secondary:
    "border border-control text-ink-1 hover:border-ink-3 hover:bg-surface-2 active:bg-surface-3 " +
    "disabled:border-line disabled:bg-transparent disabled:text-ink-4 aria-disabled:border-line aria-disabled:text-ink-4",
  quiet:
    "border border-line-strong bg-surface-3 text-ink-1 shadow-rest hover:border-ink-4 hover:bg-surface-4 " +
    "active:bg-surface-3 active:shadow-none " +
    "disabled:border-line disabled:bg-surface-1 disabled:text-ink-4 aria-disabled:border-line aria-disabled:bg-surface-1 aria-disabled:text-ink-4",
  ghost:
    "text-ink-2 hover:bg-surface-2 hover:text-ink-1 active:bg-surface-3 disabled:bg-transparent disabled:text-ink-4 aria-disabled:text-ink-4",
  danger:
    "border border-danger text-danger hover:bg-danger-subtle " +
    "disabled:border-line disabled:bg-transparent disabled:text-ink-4 aria-disabled:border-line aria-disabled:text-ink-4",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 type-button-s",
  md: "h-11 px-4 type-button",
  lg: "h-13 px-5 type-button",
  xl: "h-14 px-6 type-button",
};

export type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon (20 px; 16 px at sm). Replaced by the spinner while loading. */
  icon?: ReactNode;
  /** Trailing icon (16 px), e.g. ArrowRight. */
  trailingIcon?: ReactNode;
  /** Keeps the label and width, shows a spinner, sets aria-busy and blocks clicks. */
  loading?: boolean;
  fullWidth?: boolean;
  /** Render the child element (e.g. a Link) with button styling. */
  asChild?: boolean;
};

/**
 * Button (DESIGN-SYSTEM §9.1). One primary per view region. Radius 6. Hover changes colour in
 * 80 ms, press sinks 1 px in 140 ms (sk.snap) and loses its lit edge; loading keeps label and
 * width; focus ring is accent (ink on accent fills) and follows the radius.
 */
export function Button({
  variant = "primary",
  size = "md",
  icon,
  trailingIcon,
  loading = false,
  fullWidth = false,
  asChild = false,
  className,
  children,
  type,
  onClick,
  ...rest
}: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);

  if (asChild) {
    // Slottable places the icons inside the child element (e.g. a link), around its label.
    return (
      <Slot.Root className={classes} {...rest}>
        {icon ? (
          <span aria-hidden="true" className="inline-flex shrink-0">
            {icon}
          </span>
        ) : null}
        <Slot.Slottable>{children}</Slot.Slottable>
        {trailingIcon ? (
          <span aria-hidden="true" className="inline-flex shrink-0">
            {trailingIcon}
          </span>
        ) : null}
      </Slot.Root>
    );
  }

  const leading = loading ? <Spinner size={size === "sm" ? 16 : 20} /> : icon;
  // Without a leading icon the spinner overlays the (invisible) label so the width stays put.
  const overlaySpinner = loading && !icon;

  return (
    <button
      type={type ?? "button"}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? (event) => event.preventDefault() : onClick}
      className={classes}
      {...rest}
    >
      {leading && !overlaySpinner ? (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {leading}
        </span>
      ) : null}
      <span
        className={cn("inline-flex items-center gap-2", overlaySpinner && "invisible")}
        aria-hidden={overlaySpinner || undefined}
      >
        {children}
      </span>
      {/* The invisible label keeps the width; this copy keeps the accessible name. */}
      {overlaySpinner ? <span className="sr-only">{children}</span> : null}
      {trailingIcon ? (
        <span
          aria-hidden="true"
          className={cn("inline-flex shrink-0", overlaySpinner && "invisible")}
        >
          {trailingIcon}
        </span>
      ) : null}
      {overlaySpinner ? (
        <span className="absolute inset-0 inline-flex items-center justify-center">
          <Spinner size={size === "sm" ? 16 : 20} />
        </span>
      ) : null}
    </button>
  );
}
