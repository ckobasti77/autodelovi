"use client";

/**
 * Phones (< 1024 px): once the inline buy box has scrolled out of view, a 64 px bar with the
 * price and „Dodaj u korpu“ rises from the bottom edge (§10.3). GSAP only; reduced motion →
 * opacity. The bar leaves the way it came.
 */
import { useEffect, useRef, useState } from "react";

import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";
import { MEDIA } from "@/constants/motion";
import { AddToCartButton, type CartProduct } from "@/components/catalog/AddToCartButton";
import { ProductPrice } from "@/components/catalog/ProductPrice";

export function StickyBuyBar({ product, targetId }: { product: CartProduct; targetId: string }) {
  const bar = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const mq = window.matchMedia(MEDIA.mobile);
    const io = new IntersectionObserver(
      ([entry]) => setShown(mq.matches && !entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [targetId]);

  useGSAP(
    () => {
      const el = bar.current;
      if (!el) return;
      const reduced = prefersReducedMotion();
      if (shown) {
        gsap.set(el, { visibility: "visible" });
        gsap.to(el, reduced ? { opacity: 1, duration: 0.16 } : { yPercent: 0, opacity: 1, duration: 0.36, ease: "sk.out" });
      } else {
        gsap.to(el, {
          ...(reduced ? { opacity: 0, duration: 0.16 } : { yPercent: 110, duration: 0.24, ease: "sk.in" }),
          onComplete: () => gsap.set(el, { visibility: "hidden" }),
        });
      }
    },
    { dependencies: [shown], scope: bar },
  );

  return (
    <div
      ref={bar}
      aria-hidden={!shown}
      inert={!shown}
      data-reveal="off"
      style={{ visibility: "hidden", transform: "translateY(110%)" }}
      className="fixed inset-x-0 bottom-0 z-sticky border-t border-line-strong bg-bg-raised px-page pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <div className="flex items-center gap-3">
        <ProductPrice productId={product._id} retailPricePara={product.retailPricePara} size="s" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <AddToCartButton product={product} emphasis />
        </div>
      </div>
    </div>
  );
}
