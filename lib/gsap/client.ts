/**
 * The one GSAP entry point (ARCHITECTURE §G5). Import gsap and useGSAP from here — never from
 * "gsap" directly — so the SKLOP eases (`sk.out`, `sk.inOut`, `sk.in`, `sk.snap`) and the
 * defaults exist before the first tween.
 *
 * Core only (PERF-10): the eases are registered with `gsap.registerEase` from a small
 * cubic-bezier solver instead of CustomEase. Scroll-linked motion (ScrollTrigger,
 * ScrollToPlugin) lives in `lib/gsap/scroll.ts`, imported only where it is used (the 3D hero);
 * Draggable + InertiaPlugin (bottom-sheet drag) load on demand through `loadDragPlugins()` in
 * `lib/gsap/drag.ts`. Registration is skipped on the server (no window).
 */
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

import { DUR, EASE, EASE_CURVES, MEDIA } from "@/constants/motion";
import { cubicBezierFromString } from "@/lib/gsap/cubicBezier";

let registered = false;

export function registerGsap(): void {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(useGSAP);
  for (const [name, curve] of Object.entries(EASE_CURVES)) {
    gsap.registerEase(name, cubicBezierFromString(curve));
  }
  // Principle 3 (§8.1): tweens start from what is on screen and may be interrupted.
  gsap.defaults({ ease: EASE.out, duration: DUR.base, overwrite: "auto" });
  registered = true;
}

registerGsap();

/** True when the user asked for reduced motion (read at call time). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(MEDIA.reducedMotion).matches;
}

export { gsap, useGSAP };

// TRANSITIONAL (PERF-10): components/three/HeroStage.tsx still imports ScrollTrigger from this
// module. Remove this line as soon as it imports from "@/lib/gsap/scroll" — until then every
// page still loads ScrollTrigger. Keep it last: lib/gsap/scroll imports this module back.
export { ScrollTrigger } from "@/lib/gsap/scroll";
