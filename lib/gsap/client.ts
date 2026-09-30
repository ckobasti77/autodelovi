/**
 * The one GSAP entry point (ARCHITECTURE §G5). Import gsap, plugins and useGSAP from here —
 * never from "gsap" directly — so plugin registration and the SKLOP eases are guaranteed to
 * exist before the first tween.
 *
 * Client-only in practice: registration is skipped on the server (no window). Draggable and
 * InertiaPlugin (bottom-sheet drag only) load on demand through `loadDragPlugins()` in
 * `lib/gsap/drag.ts`.
 */
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

import { DUR, EASE, EASE_CURVES, MEDIA } from "@/constants/motion";

let registered = false;

export function registerGsap(): void {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollToPlugin, CustomEase);
  for (const [name, curve] of Object.entries(EASE_CURVES)) {
    CustomEase.create(name, curve);
  }
  // Principle 3 (§8.1): tweens start from what is on screen and may be interrupted.
  gsap.defaults({ ease: EASE.out, duration: DUR.base, overwrite: "auto" });
  // Mobile URL-bar show/hide must not re-layout pinned sections.
  ScrollTrigger.config({ ignoreMobileResize: true });
  registered = true;
}

registerGsap();

/** True when the user asked for reduced motion (read at call time). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(MEDIA.reducedMotion).matches;
}

export { CustomEase, gsap, ScrollToPlugin, ScrollTrigger, useGSAP };
