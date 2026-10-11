import { useId } from "react";

import { cn } from "@/lib/cn";
import { BRAND_LOCKUP_NAME, BRAND_NAME } from "@/lib/domain/brand";

import { LOGO_HEADER, LOGO_LAYOUT, LOGO_MARK, LOGO_WORDMARK } from "./logoPaths";

/**
 * The Euromotors Plus by OEM Parts logo as inline SVG (DESIGN-SYSTEM §2). Ink follows
 * `currentColor` — `text-ink-1` gives the night variant on the storefront and the paper variant
 * under `data-theme="paper"` and in print; the plus is always the accent orange.
 *
 * Size a logo by its height (`h-8 w-auto`); the width follows the artwork. Minimum heights:
 * header lockup 28 px, lockup with the signature 56 px (stacked 120 px), mark 16 px. Below the
 * minimum use the next smaller form, never a squeezed one.
 *
 * `label` is the accessible name. Pass `null` when the logo sits inside a link or a figure that
 * is already named — the artwork is then hidden from assistive technology.
 */
type LogoProps = {
  className?: string;
  label?: string | null;
};

const a11y = (label: string | null) =>
  label === null
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": label } as const);

const box = (w: number, h: number) => ({
  viewBox: `0 0 ${w} ${h}`,
  width: w,
  height: h,
  fill: "none",
  focusable: false,
  xmlns: "http://www.w3.org/2000/svg",
});

/** The compact mark: the bracket-E holding the plus. For places too small for the name. */
export function LogoMark({ className, label = BRAND_NAME }: LogoProps) {
  return (
    <svg {...box(LOGO_MARK.w, LOGO_MARK.h)} {...a11y(label)} className={cn("shrink-0", className)}>
      <path fill="currentColor" fillRule="evenodd" d={LOGO_MARK.ink} />
      <path className="fill-accent" fillRule="evenodd" d={LOGO_MARK.accent} />
    </svg>
  );
}

/** Mark + EUROMOTORS / PLUS, without the signature: site header, admin, small formats. */
export function LogoHeader({ className, label = BRAND_NAME }: LogoProps) {
  return (
    <svg
      {...box(LOGO_HEADER.w, LOGO_HEADER.h)}
      {...a11y(label)}
      className={cn("shrink-0", className)}
    >
      <path fill="currentColor" fillRule="evenodd" d={LOGO_HEADER.ink} />
      <path className="fill-accent" fillRule="evenodd" d={LOGO_HEADER.accent} />
    </svg>
  );
}

function MarkPaths() {
  return (
    <>
      <path fill="currentColor" fillRule="evenodd" d={LOGO_MARK.ink} />
      <path className="fill-accent" fillRule="evenodd" d={LOGO_MARK.accent} />
    </>
  );
}

const place = (p: { x: number; y: number; scale?: number }) =>
  `translate(${p.x} ${p.y})${p.scale && p.scale !== 1 ? ` scale(${p.scale})` : ""}`;

/**
 * The primary logo with the „by OEM Parts“ signature: `horizontal` (mark left of the name) or
 * `stacked` (mark above the name, for narrow columns).
 */
export function LogoLockup({
  variant = "horizontal",
  className,
  label = BRAND_LOCKUP_NAME,
}: LogoProps & { variant?: "horizontal" | "stacked" }) {
  const layout = LOGO_LAYOUT[variant];
  return (
    <svg {...box(layout.w, layout.h)} {...a11y(label)} className={cn("shrink-0", className)}>
      <g transform={place(layout.mark)}>
        <MarkPaths />
      </g>
      <path
        fill="currentColor"
        fillRule="evenodd"
        transform={place(layout.wordmark)}
        d={LOGO_WORDMARK.ink}
      />
    </svg>
  );
}

/**
 * The primary logo that changes form with the available width: stacked below `sm` (480 px),
 * horizontal from there. Both forms draw the same outlines — they are defined once and
 * referenced, so the page carries the signature's path data a single time.
 *
 * `stackedClassName` / `horizontalClassName` size the two forms; visibility is handled here.
 */
export function LogoLockupResponsive({
  className,
  stackedClassName,
  horizontalClassName,
  label = BRAND_LOCKUP_NAME,
}: LogoProps & { stackedClassName?: string; horizontalClassName?: string }) {
  const id = useId();
  const markId = `${id}-mark`;
  const wordmarkId = `${id}-wordmark`;
  const form = (variant: "horizontal" | "stacked", formClassName: string) => {
    const layout = LOGO_LAYOUT[variant];
    return (
      <svg {...box(layout.w, layout.h)} aria-hidden="true" className={formClassName}>
        <use href={`#${markId}`} transform={place(layout.mark)} />
        <use href={`#${wordmarkId}`} transform={place(layout.wordmark)} />
      </svg>
    );
  };
  return (
    <span {...a11y(label)} className={cn("relative inline-block text-ink-1", className)}>
      {/* Definitions only: zero-sized, never rendered on its own. */}
      <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
        <defs>
          <g id={markId}>
            <MarkPaths />
          </g>
          <path id={wordmarkId} fill="currentColor" fillRule="evenodd" d={LOGO_WORDMARK.ink} />
        </defs>
      </svg>
      {form("stacked", cn("block sm:hidden", stackedClassName))}
      {form("horizontal", cn("hidden sm:block", horizontalClassName))}
    </span>
  );
}

/**
 * The logo on a document (predračun, otpremnica): the lockup with the signature on paper and
 * from `md`, the header lockup on a narrow screen where 445 px do not fit. Paper theme, so the
 * ink prints graphite and the plus orange.
 */
export function LogoDocument({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex text-ink-1", className)}>
      <LogoHeader className="h-8 w-auto md:hidden print:hidden" />
      <LogoLockup className="hidden h-14 w-auto md:block print:block" />
    </span>
  );
}
