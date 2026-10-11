import NextLink from "next/link";
import type { ComponentProps } from "react";

import { PAGE_TRANSITION } from "@/constants/motion";
import { isLiveRoute } from "@/constants/routes";

const PAGE_TYPES = [PAGE_TRANSITION.type];

/**
 * next/link that only prefetches routes which already exist (constants/routes.ts →
 * LIVE_ROUTES). Use it for every internal link.
 *
 * Every navigation it starts carries the page transition type, so the page area fades in on
 * arrival (components/shell/PageTransition); pass `transitionTypes={[]}` to opt a link out.
 */
export function RouteLink({
  prefetch,
  transitionTypes,
  ...props
}: ComponentProps<typeof NextLink>) {
  const href = typeof props.href === "string" ? props.href : (props.href.pathname ?? "/");
  return (
    <NextLink
      prefetch={prefetch ?? (isLiveRoute(href) ? undefined : false)}
      transitionTypes={transitionTypes ?? PAGE_TYPES}
      {...props}
    />
  );
}
