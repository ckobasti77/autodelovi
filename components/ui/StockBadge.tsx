import type { ReactNode } from "react";
import { ClockIcon, SquareHalfBottomIcon, SquareIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { formatQuantity } from "@/lib/format";

export type StockStatus = "in_stock" | "low" | "on_order" | "out";

const LABEL: Record<StockStatus, string> = {
  in_stock: "Na stanju",
  low: "Malo na stanju",
  on_order: "Po porudžbini",
  out: "Nema na stanju",
};

const TONE: Record<StockStatus, { text: string; chip: string; icon: ReactNode }> = {
  in_stock: {
    text: "text-success",
    chip: "bg-success-subtle",
    icon: <SquareIcon size={14} weight="fill" />,
  },
  low: {
    text: "text-warning",
    chip: "bg-warning-subtle",
    icon: <SquareHalfBottomIcon size={14} weight="fill" />,
  },
  on_order: { text: "text-info", chip: "bg-info-subtle", icon: <ClockIcon size={14} /> },
  out: { text: "text-ink-3", chip: "bg-surface-2", icon: <SquareIcon size={14} /> },
};

/** Quantities are shown only up to 10 (§9.9). */
const SHOW_QUANTITY_MAX = 10;

export type StockBadgeProps = {
  status: StockStatus;
  quantity?: number;
  /** Lead time for „po porudžbini“, e.g. „3–5 dana“. */
  leadTime?: string;
  variant?: "inline" | "chip";
  className?: string;
};

export function stockLabel({
  status,
  quantity,
  leadTime,
}: Pick<StockBadgeProps, "status" | "quantity" | "leadTime">): string {
  const base = LABEL[status];
  if (
    (status === "in_stock" || status === "low") &&
    quantity !== undefined &&
    quantity > 0 &&
    quantity <= SHOW_QUANTITY_MAX
  ) {
    return `${base} · ${formatQuantity(quantity)}`;
  }
  if (status === "on_order" && leadTime) return `${base} · ${leadTime}`;
  return base;
}

/**
 * Stock status (§3.6, §9.9): icon shape + word (+ quantity or lead time) — never colour
 * alone, never hidden by the reveal (live value).
 */
export function StockBadge({
  status,
  quantity,
  leadTime,
  variant = "inline",
  className,
}: StockBadgeProps) {
  const tone = TONE[status];
  return (
    <span
      data-reveal="off"
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap type-caption",
        tone.text,
        variant === "chip" && cn("h-6 rounded-xs px-2", tone.chip),
        className,
      )}
    >
      <span aria-hidden="true" className="inline-flex">
        {tone.icon}
      </span>
      {stockLabel({ status, quantity, leadTime })}
    </span>
  );
}
