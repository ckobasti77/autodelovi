import { cn } from "@/lib/cn";
import { BRAND_LOCKUP_NAME, BRAND_NAME } from "@/lib/domain/brand";

import { LOGO_HORIZONTAL, LOGO_MARK, LOGO_STACKED } from "./logoPaths";

/**
 * The Euromotors Plus · OEM Parts logo as inline SVG (DESIGN-SYSTEM §2): an open arc of stars
 * around the name. One ink, `currentColor` — `text-ink-1` gives the night variant on the
 * storefront and the paper variant under `data-theme="paper"`; documents take the heritage navy
 * (`LogoDocument`). The logo has no accent: the orange stays the site's signal colour.
 *
 * Size a logo by its height (`h-12 w-auto`); the width follows the artwork. Minimum heights:
 * horizontal lockup 36 px, stacked 128 px, mark 16 px. Below the minimum use the next smaller
 * form, never a squeezed one.
 *
 * `label` is the accessible name. Pass `null` when the logo sits inside a link or a figure that
 * is already named — the artwork is then hidden from assistive technology.
 */
type LogoProps = {
  className?: string;
  label?: string | null;
};

type Form = { readonly w: number; readonly h: number; readonly d: string };

const a11y = (label: string | null) =>
  label === null
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": label } as const);

function Art({ form, label, className }: { form: Form; label: string | null; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${form.w} ${form.h}`}
      width={form.w}
      height={form.h}
      fill="none"
      focusable={false}
      xmlns="http://www.w3.org/2000/svg"
      {...a11y(label)}
      className={cn("shrink-0", className)}
    >
      <path fill="currentColor" fillRule="evenodd" d={form.d} />
    </svg>
  );
}

/** The simplified mark: five stars in an open ring. For 32 px and below (phone header, admin rail). */
export function LogoMark({ className, label = BRAND_NAME }: LogoProps) {
  return <Art form={LOGO_MARK} label={label} className={className} />;
}

/** Compact mark + EUROMOTORS / PLUS — OEM Parts: site header, admin, status pages. */
export function LogoHorizontal({ className, label = BRAND_LOCKUP_NAME }: LogoProps) {
  return <Art form={LOGO_HORIZONTAL} label={label} className={className} />;
}

/** The primary logo: the arc of twelve stars around the name. For large, centred placements. */
export function LogoStacked({ className, label = BRAND_LOCKUP_NAME }: LogoProps) {
  return <Art form={LOGO_STACKED} label={label} className={className} />;
}

/**
 * The logo on a document (predračun, otpremnica): the horizontal lockup in the heritage navy of
 * the company's original logo, 56 px on paper and from `md`, 44 px on a narrow screen.
 */
export function LogoDocument({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex text-heritage", className)}>
      <LogoHorizontal className="h-11 w-auto md:h-14 print:h-14" />
    </span>
  );
}
