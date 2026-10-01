"use client";

/**
 * Presence + GSAP enter/exit for overlays (Dialog, Sheet, Toast). Radix unmounts closed
 * content immediately, so overlays render with `forceMount` while `present` and hand the
 * exit to GSAP; `onExited` unmounts them afterwards (§8.1 principle 4: same path in and out).
 */
import { useCallback, useState, type RefObject } from "react";

import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";
import { EASE } from "@/constants/motion";

/** Controlled/uncontrolled boolean state (open/closed). */
export function useControllableOpen(
  open: boolean | undefined,
  defaultOpen: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined,
) {
  const [internal, setInternal] = useState(defaultOpen ?? false);
  const controlled = open !== undefined;
  const value = controlled ? open : internal;
  const setValue = useCallback(
    (next: boolean) => {
      if (!controlled) setInternal(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );
  return [value, setValue] as const;
}

/** Keeps content mounted after `open` turns false until `onExited` is called. */
export function usePresence(open: boolean) {
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  const onExited = useCallback(() => setPresent(false), []);
  return [present, onExited] as const;
}

type TweenVars = gsap.TweenVars;

export type OverlayMotion = {
  open: boolean;
  present: boolean;
  onExited: () => void;
  panel: RefObject<HTMLElement | null>;
  scrim?: RefObject<HTMLElement | null>;
  /** Start state of the panel on enter, e.g. { x: 24, opacity: 0 }. */
  enterFrom: TweenVars;
  /** End state of the panel on exit (defaults to enterFrom). */
  exitTo?: TweenVars;
  enterDuration: number;
  exitDuration: number;
  /** Target of the enter tween when the rest state is not zero (e.g. a sheet's peek offset). */
  enterTo?: TweenVars;
};

const REST: Record<string, number> = { opacity: 1, x: 0, y: 0, xPercent: 0, yPercent: 0, scale: 1 };

function restFor(from: TweenVars): TweenVars {
  const rest: TweenVars = {};
  for (const key of Object.keys(from)) {
    if (key in REST) rest[key] = REST[key];
  }
  return rest;
}

/** Enter/exit choreography; reduced motion → opacity only, 160 ms (§8.7). */
export function useOverlayMotion(motion: OverlayMotion) {
  const {
    open,
    present,
    onExited,
    panel,
    scrim,
    enterFrom,
    exitTo,
    enterDuration,
    exitDuration,
    enterTo,
  } = motion;

  useGSAP(
    () => {
      const el = panel.current;
      if (!present || !el) return;
      const reduce = prefersReducedMotion();
      const scrimEl = scrim?.current ?? null;

      if (open) {
        const to = { ...restFor(enterFrom), ...enterTo };
        const midExit = gsap.isTweening(el);
        if (reduce) {
          gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.16, ease: "none" });
        } else if (midExit) {
          gsap.to(el, { ...to, duration: enterDuration, ease: EASE.out });
        } else {
          gsap.fromTo(el, enterFrom, { ...to, duration: enterDuration, ease: EASE.out });
        }
        if (scrimEl)
          gsap.fromTo(scrimEl, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: EASE.out });
        return;
      }

      const timeline = gsap.timeline({ onComplete: onExited });
      timeline.to(
        el,
        reduce
          ? { opacity: 0, duration: 0.16, ease: "none" }
          : { ...(exitTo ?? enterFrom), duration: exitDuration, ease: EASE.in },
        0,
      );
      if (scrimEl)
        timeline.to(
          scrimEl,
          { opacity: 0, duration: reduce ? 0.16 : exitDuration, ease: EASE.in },
          0,
        );
    },
    { dependencies: [open, present] },
  );
}

/** Live media-query match, for the overlays here; GSAP-free code imports the hook module. */
export { useMediaQuery } from "@/lib/hooks/useMediaQuery";
