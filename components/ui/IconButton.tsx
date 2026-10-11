import { Slot } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Spinner } from "@/components/ui/Spinner";

export type IconButtonVariant = "ghost" | "quiet" | "primary" | "secondary";

const variants: Record<IconButtonVariant, string> = {
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink-1 disabled:text-ink-4",
  quiet:
    "border border-line-strong bg-surface-3 text-ink-1 shadow-rest hover:border-ink-4 hover:bg-surface-4 disabled:text-ink-4",
  secondary:
    "border border-control text-ink-1 hover:border-ink-3 hover:bg-surface-2 disabled:text-ink-4",
  primary:
    "bg-accent text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.24)] hover:bg-accent-hover active:bg-accent-active active:shadow-none focus-ring-inverse disabled:bg-surface-2 disabled:text-ink-4 disabled:shadow-none",
};

export type IconButtonProps = Omit<ComponentProps<"button">, "aria-label" | "children"> & {
  /** Accessible name — required, icon-only buttons have no visible label. */
  label: string;
  icon: ReactNode;
  variant?: IconButtonVariant;
  /** 44 px (default) or 36 px in dense admin toolbars. */
  size?: "md" | "sm";
  loading?: boolean;
  /** Small count badge (cart, notifications); „9+“ above 9. */
  count?: number;
  asChild?: boolean;
  children?: ReactNode;
};

/** Icon-only button (§9.1): 44 × 44 target, icon 20–24 px, mandatory accessible name. */
export function IconButton({
  label,
  icon,
  variant = "ghost",
  size = "md",
  loading = false,
  count,
  asChild = false,
  className,
  type,
  children,
  ...rest
}: IconButtonProps) {
  const classes = cn(
    "relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center rounded-sm transition-control active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0",
    size === "md" ? "size-11" : "size-9",
    variants[variant],
    className,
  );
  const badge =
    count !== undefined && count > 0 ? (
      <span
        aria-hidden="true"
        data-reveal="off"
        className="absolute right-0.5 top-0.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 font-ui text-[0.6875rem] font-bold tabular-nums leading-none text-on-accent"
      >
        {count > 9 ? "9+" : count}
      </span>
    ) : null;

  if (asChild) {
    return (
      <Slot.Root aria-label={label} className={classes} {...rest}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      type={type ?? "button"}
      aria-label={label}
      aria-busy={loading || undefined}
      className={classes}
      {...rest}
    >
      <span aria-hidden="true" className="inline-flex">
        {loading ? <Spinner size={20} /> : icon}
      </span>
      {badge}
    </button>
  );
}
