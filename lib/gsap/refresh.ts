import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";

let scrollTrigger: typeof ScrollTriggerType | null = null;
let frame = 0;

/**
 * Called by `lib/gsap/scroll.ts` when ScrollTrigger is registered. Until then there is nothing
 * to refresh, so this module never imports ScrollTrigger itself (PERF-10: pages without
 * scroll-linked motion do not download it).
 */
export function attachScrollTrigger(instance: typeof ScrollTriggerType): void {
  scrollTrigger = instance;
}

/**
 * Coalesce refresh requests into one ScrollTrigger.refresh() on the next frame. Refresh is
 * a full layout read, so callers (route change, font load, poster → canvas swap) must go
 * through this instead of calling ScrollTrigger.refresh() directly. A no-op until
 * `lib/gsap/scroll.ts` has been loaded.
 */
export function requestScrollTriggerRefresh(): void {
  if (typeof window === "undefined" || !scrollTrigger) return;
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = 0;
    if (scrollTrigger && scrollTrigger.getAll().length > 0) scrollTrigger.refresh();
  });
}
