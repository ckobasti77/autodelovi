"use client";

import { useEffect, type RefObject } from "react";

/**
 * Bottom insets: fixed or sticky bars anchored to the bottom of the viewport (quick-order
 * summary, price-list download bar, sticky buy bar, mobile cart total, consent banner).
 *
 * Every mounted bar registers its measured height here. While at least one is registered:
 * - `<html>` gets `scroll-padding-bottom: max(height) + 16px`, so anchor jumps and
 *   scroll-into-view operations keep their target above the bar, and the same value is
 *   published as `--bottom-inset` for layout that needs to reserve space;
 * - one `focusin` listener scrolls the page when the newly focused element sits under a bar.
 *   Chromium does not scroll on focus when the element is already inside the viewport, even
 *   with scroll padding, so the padding alone does not satisfy WCAG 2.4.11 (D245).
 *
 * The registry is module-level so several bars (e.g. consent banner + sticky buy bar) combine.
 */

const GAP_PX = 16;

type Entry = { el: HTMLElement; height: number };

const entries = new Map<symbol, Entry>();
let listening = false;

function maxHeight(): number {
  let max = 0;
  for (const entry of entries.values()) if (entry.height > max) max = entry.height;
  return max;
}

function applyInset() {
  const root = document.documentElement;
  const max = maxHeight();
  if (max > 0) {
    const value = `${Math.ceil(max) + GAP_PX}px`;
    root.style.setProperty("scroll-padding-bottom", value);
    root.style.setProperty("--bottom-inset", value);
  } else {
    root.style.removeProperty("scroll-padding-bottom");
    root.style.removeProperty("--bottom-inset");
  }
}

/** Top edge of the highest visible bar that overlaps `rect` horizontally, if it covers it. */
function coveringTop(rect: DOMRect): number | null {
  let top: number | null = null;
  for (const { el } of entries.values()) {
    if (!el.isConnected) continue;
    const bar = el.getBoundingClientRect();
    if (bar.height === 0 || bar.width === 0) continue;
    const overlapsX = rect.right > bar.left && rect.left < bar.right;
    const overlapsY = rect.bottom > bar.top && rect.top < bar.bottom;
    if (overlapsX && overlapsY) top = top === null ? bar.top : Math.min(top, bar.top);
  }
  return top;
}

function onFocusIn(event: FocusEvent) {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target === document.body) return;
  // Controls inside a bar, or inside an overlay that does not scroll with the page, never move.
  for (const { el } of entries.values()) if (el.contains(target)) return;
  if (target.closest('[role="dialog"], [role="alertdialog"]')) return;
  const rect = target.getBoundingClientRect();
  if (rect.height === 0) return;
  const top = coveringTop(rect);
  if (top === null) return;
  window.scrollBy({ top: rect.bottom - top + GAP_PX, behavior: "instant" });
}

function sync() {
  applyInset();
  const want = entries.size > 0;
  if (want && !listening) document.addEventListener("focusin", onFocusIn);
  if (!want && listening) document.removeEventListener("focusin", onFocusIn);
  listening = want;
}

/**
 * Registers the element in `ref` as a bottom bar while `active` is true. Its border-box height
 * is tracked with a ResizeObserver; the registration is removed on unmount or when `active`
 * turns false. Keep the API stable: shell (consent banner), catalog (StickyBuyBar), cart and
 * mechanic bars all use it.
 */
export function useBottomInset(ref: RefObject<HTMLElement | null>, active = true): void {
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const key = Symbol("bottom-inset");
    entries.set(key, { el, height: el.getBoundingClientRect().height });
    sync();
    const observer = new ResizeObserver(() => {
      const entry = entries.get(key);
      if (!entry) return;
      entry.height = el.getBoundingClientRect().height;
      applyInset();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      entries.delete(key);
      sync();
    };
  }, [ref, active]);
}

/**
 * Scrolls `el` up just enough to clear every registered bar; no-op when nothing covers it.
 * For focus moved programmatically inside a scrolled region where `focusin` already ran.
 */
export function revealAboveBottomInset(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  const top = coveringTop(rect);
  if (top !== null) window.scrollBy({ top: rect.bottom - top + GAP_PX, behavior: "instant" });
}
