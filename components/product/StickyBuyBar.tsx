"use client";

/**
 * Phones (< 1024 px): whenever the inline „Dodaj u korpu“ is not on screen — above it on
 * arrival, below it after scrolling on — a 64 px bar with the price and the same action is
 * docked at the bottom edge (§10.3, UI-BOOST §7.1); it leaves the way it came once the inline
 * button is in view, so the two are never offered at once.
 *
 * GSAP owns the transform. The server markup is hidden with `visibility` only: an inline
 * `translateY(110%)` is parsed by GSAP into a pixel `y` that a `yPercent` tween never clears,
 * which left the bar 7 px below the viewport while focusable (MOT-02, D259). The resting hidden
 * state is set in `useGSAP`; showing animates `y` and `yPercent` to 0. Reduced motion → the bar
 * is placed on screen at once and only its opacity animates. While shown, its height is a
 * bottom inset, so focused controls further up the page never sit under it (WCAG 2.4.11).
 */
import { useEffect, useRef, useState } from "react";

import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";
import { useBottomInset } from "@/lib/dom/bottomInset";
import { MEDIA } from "@/constants/motion";
import { TEST_IDS } from "@/constants/testIds";
import { AddToCartButton, type CartProduct } from "@/components/catalog/AddToCartButton";
import { ProductPrice } from "@/components/catalog/ProductPrice";

/** Resting hidden state: below the viewport, invisible, opaque for the next slide-in. */
const HIDDEN = { y: 0, yPercent: 110, opacity: 1, visibility: "hidden" } as const;

export function StickyBuyBar({ product, targetId }: { product: CartProduct; targetId: string }) {
  const bar = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const applied = useRef(false);
  useBottomInset(bar, shown);

  useEffect(() => {
    const box = document.getElementById(targetId);
    // The inline action itself; the box as a whole when the product cannot be added.
    const target = box?.querySelector(`[data-testid="${TEST_IDS.productAddToCart}"]`) ?? box;
    if (!target) return;
    const mq = window.matchMedia(MEDIA.mobile);
    const io = new IntersectionObserver(
      ([entry]) => setShown(mq.matches && !entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [targetId]);

  useGSAP(
    () => {
      const el = bar.current;
      if (!el) return;
      if (shown === applied.current) {
        // First run (and StrictMode re-runs): put the bar in its resting hidden state.
        if (!shown) gsap.set(el, HIDDEN);
        return;
      }
      applied.current = shown;
      const reduced = prefersReducedMotion();
      if (shown) {
        if (reduced) {
          gsap.set(el, { y: 0, yPercent: 0, opacity: 0, visibility: "visible" });
          gsap.to(el, { opacity: 1, duration: 0.16, overwrite: true });
        } else {
          gsap.set(el, { opacity: 1, visibility: "visible" });
          gsap.to(el, { y: 0, yPercent: 0, duration: 0.36, ease: "sk.out", overwrite: true });
        }
        return;
      }
      gsap.to(el, {
        ...(reduced
          ? { opacity: 0, duration: 0.16 }
          : { yPercent: 110, duration: 0.24, ease: "sk.in" }),
        overwrite: true,
        onComplete: () => {
          gsap.set(el, HIDDEN);
        },
      });
    },
    { dependencies: [shown], scope: bar },
  );

  return (
    <div
      ref={bar}
      aria-hidden={!shown}
      inert={!shown}
      data-reveal="off"
      data-testid="sticky-buy-bar"
      style={{ visibility: "hidden" }}
      className="fixed inset-x-0 bottom-0 z-sticky border-t border-line-strong bg-bg-raised px-page pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <div className="flex items-center gap-3">
        <ProductPrice
          productId={product._id}
          retailPricePara={product.retailPricePara}
          size="s"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <AddToCartButton product={product} emphasis />
        </div>
      </div>
    </div>
  );
}
