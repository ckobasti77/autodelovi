import { RouteLink as NextLink } from "@/components/ui/RouteLink";
import type { ComponentProps } from "react";
import { ShoppingCartSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { countSr } from "@/lib/format/plural";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

/**
 * Header cart entry. Links to /korpa (the cart drawer takes over in the cart step); the
 * count badge is a live value (never revealed, never animated in).
 */
export function CartButton({
  count = 0,
  className,
  onClick,
}: {
  count?: number;
  className?: string;
  onClick?: ComponentProps<"a">["onClick"];
}) {
  const label =
    count > 0 ? `Korpa, ${countSr(count, ["artikal", "artikla", "artikala"])}` : "Korpa";
  return (
    <NextLink
      href={ROUTES.cart}
      aria-label={label}
      data-testid={TEST_IDS.cartButton}
      onClick={onClick}
      className={cn(
        "relative inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1 active:translate-y-px",
        className,
      )}
    >
      <ShoppingCartSimpleIcon size={24} aria-hidden="true" />
      {count > 0 ? (
        <span
          aria-hidden="true"
          data-reveal="off"
          data-testid={TEST_IDS.cartCount}
          className="absolute right-0.5 top-0.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 font-ui text-[0.6875rem] font-bold tabular-nums leading-none text-on-accent"
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </NextLink>
  );
}
