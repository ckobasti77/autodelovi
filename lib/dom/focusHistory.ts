"use client";

/**
 * Recently used controls outside any overlay, newest first — the fallback chain for
 * `useFocusReturn` (A11Y-02, D270).
 *
 * The overlays that need it (cart drawer, vehicle picker, header search) are lazy chunks, so
 * the history must already be recording before the first of them loads: the global open-state
 * stores (`lib/cart/drawer.ts`, `lib/vehicle/picker.ts`), which every opener imports eagerly,
 * call `installFocusHistory()` at module scope. Installing is idempotent.
 */

export const OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"]';
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button",
  'input:not([type="hidden"])',
  "select",
  "textarea",
  "summary",
  "iframe",
  '[contenteditable]:not([contenteditable="false"])',
  "[tabindex]",
].join(",");

const HISTORY_SIZE = 4;
let recent: HTMLElement[] = [];
let installed = false;

/**
 * Records a control the user focused or pressed. Programmatic focus targets (`tabIndex=-1`:
 * the main landmark, the toast list Radix focuses when its toast closes) are not controls and
 * are skipped, as is anything inside an overlay.
 */
function remember(el: HTMLElement): void {
  if (el.tabIndex < 0 || el.closest(OVERLAY_SELECTOR)) return;
  recent = [el, ...recent.filter((other) => other !== el && other.isConnected)].slice(
    0,
    HISTORY_SIZE,
  );
}

export function installFocusHistory(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener(
    "focusin",
    (event) => {
      if (event.target instanceof HTMLElement) remember(event.target);
    },
    true,
  );
  // Safari never focuses a clicked button; the control under the pointer is still the opener.
  document.addEventListener(
    "pointerdown",
    (event) => {
      const control =
        event.target instanceof Element ? event.target.closest(FOCUSABLE_SELECTOR) : null;
      if (control instanceof HTMLElement) remember(control);
    },
    true,
  );
}

/** Newest first; entries may have left the document since they were recorded. */
export function recentControls(): readonly HTMLElement[] {
  return recent;
}
