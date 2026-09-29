import { RouteLink as NextLink } from "@/components/ui/RouteLink";

import { cn } from "@/lib/cn";
import { site } from "@/config/site";
import { ROUTES } from "@/constants/routes";

/**
 * The mark „izvučen deo“ (DESIGN-SYSTEM §2.2): a slotted base (ink) with one part lifted out
 * along a dashed assembly axis; the lifted part is the only orange. 24-unit grid.
 */
export function BrandMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <rect x="7" y="2.5" width="10" height="5" rx="0.75" className="fill-accent" />
      <path d="M12 8.5v4.5" stroke="currentColor" strokeWidth="1.25" strokeDasharray="1.3 1.1" />
      <path d="M3 14h4v2.5h10V14h4v7H3z" fill="currentColor" />
    </svg>
  );
}

/**
 * Lockup: mark 22 px + 10 px gap + wordmark (Archivo Expanded 700 caps, 0.08em). The name
 * comes from config (settings override later), so a rename is one change.
 */
export function Wordmark({
  name = site.brand.name,
  href = ROUTES.home,
  size = "header",
  className,
}: {
  name?: string;
  href?: string | null;
  size?: "header" | "footer" | "sidebar";
  className?: string;
}) {
  const text =
    size === "header"
      ? "text-[17px] lg:text-[18px]"
      : size === "footer"
        ? "text-[16px]"
        : "text-[15px]";
  const content = (
    <>
      <BrandMark size={size === "header" ? 22 : 20} className="-translate-y-[2px]" />
      <span className={cn("type-wordmark", text)}>{name}</span>
    </>
  );
  const lockup = <span className="inline-flex items-end gap-2.5">{content}</span>;
  if (!href) return <span className={cn("inline-flex text-ink-1", className)}>{lockup}</span>;
  return (
    <NextLink
      href={href}
      className={cn("inline-flex min-h-11 items-center rounded-xs text-ink-1", className)}
      aria-label={`${name} — početna`}
    >
      {lockup}
    </NextLink>
  );
}
