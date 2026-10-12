"use client";

/**
 * Shared admin building blocks (DESIGN-SYSTEM §9.15, §10.10–10.12): page header, hairline
 * sections, definition lists, status chips with icons, document numbers, segmented filters,
 * the page search field, pagination footer, error banner, sticky save bar.
 */
import type { ReactNode } from "react";
import {
  CheckCircleIcon,
  CheckSquareIcon,
  ClockIcon,
  SquareHalfBottomIcon,
  SquareIcon,
  ClockCounterClockwiseIcon,
  HourglassIcon,
  PackageIcon,
  PaperPlaneTiltIcon,
  TruckIcon,
  WarningCircleIcon,
  WarningIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  ArrowCounterClockwiseIcon,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { countSr } from "@/lib/format/plural";
import { compactDateTime, splitDocNumber } from "@/lib/admin/format";
import type { CompanyField } from "@/lib/domain/company";
import {
  ACTOR_TYPE_LABEL,
  ADMIN_INQUIRY_STATUS,
  COMPANY_FIELD_LABEL,
  ADMIN_ORDER_STATUS,
  STOCK_STATE_LABEL,
  STOCK_STATE_TONE,
} from "@/lib/i18n/sr/admin";
import type { InquiryStatus, OrderStatus } from "@/lib/i18n/sr/shop";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconButton, type IconButtonProps } from "@/components/ui/IconButton";
import { Input, type InputProps } from "@/components/ui/Input";
import { Kbd } from "@/components/ui/Kbd";
import { RouteLink } from "@/components/ui/RouteLink";
import { Tooltip } from "@/components/ui/Tooltip";
import { ADMIN } from "@/constants/routes";

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
      // min-w-0: a section is usually a grid/flex item; its truncating rows must not widen it.
      className={cn("min-w-0", panel && "panel", className)}
      // Panels arrive as blocks (the lite version inside the admin shell).
      data-reveal={panel ? "block" : undefined}
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
  ceka_deo: <WarningIcon size={14} weight="bold" />,
  spremna_za_preuzimanje: <PackageIcon size={14} weight="bold" />,
  poslata: <TruckIcon size={14} weight="bold" />,
  preuzeta: <CheckCircleIcon size={14} weight="bold" />,
  isporucena: <CheckCircleIcon size={14} weight="bold" />,
  zavrsena: <CheckSquareIcon size={14} weight="bold" />,
  otkazana: <XCircleIcon size={14} weight="bold" />,
};

/**
 * Admin chip: sentence case, 13 px (DESIGN-SYSTEM §9.15 — eleven caps chips in one table shout).
 * `dense` is the 20 px form for the caption line of a two-line table cell, so a flag never makes
 * its row taller than the 48 px grid. The `!` sizes win over the Badge defaults (`cn` only joins).
 */
export function Chip({ dense = false, className, ...rest }: BadgeProps & { dense?: boolean }) {
  return <Badge size="text" className={cn(dense && "h-5! px-1.5!", className)} {...rest} />;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = ADMIN_ORDER_STATUS[status];
  return (
    <Chip tone={s.tone} icon={ORDER_ICON[status]}>
      {s.label}
    </Chip>
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
    <Chip tone={s.tone} icon={INQUIRY_ICON[status]}>
      {s.label}
    </Chip>
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
      {actor.name && actor.type !== "system" && actor.name !== type ? (
        <span className="text-ink-3"> · {type}</span>
      ) : null}
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
      <div className="flex gap-1 rounded-md border border-line bg-surface-2 p-0.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-sm px-3 type-body-s transition-control focus-ring-inset",
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

/**
 * 36 px text input for toolbars, filter popovers and editable rows, the pair of `Select size="sm"`.
 * `Input` has no compact size, and a plain `h-9` loses to its own `h-11` (`cn` only joins), so the
 * size is set with `!`. Text is 14 px from md up and 16 px below it (iOS zooms a focused field
 * with smaller text).
 */
export function CompactInput({ className, inputClassName, ...rest }: InputProps) {
  return (
    <Input
      {...rest}
      className={cn("h-9!", className)}
      inputClassName={cn("md:text-[length:var(--text-body-s)]!", inputClassName)}
    />
  );
}

/**
 * Icon-only button whose name is also shown as a tooltip on hover and on keyboard focus — the
 * name was only in `aria-label` before. A menu trigger cannot be wrapped (the menu clones its
 * props onto its child), so those pass `title` to `IconButton` instead.
 */
export function IconAction(props: IconButtonProps) {
  return (
    <Tooltip content={props.label}>
      <IconButton {...props} />
    </Tooltip>
  );
}

/** „Šta se promenilo“ in sentence case: labels kept in lower case for running text start a chip. */
export function sentenceCase(text: string): string {
  return text.charAt(0).toLocaleUpperCase("sr-Latn") + text.slice(1);
}

/** Surface for a control that sits on the page field, not in a panel: white, so it reads as a field. */
export const ON_PAGE_FIELD = "bg-surface-1!";

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
    <CompactInput
      data-admin-search=""
      type="search"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      prefix={<MagnifyingGlassIcon size={16} />}
      suffix={
        <Kbd aria-hidden="true" className="hidden sm:inline-flex">
          /
        </Kbd>
      }
      className={cn(ON_PAGE_FIELD, "sm:w-[280px]", className)}
    />
  );
}

/**
 * Footer under paginated tables: „50 od 243 porudžbine“ when the list knows its total, else the
 * rows shown, + „Učitaj još“.
 */
export function LoadMoreFooter({
  shown,
  status,
  onMore,
  pageSize = 50,
  forms = ["red", "reda", "redova"],
  total,
  totalCap,
}: {
  shown: number;
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  onMore: (n: number) => void;
  pageSize?: number;
  /** Serbian plural forms: one, few, many („porudžbina“, „porudžbine“, „porudžbina“). */
  forms?: readonly [string, string, string];
  /** Rows in the whole list for the current view; leave out when filters make it unknown. */
  total?: number;
  /** The count query stops at this number: at the cap the total reads „500+“. */
  totalCap?: number;
}) {
  if (status === "LoadingFirstPage" || shown === 0) return null;
  const exhausted = status === "Exhausted";
  // A stale or capped total never claims fewer rows than are on screen.
  const known = !exhausted && total !== undefined && total >= shown;
  const capped = known && totalCap !== undefined && total >= totalCap;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 type-body-s text-ink-3">
      <span className="tabular-nums" data-reveal="off">
        {known ? (
          <>
            Prikazano: <span className="font-semibold text-ink-2">{shown}</span> od{" "}
            {capped ? `${total}+ ${forms[2]}` : countSr(total, forms)}
          </>
        ) : (
          <>
            Prikazano: {countSr(shown, forms)}
            {exhausted ? " — kraj liste." : ""}
          </>
        )}
      </span>
      {!exhausted ? (
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
      className="flex items-start gap-3 rounded-md border border-danger bg-danger-subtle px-4 py-3 type-body-s text-danger"
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

/** „52 / 60“ — characters used of the visible limit; over the limit turns warning. */
/** `n / max`; turns to a warning past `warnAt` (default `max`), e.g. 170 allowed, 155 shown by Google. */
export function CharCount({
  value,
  max,
  warnAt = max,
}: {
  value: string;
  max: number;
  warnAt?: number;
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap type-caption tabular-nums",
        value.length > warnAt ? "font-semibold text-warning" : "text-ink-3",
      )}
    >
      {value.length}&nbsp;/&nbsp;{max}
    </span>
  );
}

/** Call / Viber / WhatsApp for a customer phone number (E.164 or formatted). */
export function ContactActions({ phone }: { phone: string | undefined }) {
  // Whitespace out of the tel: link, digits only for Viber and WhatsApp. (The two patterns had
  // lost their backslashes — `/s/g`, `/D/g` — so the deep links carried spaces and a second „+“.)
  const tel = phone?.replace(/\s/g, "");
  const digits = phone?.replace(/\D/g, "");
  if (!tel || !digits) return null;
  return (
    // Three equal actions in one panel: filled `quiet` buttons, not three outlines.
    <div className="mt-4 flex flex-wrap gap-2">
      <Button asChild variant="quiet" size="sm">
        <a href={`tel:${tel}`}>Pozovi</a>
      </Button>
      <Button asChild variant="quiet" size="sm">
        <a href={`viber://chat?number=%2B${digits}`}>Viber</a>
      </Button>
      <Button asChild variant="quiet" size="sm">
        <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      </Button>
    </div>
  );
}

/** Missing seller data (legal name, PIB, address, phone, account) with a link to fix it. */
export function CompanySetupNotice({
  missing,
  className,
}: {
  missing: readonly CompanyField[];
  className?: string;
}) {
  if (missing.length === 0) return null;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border border-warning bg-warning-subtle px-4 py-3 type-body-s text-ink-1",
        className,
      )}
    >
      <WarningIcon size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
      <p className="flex-1">
        Podaci o firmi nisu popunjeni: {missing.map((f) => COMPANY_FIELD_LABEL[f]).join(", ")}.
        Predračun, otpremnica i podnožje sajta ih prikazuju.{" "}
        <RouteLink
          href={ADMIN.settingsTab("firma")}
          className="font-semibold text-accent-text underline underline-offset-2"
        >
          Popuni u podešavanjima
        </RouteLink>
      </p>
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
    <div className="sticky bottom-0 z-sticky -mx-4 mt-6 border-t border-line bg-surface-1 px-4 py-3 shadow-[0_-1px_2px_rgb(18_21_24/0.06)] lg:-mx-6 lg:px-6 print:hidden">
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

const STOCK_ICON: Record<keyof typeof STOCK_STATE_LABEL, ReactNode> = {
  in_stock: <SquareIcon size={12} weight="fill" />,
  low_stock: <SquareHalfBottomIcon size={12} weight="fill" />,
  out_of_stock: <SquareIcon size={12} />,
  on_order: <ClockIcon size={12} weight="bold" />,
};

/** Stock chip with the DS §3.6 icon + word (status never by colour alone). */
export function StockStateBadge({
  state,
  dense,
}: {
  state: keyof typeof STOCK_STATE_LABEL;
  dense?: boolean;
}) {
  return (
    <Chip tone={STOCK_STATE_TONE[state]} icon={STOCK_ICON[state]} dense={dense}>
      {STOCK_STATE_LABEL[state]}
    </Chip>
  );
}

/** Small „Demo“ tag for seeded rows. */
export function DemoTag() {
  return (
    <Chip tone="outline" dense>
      Demo
    </Chip>
  );
}
