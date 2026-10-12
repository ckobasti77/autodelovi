"use client";

/**
 * Shared pieces of the import screens: status and row-action badges (icon + word), the
 * progress bar (GSAP, reduced motion respected), count tiles and the issue list.
 */
import { useRef, type ReactNode } from "react";
import {
  ArrowCounterClockwiseIcon,
  CheckCircleIcon,
  CircleDashedIcon,
  ClockIcon,
  MinusCircleIcon,
  PencilSimpleIcon,
  PlusCircleIcon,
  SkipForwardIcon,
  SpinnerGapIcon,
  WarningCircleIcon,
  WarningIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";
import { formatNumber } from "@/lib/format/number";
import { FIELD_BY_KEY, type ImportField } from "@/lib/import/fields";
import { PRODUCT_FIELD_LABEL } from "@/lib/i18n/sr/auditLabels";
import {
  IMPORT_STATUS,
  ROW_ACTION,
  type ImportBatchStatus,
  type RowActionKey,
} from "@/lib/i18n/sr/import";
import { Badge } from "@/components/ui/Badge";

const STATUS_ICON: Record<ImportBatchStatus, ReactNode> = {
  staging: <CircleDashedIcon size={14} weight="bold" />,
  validated: <ClockIcon size={14} weight="bold" />,
  committing: <SpinnerGapIcon size={14} weight="bold" />,
  committed: <CheckCircleIcon size={14} weight="bold" />,
  failed: <XCircleIcon size={14} weight="bold" />,
  rolling_back: <ArrowCounterClockwiseIcon size={14} weight="bold" />,
  rolled_back: <ArrowCounterClockwiseIcon size={14} weight="bold" />,
  cancelled: <MinusCircleIcon size={14} weight="bold" />,
};

export function ImportStatusBadge({ status }: { status: ImportBatchStatus }) {
  const s = IMPORT_STATUS[status];
  return (
    <Badge size="text" tone={s.tone} icon={STATUS_ICON[status]}>
      {s.label}
    </Badge>
  );
}

const ACTION_ICON: Record<RowActionKey, ReactNode> = {
  create: <PlusCircleIcon size={14} weight="bold" />,
  update: <PencilSimpleIcon size={14} weight="bold" />,
  unchanged: <MinusCircleIcon size={14} weight="bold" />,
  skip: <SkipForwardIcon size={14} weight="bold" />,
  error: <WarningCircleIcon size={14} weight="bold" />,
};

export function RowActionBadge({ action }: { action: RowActionKey }) {
  const a = ROW_ACTION[action];
  return (
    <Badge size="text" tone={a.tone} icon={ACTION_ICON[action]}>
      {a.label}
    </Badge>
  );
}

/** Field key (import field or product field) → Serbian label. */
export function fieldLabel(field: string | undefined): string {
  if (!field) return "";
  if (field in FIELD_BY_KEY) return FIELD_BY_KEY[field as ImportField].label;
  return PRODUCT_FIELD_LABEL[field] ?? field;
}

export function ProgressBar({
  value,
  max,
  label,
  tone = "accent",
}: {
  value: number;
  max: number;
  label: string;
  tone?: "accent" | "success" | "warning";
}) {
  const fill = useRef<HTMLSpanElement>(null);
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  useGSAP(
    () => {
      if (!fill.current) return;
      gsap.to(fill.current, {
        scaleX: ratio,
        duration: prefersReducedMotion() ? 0 : 0.35,
        ease: "sk.out",
      });
    },
    { dependencies: [ratio] },
  );
  return (
    <div className="flex flex-col gap-1.5" data-reveal="off">
      <div className="flex items-baseline justify-between gap-3 type-body-s">
        <span className="text-ink-2">{label}</span>
        <span className="tabular-nums text-ink-1">
          {formatNumber(value)} / {formatNumber(max)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <span
          ref={fill}
          className={cn(
            "block h-full w-full origin-left scale-x-0 rounded-full",
            tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-accent",
          )}
        />
      </div>
    </div>
  );
}

export type CountTile = {
  key: string;
  label: string;
  value: number;
  tone?: "danger" | "warning" | "success";
  hint?: string;
};

/** KPI-style counts separated by hairlines (no cards), DS §10.10. */
export function CountTiles({ tiles }: { tiles: CountTile[] }) {
  return (
    <dl
      className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3 lg:grid-cols-5"
      data-reveal="off"
    >
      {tiles.map((t) => (
        <div key={t.key} className="flex min-w-0 flex-col gap-1 bg-surface-1 px-4 py-3">
          <dt className="type-caption text-ink-3">{t.label}</dt>
          <dd
            className={cn(
              "type-numeral-l leading-none",
              t.tone === "danger" && t.value > 0
                ? "text-danger"
                : t.tone === "warning" && t.value > 0
                  ? "text-warning"
                  : "text-ink-1",
            )}
          >
            {formatNumber(t.value)}
          </dd>
          {t.hint ? <dd className="type-caption text-ink-3">{t.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

export type Issue = { code?: string; field?: string; message: string };

/** Errors first (danger, X icon), then warnings (warning icon). */
export function IssueList({
  errors,
  warnings,
  max = 4,
}: {
  errors: readonly Issue[];
  warnings: readonly Issue[];
  max?: number;
}) {
  const items = [
    ...errors.map((e) => ({ ...e, kind: "error" as const })),
    ...warnings.map((w) => ({ ...w, kind: "warning" as const })),
  ];
  const shown = items.slice(0, max);
  return (
    <ul className="flex flex-col gap-0.5 type-caption">
      {shown.map((item, i) => (
        <li
          key={i}
          className={cn(
            "flex items-start gap-1.5",
            item.kind === "error" ? "text-ink-1" : "text-ink-2",
          )}
        >
          {item.kind === "error" ? (
            <XCircleIcon
              size={14}
              weight="bold"
              className="mt-px shrink-0 text-danger"
              aria-hidden="true"
            />
          ) : (
            <WarningIcon
              size={14}
              weight="bold"
              className="mt-px shrink-0 text-warning"
              aria-hidden="true"
            />
          )}
          <span className="sr-only">{item.kind === "error" ? "Greška: " : "Upozorenje: "}</span>
          <span className="min-w-0">{item.message}</span>
        </li>
      ))}
      {items.length > max ? <li className="text-ink-3">i još {items.length - max}</li> : null}
    </ul>
  );
}
