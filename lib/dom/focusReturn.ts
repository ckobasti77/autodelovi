"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

import {
  FOCUSABLE_SELECTOR,
  installFocusHistory,
  OVERLAY_SELECTOR,
  recentControls,
} from "@/lib/dom/focusHistory";

/** Skip-link target; every shell renders `<main id="sadrzaj" tabIndex={-1}>`. */
const FALLBACK_ID = "sadrzaj";
/** Upper bound for the document-order walks (a product page has a few thousand elements). */
const WALK_LIMIT = 5000;

/**
 * Focus can land on `el` and be seen: a focusable element, enabled, not inert, rendered with a
 * non-empty box and not `visibility: hidden`. The non-empty box rejects containers that were
 * emptied while the panel was open (the toast list after its toast closed).
 */
export function isFocusTarget(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement) || !el.matches(FOCUSABLE_SELECTOR)) return false;
  if (el.matches(":disabled") || el.closest("[inert]")) return false;
  for (const rect of el.getClientRects()) {
    if (rect.width > 0 && rect.height > 0) return getComputedStyle(el).visibility !== "hidden";
  }
  return false;
}

/** A focus target in the sequential focus order (reachable with Tab). */
export function isTabbable(el: Element): el is HTMLElement {
  return isFocusTarget(el) && el.tabIndex >= 0;
}

/** The tabbable control right before `el` in document order — the slot `el` occupies in the Tab sequence. */
export function previousTabbable(el: HTMLElement): HTMLElement | null {
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  walk.currentNode = el;
  for (let i = 0; i < WALK_LIMIT; i++) {
    const node = walk.previousNode();
    if (!node) return null;
    if (isTabbable(node as Element)) return node as HTMLElement;
  }
  return null;
}

/** The first tabbable control after `anchor` in document order, outside `exclude`. */
export function nextTabbable(anchor: HTMLElement, exclude: Node | null): HTMLElement | null {
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  walk.currentNode = anchor;
  for (let i = 0; i < WALK_LIMIT; i++) {
    const node = walk.nextNode();
    if (!node) return null;
    if (exclude?.contains(node)) continue;
    if (isTabbable(node as Element)) return node as HTMLElement;
  }
  return null;
}

function inViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

// Normally installed long before by the eager open-state stores; this covers any other opener.
installFocusHistory();

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

type Candidate = {
  el: HTMLElement;
  /**
   * History entry (not the focused element at open): used only while it is on screen, so a
   * control pressed long ago never scrolls the page back to itself.
   */
  onScreenOnly: boolean;
};

type Recorded = {
  candidates: Candidate[];
  /** The control that opened the panel and the tabbable control before it, for a re-rendered opener. */
  opener: HTMLElement | null;
  previous: HTMLElement | null;
};

const EMPTY: Recorded = { candidates: [], opener: null, previous: null };

/**
 * Focus without moving the page. A sticky header control sits inside `scroll-padding-top`, so a
 * plain `focus()` scrolls the document by up to the padding on every close (Chromium, WebKit).
 * The page cannot scroll behind a modal panel, so the opener is still where the user left it;
 * only a target that is entirely off screen (non-modal panel, replacement control) is scrolled
 * to, by the minimum amount.
 */
function restore(el: HTMLElement, panel: Node | null, onScreenOnly: boolean): boolean {
  if (!el.isConnected || panel?.contains(el) || !isFocusTarget(el)) return false;
  const visible = inViewport(el);
  if (onScreenOnly && !visible) return false;
  el.focus({ preventScroll: true });
  if (document.activeElement !== el) return false;
  if (!visible) el.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

/**
 * Focus return for overlays opened from global state (vehicle picker, cart drawer, header
 * search, parts list, command palette). Radix returns focus only to its own `Trigger`; without
 * one, focus falls to `<body>` on close (A11Y-02, D246, D270).
 *
 * The opener is recorded in a layout effect when `open` turns true: that runs before any
 * passive effect, so a panel child that focuses its input in `useEffect` (SearchBox) has not
 * moved focus yet. Radix's own `onOpenAutoFocus` is not usable here — it is not dispatched at
 * all when focus is already inside the panel.
 *
 * Pass the returned `onCloseAutoFocus` to `Dialog.Content`. On close, in order:
 * 1. the opener, if it is still in the document, outside the closing panel and focusable;
 * 2. if the opener re-rendered as a new element (the header chip and the fitment badge after a
 *    vehicle choice), the control now in its slot of the Tab sequence — the first tabbable
 *    control after the one that preceded the opener;
 * 3. a recently used control that is still on screen (the button Safari did not focus on click;
 *    the add-to-cart button when the drawer was opened from a toast that has since closed);
 * 4. the main landmark.
 * Nothing is restored when the user has already put focus elsewhere (non-modal sheet, click
 * outside): focus is only taken back from `<body>` or from the panel. The page never scrolls to
 * return focus to a visible control.
 */
export function useFocusReturn(enabled: boolean, open: boolean) {
  const recorded = useRef<Recorded>(EMPTY);

  useLayoutEffect(() => {
    if (!enabled || !open) return;
    const active = document.activeElement;
    const list: Candidate[] = [];
    const add = (el: HTMLElement | null, onScreenOnly: boolean) => {
      if (el && !list.some((c) => c.el === el)) list.push({ el, onScreenOnly });
    };
    add(active instanceof HTMLElement && active !== document.body ? active : null, false);
    recentControls().forEach((el) => add(el, true));
    add(expandedOpener(), false);
    const opener = list.find((c) => c.el.isConnected && c.el.tabIndex >= 0)?.el ?? null;
    recorded.current = {
      candidates: list,
      opener,
      previous: opener ? previousTabbable(opener) : null,
    };
  }, [enabled, open]);

  const onCloseAutoFocus = useCallback(
    (event: Event) => {
      if (!enabled || event.defaultPrevented) return;
      event.preventDefault();
      const panel = event.currentTarget instanceof Node ? event.currentTarget : null;
      const { candidates, opener, previous } = recorded.current;
      recorded.current = EMPTY;
      const active = document.activeElement;
      if (active && active !== document.body && !panel?.contains(active)) return;
      for (const { el, onScreenOnly } of candidates) {
        if (restore(el, panel, onScreenOnly)) return;
        if (el === opener && !el.isConnected && previous?.isConnected) {
          const replacement = nextTabbable(previous, panel);
          if (replacement && restore(replacement, panel, false)) return;
        }
      }
      document.getElementById(FALLBACK_ID)?.focus({ preventScroll: true });
    },
    [enabled],
  );

  return { onCloseAutoFocus };
}
