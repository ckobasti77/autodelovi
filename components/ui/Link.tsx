import { RouteLink as NextLink } from "@/components/ui/RouteLink";
import type { ComponentProps, ReactNode } from "react";
import { ArrowRightIcon, ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";

export type LinkVariant = "inline" | "quiet" | "standalone" | "unstyled";

const variants: Record<LinkVariant, string> = {
  /** In running text: 1 px underline, line-strong → accent on hover (§8.5). */
  inline: "link-underline text-ink-1",
  /** Navigation-like: ink-2 → ink-1, no underline until hover. */
  quiet:
    "text-ink-2 underline-offset-4 decoration-1 decoration-transparent underline transition-control hover:text-ink-1 hover:decoration-line-strong",
  /** Standalone action link with a trailing arrow icon. */
  standalone:
    "inline-flex items-center gap-1.5 font-semibold text-ink-1 underline underline-offset-4 decoration-1 decoration-line-strong transition-control hover:decoration-accent",
  unstyled: "",
};

export type LinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & {
  href: string;
  variant?: LinkVariant;
  /** Force the external treatment (new tab + icon); detected automatically for http(s) URLs. */
  external?: boolean;
  /** Replace the default trailing icon of the standalone variant. */
  icon?: ReactNode;
};

const isExternal = (href: string) => /^https?:\/\//i.test(href);

/**
 * Link (§8.5). Internal hrefs go through next/link (prefetch, client navigation); external
 * ones open in a new tab with an icon and a screen-reader note. tel:/mailto:/viber: links are
 * plain anchors.
 */
export function Link({
  href,
  variant = "inline",
  external,
  icon,
  className,
  children,
  ...rest
}: LinkProps) {
  const classes = cn(variants[variant], "cursor-pointer rounded-xs", className);
  const opensNewTab = external ?? isExternal(href);
  const isScheme = /^(tel|mailto|viber|sms):/i.test(href);

  const trailing =
    variant === "standalone" ? (
      <span aria-hidden="true" className="inline-flex">
        {icon ?? (opensNewTab ? <ArrowSquareOutIcon size={14} /> : <ArrowRightIcon size={14} />)}
      </span>
    ) : opensNewTab ? (
      <span aria-hidden="true" className="ml-1 inline-flex align-[-0.125em]">
        <ArrowSquareOutIcon size={14} />
      </span>
    ) : null;

  if (opensNewTab || isScheme) {
    return (
      <a
        href={href}
        className={classes}
        {...(opensNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...(rest as ComponentProps<"a">)}
      >
        {children}
        {trailing}
        {opensNewTab ? <span className="sr-only"> (otvara se u novom prozoru)</span> : null}
      </a>
    );
  }

  return (
    <NextLink href={href} className={classes} {...rest}>
      {children}
      {trailing}
    </NextLink>
  );
}
