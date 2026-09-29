"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { requestScrollTriggerRefresh } from "@/lib/gsap/refresh";

/**
 * Mounted once in the root layout. Recomputes ScrollTrigger positions after client-side
 * navigation and once web fonts have loaded (font swap changes text height).
 */
export function ScrollTriggerRefresher(): null {
  const pathname = usePathname();

  useEffect(() => {
    requestScrollTriggerRefresh();
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) requestScrollTriggerRefresh();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
