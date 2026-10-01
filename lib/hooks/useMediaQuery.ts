"use client";

import { useSyncExternalStore } from "react";

/**
 * Live media-query match (SSR: false). Its own module, not part of `components/ui/motion`:
 * the search box and the cart page only need this hook, and importing it from the overlay
 * motion module put GSAP on their hydration path (PERF-01).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
