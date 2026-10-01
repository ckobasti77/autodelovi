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
 *
 * Font loads are observed through the `loadingdone` event, not `document.fonts.ready`: reading
 * `ready` once the fonts have loaded makes Blink update style and layout synchronously, which
 * cost every page a forced layout inside its hydration commit (PERF-01). The event also covers
 * fonts that load on demand later (prices, codes).
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
    const fonts = document.fonts;
    if (!fonts) return;
    const onFontsLoaded = () => {
      if (document.readyState === "complete") requestScrollTriggerRefresh();
    };
    fonts.addEventListener("loadingdone", onFontsLoaded);
    return () => fonts.removeEventListener("loadingdone", onFontsLoaded);
  }, []);

  return null;
}
