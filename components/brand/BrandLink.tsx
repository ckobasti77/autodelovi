import { RouteLink } from "@/components/ui/RouteLink";

import { cn } from "@/lib/cn";
import { site } from "@/config/site";
import { ROUTES } from "@/constants/routes";

import { LogoHeader, LogoMark } from "./Logo";

/**
 * The logo as the way home (DESIGN-SYSTEM §2.4): the header lockup, or the compact mark where
 * the lockup would fall under its 28 px minimum. The link carries the accessible name, so the
 * artwork inside is hidden from assistive technology.
 *
 * - `compact="phone"`: mark below 640 px, lockup from there — bars that share the row with
 *   several controls (shop header, landing header).
 * - `compact="always"`: mark only (admin rail).
 * - `compact="never"` (default): lockup at every width — bars that hold nothing else.
 */
export function BrandLink({
  href = ROUTES.home,
  label = `${site.brand.name} — početna`,
  compact = "never",
  size = "bar",
  className,
}: {
  href?: string | null;
  label?: string;
  compact?: "never" | "phone" | "always";
  /** `bar`: 28 px, 32 px from `lg` (site bars). `fixed`: 28 px (admin sidebar, cards). */
  size?: "bar" | "fixed";
  className?: string;
}) {
  const lockupSize = size === "bar" ? "h-7 w-auto lg:h-8" : "h-7 w-auto";
  const art =
    compact === "always" ? (
      <LogoMark label={null} className="h-7 w-auto" />
    ) : compact === "phone" ? (
      <>
        <LogoMark label={null} className="h-8 w-auto min-[40rem]:hidden" />
        <LogoHeader label={null} className={cn("hidden min-[40rem]:block", lockupSize)} />
      </>
    ) : (
      <LogoHeader label={null} className={lockupSize} />
    );
  if (!href) {
    return (
      <span role="img" aria-label={site.brand.name} className={cn("inline-flex text-ink-1", className)}>
        {art}
      </span>
    );
  }
  return (
    <RouteLink
      href={href}
      aria-label={label}
      className={cn(
        "inline-flex min-h-11 min-w-11 shrink-0 items-center rounded-xs text-ink-1",
        // The mark alone is centred in its 44 px target; a lockup starts at the bar's edge.
        compact === "always" ? "justify-center" : "justify-start",
        className,
      )}
    >
      {art}
    </RouteLink>
  );
}
