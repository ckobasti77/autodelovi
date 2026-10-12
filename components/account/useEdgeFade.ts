"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Edge fade for a horizontal scroller (tab rows, filter tracks): the mask appears only on a
 * side that has more content, so the first and the last item are never faded at rest (the same
 * rule as `components/ui/Tabs`). The opaque stop of a mask carries no colour.
 */
export function useEdgeFade<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [fade, setFade] = useState({ start: false, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setFade((f) => (f.start === start && f.end === end ? f : { start, end }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, []);

  const mask =
    fade.start || fade.end
      ? `linear-gradient(90deg, ${fade.start ? "transparent 0, #000 20px" : "#000 0"}, ${fade.end ? "#000 calc(100% - 20px), transparent 100%" : "#000 100%"})`
      : undefined;
  const style: CSSProperties | undefined = mask
    ? { maskImage: mask, WebkitMaskImage: mask }
    : undefined;
  return { ref, style };
}
