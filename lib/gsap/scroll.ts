/**
 * Scroll-driven GSAP (ARCHITECTURE §G5): ScrollTrigger + ScrollToPlugin, registered once.
 *
 * Split from `lib/gsap/client.ts` so pages without scroll-linked motion never download
 * ScrollTrigger (PERF-10). Import from here only in components that create ScrollTriggers or
 * scroll with `scrollTo` (the 3D hero); everything else keeps importing `@/lib/gsap/client`.
 * Loading this module attaches ScrollTrigger to `requestScrollTriggerRefresh()`, which is a
 * no-op until then.
 */
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";
import { attachScrollTrigger } from "@/lib/gsap/refresh";

let registered = false;

export function registerScrollPlugins(): void {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
  // Mobile URL-bar show/hide must not re-layout pinned sections.
  ScrollTrigger.config({ ignoreMobileResize: true });
  attachScrollTrigger(ScrollTrigger);
  registered = true;
}

registerScrollPlugins();

export { gsap, prefersReducedMotion, ScrollToPlugin, ScrollTrigger, useGSAP };
