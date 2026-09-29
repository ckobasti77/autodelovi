import { ScrollTrigger } from "@/lib/gsap/client";

let frame = 0;

/**
 * Coalesce refresh requests into one ScrollTrigger.refresh() on the next frame. Refresh is
 * a full layout read, so callers (route change, font load, poster → canvas swap) must go
 * through this instead of calling ScrollTrigger.refresh() directly.
 */
export function requestScrollTriggerRefresh(): void {
  if (typeof window === "undefined") return;
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = 0;
    if (ScrollTrigger.getAll().length > 0) ScrollTrigger.refresh();
  });
}
