"use client";

/**
 * Shared admin building blocks (DESIGN-SYSTEM §9.15, §10.10–10.12): page header, hairline
 * sections, definition lists, status chips with icons, document numbers, segmented filters,
 * the page search field, pagination footer, error banner, sticky save bar.
 */
import type { ReactNode } from "react";
import {
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  HourglassIcon,
  PackageIcon,
  PaperPlaneTiltIcon,
  ReceiptIcon,
  TruckIcon,
  WarningCircleIcon,
  WarningIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  ArrowCounterClockwiseIcon,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { compactDateTime, splitDocNumber } from "@/lib/admin/format";
import { ACTOR_TYPE_LABEL, ADMIN_INQUIRY_STATUS, ADMIN_ORDER_STATUS } from "@/lib/i18n/sr/admin";
import type { InquiryStatus, OrderStatus } from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[1.375rem] font-[650] leading-tight tracking-[-0.01em] text-ink-1">
            {title}
          </h1>
          {meta}
        </div>
        {description ? <p className="type-body-s text-ink-3">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Block with a 16 px title and a hairline; `panel` puts it on a white surface. */
export function Section({
  title,
  actions,
  children,
  panel = true,
  className,
  id,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  panel?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={title && id ? `${id}-title` : undefined}
      className={cn(panel && "rounded-sm border border-line bg-surface-1", className)}
    >
      {title || actions ? (
        <div
          className={cn(
            "flex min-h-12 items-center justify-between gap-3",
            panel ? "border-b border-line-faint px-4" : "pb-2",
          )}
        >
          {title ? (
            <h2
              id={id ? `${id}-title` : undefined}
              className="text-[1rem] font-semibold text-ink-1"
            >
              {title}
            </h2>
          ) : (
            <span />
          )}
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(panel && "p-4")}>{children}</div>
    </section>
  );
}

/** Label / value rows (13 px labels in ink-3). */
export function DefinitionList({
  rows,
  className,
}: {
  rows: { label: ReactNode; value: ReactNode; hidden?: boolean }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-[minmax(7rem,auto)_minmax(0,1fr)] gap-x-4 gap-y-2 type-body-s",
        className,
      )}
    >
      {rows
        .filter((r) => !r.hidden)
        .map((r, i) => (
          <div key={i} className="contents">
            <dt className="text-ink-3">{r.label}</dt>
            <dd className="min-w-0 break-words text-ink-1">{r.value}</dd>
          </div>
        ))}
    </dl>
  );
}

const ORDER_ICON: Record<OrderStatus, ReactNode> = {
  nova: <WarningCircleIcon size={14} weight="bold" />,
  potvrdjena: <CheckCircleIcon size={14} weight="bold" />,
  ceka_deo: <HourglassIcon size={14} weight="bold" />,
  spremna_za_preuzimanje: <PackageIcon size={14} weight="bold" />,
  poslata: <TruckIcon size={14} weight="bold" />,
  preuzeta: <CheckCircleIcon size={14} weight="bold" />,
  isporucena: <CheckCircleIcon size={14} weight="bold" />,
  zavrsena: <ReceiptIcon size={14} weight="bold" />,
  otkazana: <XCircleIcon size={14} weight="bold" />,
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = ADMIN_ORDER_STATUS[status];
  return (
    <Badge tone={s.tone} icon={ORDER_ICON[status]}>
      {s.label}
    </Badge>
  );
}

const INQUIRY_ICON: Record<InquiryStatus, ReactNode> = {
  nov: <WarningCircleIcon size={14} weight="bold" />,
  u_obradi: <HourglassIcon size={14} weight="bold" />,
  ponuda_poslata: <PaperPlaneTiltIcon size={14} weight="bold" />,
  prihvacena: <CheckCircleIcon size={14} weight="bold" />,
  odbijena: <XCircleIcon size={14} weight="bold" />,
  istekla: <ClockCounterClockwiseIcon size={14} weight="bold" />,
};

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  const s = ADMIN_INQUIRY_STATUS[status];
  return (
    <Badge tone={s.tone} icon={INQUIRY_ICON[status]}>
      {s.label}
    </Badge>
  );
}

/** `SK-2026-` in ink-3, `000187` in ink-1, mono 12.5 px 400 (§9.15). */
export function DocNumber({ number, className }: { number: string; className?: string }) {
  const { prefix, seq } = splitDocNumber(number);
  return (
    <span className={cn("type-code whitespace-nowrap", className)}>
      <span className="text-ink-3">{prefix}</span>
      <span className="text-ink-1">{seq}</span>
    </span>
  );
}

export function DateTimeCell({ ms, nowMs }: { ms: number; nowMs?: number }) {
  return (
    <span className="whitespace-nowrap tabular-nums text-ink-2">{compactDateTime(ms, nowMs)}</span>
  );
}

export function ActorLabel({
  actor,
}: {
  actor: { type: keyof typeof ACTOR_TYPE_LABEL | string; name?: string };
}) {
  const type = ACTOR_TYPE_LABEL[actor.type as keyof typeof ACTOR_TYPE_LABEL] ?? actor.type;
  return (
    <span className="text-ink-2">
      {actor.name ?? type}
      {actor.name && actor.type !== "system" ? <span className="text-ink-3"> · {type}</span> : null}
    </span>
  );
}

export type FilterOption<T extends string> = { value: T; label: string; count?: number };

/** Segmented status filter (§9.15): a labelled group of toggle buttons with counts. */
export function SegmentedFilter<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: FilterOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="scroll-fade-x -mx-1 flex max-w-full overflow-x-auto px-1"
    >
      <div className="flex gap-1 rounded-sm border border-line bg-surface-2 p-0.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xs px-3 type-body-s transition-control focus-ring-inset",
                active
                  ? "bg-surface-1 font-semibold text-ink-1 shadow-[0_1px_2px_rgb(18_21_24/0.12)]"
                  : "text-ink-2 hover:text-ink-1",
              )}
            >
              {o.label}
              {o.count !== undefined && o.count > 0 ? (
                <span className={cn("tabular-nums", active ? "text-accent-text" : "text-ink-3")}>
                  {o.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Page search (`/` focuses it). */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-xs border border-control bg-surface-1 px-3 transition-control hover:border-ink-3 focus-within:border-focus focus-within:shadow-[inset_0_0_0_1px_var(--color-focus)] sm:w-[280px]",
        className,
      )}
    >
      <MagnifyingGlassIcon size={16} className="shrink-0 text-ink-3" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input
        data-admin-search=""
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent type-body-s text-ink-1 outline-none placeholder:text-ink-3"
      />
      <Kbd aria-hidden="true" className="hidden sm:inline-flex">
        /
      </Kbd>
    </label>
  );
}

/** Footer under paginated tables: rows shown + „Učitaj još“. */
export function LoadMoreFooter({
  shown,
  status,
  onMore,
  pageSize = 50,
  noun = "redova",
}: {
  shown: number;
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  onMore: (n: number) => void;
  pageSize?: number;
  noun?: string;
}) {
  if (status === "LoadingFirstPage") return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 type-body-s text-ink-3">
      <span className="tabular-nums">
        Prikazano: {shown} {noun}
        {status === "Exhausted" ? " — to su svi." : ""}
      </span>
      {status !== "Exhausted" ? (
        <Button
          variant="secondary"
          size="sm"
          loading={status === "LoadingMore"}
          onClick={() => onMore(pageSize)}
        >
          Učitaj još {pageSize}
        </Button>
      ) : null}
    </div>
  );
}

export function ErrorBanner({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-sm border border-danger bg-danger-subtle px-4 py-3 type-body-s text-danger"
    >
      <WarningIcon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1">{children}</div>
      {onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          icon={<ArrowCounterClockwiseIcon size={16} />}
          onClick={onRetry}
        >
          Pokušaj ponovo
        </Button>
      ) : null}
    </div>
  );
}

/** Sticky bar at the bottom of editors while there are unsaved changes (§10.12). */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  message = "Imate nesačuvane izmene.",
  saveLabel = "Sačuvaj",
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  message?: string;
  saveLabel?: string;
}) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-0 z-sticky -mx-4 mt-6 border-t border-line bg-surface-1/95 px-4 py-3 backdrop-blur-sm lg:-mx-6 lg:px-6 print:hidden">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3">
        <p className="type-body-s text-ink-2" role="status">
          {message}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onDiscard} disabled={saving}>
            Odbaci izmene
          </Button>
          <Button onClick={onSave} loading={saving}>
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Small „Demo“ tag for seeded rows. */
export function DemoTag() {
  return (
    <Badge tone="outline" className="h-5 px-1.5">
      Demo
    </Badge>
  );
}
