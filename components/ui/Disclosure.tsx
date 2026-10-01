"use client";

/**
 * Disclosure (DESIGN-SYSTEM §8.5 Accordion): a native `<details>/<summary>` whose content opens
 * with GSAP — height 0 → auto in 280 ms `sk.inOut` plus content opacity in 180 ms — and closes
 * the same way before the element really closes. The caret (`DisclosureCaret`) turns 180° on
 * the caret token (220 ms `sk.snap`) from the `open` state, so it is right without JavaScript.
 *
 * Semantics stay native: summary is the button, Enter/Space toggle, find-in-page and the
 * `name` attribute (exclusive groups) work, and without JavaScript or under reduced motion the
 * element toggles instantly. Only the content wrapper is animated — never the copy inside it,
 * whose arrival the site-wide text reveal owns (.claude/rules/architecture.md).
 */
import { useRef, type ComponentPropsWithoutRef, type MouseEvent, type ReactNode } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr";

import { EASE } from "@/constants/motion";
import { cn } from "@/lib/cn";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";

/** Accordion timings (§8.5): height 280 ms, content opacity 180 ms. */
const HEIGHT_S = 0.28;
const FADE_S = 0.18;

/** Opens (height 0 → auto + fade in) or closes (→ 0 + fade out, then `open = false`). */
function animateToggle(
  details: HTMLDetailsElement,
  content: HTMLDivElement,
  onOpenChange?: (open: boolean) => void,
) {
  gsap.killTweensOf(content);
  if (!details.open || details.dataset.closing === "true") {
    delete details.dataset.closing;
    details.open = true;
    gsap.fromTo(
      content,
      // Reopened while closing: continue from the current height.
      { height: details.dataset.animating ? content.offsetHeight : 0, overflow: "hidden" },
      {
        height: "auto",
        duration: HEIGHT_S,
        ease: EASE.inOut,
        onStart: () => {
          details.dataset.animating = "true";
        },
        onComplete: () => {
          delete details.dataset.animating;
          gsap.set(content, { clearProps: "height,overflow" });
        },
      },
    );
    gsap.fromTo(
      content,
      { opacity: 0 },
      { opacity: 1, duration: FADE_S, ease: EASE.out, clearProps: "opacity" },
    );
    onOpenChange?.(true);
    return;
  }
  details.dataset.closing = "true";
  details.dataset.animating = "true";
  gsap.to(content, { opacity: 0, duration: FADE_S, ease: EASE.in });
  gsap.fromTo(
    content,
    { height: content.offsetHeight, overflow: "hidden" },
    {
      height: 0,
      duration: HEIGHT_S,
      ease: EASE.inOut,
      onComplete: () => {
        delete details.dataset.closing;
        delete details.dataset.animating;
        details.open = false;
        gsap.set(content, { clearProps: "height,overflow,opacity" });
        onOpenChange?.(false);
      },
    },
  );
}

type DisclosureProps = Omit<ComponentPropsWithoutRef<"details">, "children" | "onToggle"> & {
  /** Summary row content (put a `DisclosureCaret` in it where the design wants it). */
  summary: ReactNode;
  summaryClassName?: string;
  contentClassName?: string;
  children: ReactNode;
  /** Called after the state changed (after the close animation when closing). */
  onOpenChange?: (open: boolean) => void;
};

export function Disclosure({
  summary,
  summaryClassName,
  contentClassName,
  className,
  children,
  onOpenChange,
  ...rest
}: DisclosureProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { contextSafe } = useGSAP({ scope: detailsRef });

  const onSummaryClick = (event: MouseEvent<HTMLElement>) => {
    const details = detailsRef.current;
    const content = contentRef.current;
    if (!details || !content || prefersReducedMotion()) return; // native, instant toggle
    event.preventDefault();
    // Created inside the component's GSAP context, so an unmount mid-animation reverts it.
    contextSafe(() => animateToggle(details, content, onOpenChange))();
  };

  return (
    <details ref={detailsRef} className={cn("group/disclosure", className)} {...rest}>
      <summary
        onClick={onSummaryClick}
        className={cn(
          "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
          summaryClassName,
        )}
      >
        {summary}
      </summary>
      <div ref={contentRef} className={contentClassName}>
        {children}
      </div>
    </details>
  );
}

/**
 * Caret for a `Disclosure` summary: turns 180° while open (220 ms `sk.snap`, CSS state); it
 * turns back as soon as a close starts, not when the content has finished collapsing.
 */
export function DisclosureCaret({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <CaretDownIcon
      size={size}
      aria-hidden="true"
      className={cn(
        "shrink-0 transition-transform duration-(--dur-base) ease-sk-snap group-[[open]:not([data-closing])]/disclosure:rotate-180 motion-reduce:transition-none",
        className,
      )}
    />
  );
}
