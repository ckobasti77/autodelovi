"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/** Skip-link target; every shell renders `<main id="sadrzaj" tabIndex={-1}>`. */
const FALLBACK_ID = "sadrzaj";
const OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"]';

/**
 * Last element focused outside any overlay. Covers panels that focus a control themselves
 * (an `autoFocus` attribute is applied before any effect runs).
 */
let lastOutside: HTMLElement | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && !target.closest(OVERLAY_SELECTOR)) lastOutside = target;
    },
    true,
  );
}

/**
 * The visible control that declares it opened a dialog. Covers panels in a lazily loaded
 * chunk, where the tracker above was installed only after the opener had been focused.
 */
function expandedOpener(): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    '[aria-haspopup="dialog"][aria-expanded="true"]',
  );
  for (const el of candidates) {
    if (!el.closest(OVERLAY_SELECTOR) && el.getClientRects().length > 0) return el;
  }
  return null;
}

/**
 * Focus return for overlays opened from global state (vehicle picker, cart drawer, header
 * search, parts list, command palette). Radix returns focus only to its own `Trigger`; without
 * one, focus falls to `<body>` on close (A11Y-02, D246).
 *
 * The opener is recorded in a layout effect when `open` turns true: that runs before any
 * passive effect, so a panel child that focuses its input in `useEffect` (SearchBox) has not
 * moved focus yet. Radix's own `onOpenAutoFocus` is not usable here — it is not dispatched at
 * all when focus is already inside the panel.
 *
 * Pass the returned `onCloseAutoFocus` to `Dialog.Content`. On close the first candidate that
 * is still in the document, outside the closing panel and focusable gets focus; otherwise the
 * main landmark. Nothing is restored when the user has already put focus elsewhere
 * (non-modal sheet, click outside): focus is only taken back from `<body>` or from the panel.
 */
export function useFocusReturn(enabled: boolean, open: boolean) {
  const candidates = useRef<HTMLElement[]>([]);

  useLayoutEffect(() => {
    if (!enabled || !open) return;
    const active = document.activeElement;
    const list = [
      active instanceof HTMLElement && active !== document.body ? active : null,
      lastOutside,
      expandedOpener(),
    ];
    candidates.current = list.filter((el): el is HTMLElement => el !== null);
  }, [enabled, open]);

  const onCloseAutoFocus = useCallback(
    (event: Event) => {
      if (!enabled || event.defaultPrevented) return;
      event.preventDefault();
      const panel = event.currentTarget instanceof Node ? event.currentTarget : null;
      const list = candidates.current;
      candidates.current = [];
      const active = document.activeElement;
      if (active && active !== document.body && !panel?.contains(active)) return;
      for (const el of list) {
        if (!el.isConnected || panel?.contains(el) || el.closest("[inert]")) continue;
        el.focus();
        // A control hidden at this breakpoint (display: none) silently refuses focus.
        if (document.activeElement === el) return;
      }
      document.getElementById(FALLBACK_ID)?.focus({ preventScroll: true });
    },
    [enabled],
  );

  return { onCloseAutoFocus };
}
