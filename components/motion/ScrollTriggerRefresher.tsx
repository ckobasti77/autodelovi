"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { requestScrollTriggerRefresh } from "@/lib/gsap/refresh";

/**
 * Mounted once in the root layout. Recomputes ScrollTrigger positions after client-side
 * navigation and once web fonts have loaded (font swap changes text height).
 *
 * ScrollTrigger refreshes on the window `load` event by itself, so during the first page load
 * neither the mount nor fonts that settle before `load` add another full layout read (each one
 * is a long task on a throttled phone).
 */
export function ScrollTriggerRefresher(): null {
  const pathname = usePathname();
  const firstRun = useRef(true);

  useEffect(() => {
    const initial = firstRun.current;
    firstRun.current = false;
    if (initial && document.readyState !== "complete") return;
    requestScrollTriggerRefresh();
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled && document.readyState === "complete") requestScrollTriggerRefresh();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
