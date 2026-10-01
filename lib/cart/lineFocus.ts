"use client";

/**
 * Focus and announcements for cart line edits (A11Y-09). The polite region `#cart-live` is
 * rendered once by ShopChrome; add-to-cart writes to it too.
 */

/** Says `text` through `#cart-live`; clearing first makes a repeated message announce again. */
export function announceCart(text: string): void {
  const region = document.getElementById("cart-live");
  if (!region) return;
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = text;
  }, 60);
}

const FOCUSABLE = "a[href], button:not([disabled])";
/** Wrapper around the empty state; its heading (page) or first control (drawer) takes focus. */
export const CART_EMPTY_ATTR = "data-cart-empty";

/**
 * Call before a line is removed; returns the function to call once the removal succeeded.
 * Focus goes to the next line's first control (its product link), else the previous line's,
 * else — the cart is now empty — the empty state's heading or action. Nothing moves when the
 * line did not hold focus (a pointer user on a browser that does not focus buttons on click
 * still has focus elsewhere).
 */
export function planFocusAfterLineRemoval(li: HTMLElement | null): () => void {
  if (!li) return () => {};
  const active = document.activeElement;
  const hadFocus = active === document.body || li.contains(active);
  const first = (el: Element | null) => el?.querySelector<HTMLElement>(FOCUSABLE) ?? null;
  const neighbour = first(li.nextElementSibling) ?? first(li.previousElementSibling);
  const scope: ParentNode = li.closest('[role="dialog"]') ?? li.closest("main") ?? document;

  return () => {
    if (!hadFocus) return;
    if (neighbour?.isConnected) {
      neighbour.focus();
      return;
    }
    // Last line: the empty state renders once the cart query updates.
    let frames = 0;
    const tick = () => {
      const empty = scope.querySelector<HTMLElement>(`[${CART_EMPTY_ATTR}]`);
      const target = empty?.querySelector<HTMLElement>("h1, h2, h3") ?? first(empty ?? null);
      if (target) {
        if (!target.matches(FOCUSABLE)) target.tabIndex = -1;
        target.focus();
        return;
      }
      if (++frames < 60) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
}
