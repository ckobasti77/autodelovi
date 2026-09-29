import NextLink from "next/link";
import type { ComponentProps } from "react";

import { isLiveRoute } from "@/constants/routes";

/**
 * next/link that only prefetches routes which already exist (constants/routes.ts →
 * LIVE_ROUTES). Use it for every internal link.
 */
export function RouteLink({ prefetch, ...props }: ComponentProps<typeof NextLink>) {
  const href = typeof props.href === "string" ? props.href : (props.href.pathname ?? "/");
  return <NextLink prefetch={prefetch ?? (isLiveRoute(href) ? undefined : false)} {...props} />;
}
