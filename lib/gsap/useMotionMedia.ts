"use client";

import type { RefObject } from "react";

import { gsap, useGSAP } from "@/lib/gsap/client";
import { MEDIA } from "@/constants/motion";

export type MotionConditions = {
  /** prefers-reduced-motion: no-preference */
  motionOk: boolean;
  /** prefers-reduced-motion: reduce */
  reduced: boolean;
  /** ≥ 1024 px */
  desktop: boolean;
  /** < 1024 px */
  mobile: boolean;
};

/**
 * gsap.matchMedia() inside useGSAP: `setup` runs for the current reduced-motion and
 * breakpoint conditions and is reverted and re-run automatically when they change (a user
 * toggling reduced motion, a rotation across 1024 px). Everything created inside is cleaned
 * up on unmount. Selector strings are scoped to `scope`.
 */
export function useMotionMedia(
  setup: (conditions: MotionConditions) => void | (() => void),
  options: { scope?: RefObject<HTMLElement | null>; dependencies?: unknown[] } = {},
) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia(options.scope?.current ?? undefined);
      mm.add(
        {
          motionOk: MEDIA.motionOk,
          reduced: MEDIA.reducedMotion,
          desktop: MEDIA.desktop,
          mobile: MEDIA.mobile,
        },
        (context) => setup(context.conditions as MotionConditions),
      );
      return () => mm.revert();
    },
    { scope: options.scope, dependencies: options.dependencies ?? [] },
  );
}
