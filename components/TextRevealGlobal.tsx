"use client";

/**
 * Site-wide text reveal. Mounted once in the root layout; renders nothing.
 *
 * - Finds every element matching `hiddenSelector` (the same selector the inline stylesheet
 *   hides), marks it pending and observes it with one IntersectionObserver whose root is
 *   shrunk from the bottom by `enterRatio`.
 * - On entry: short copy is split into words that arrive in random order (opacity, blur,
 *   lift); long copy (> maxWords) and text sitting directly in flex/grid boxes fade as a
 *   block. The DOM is restored as soon as the animation ends.
 * - A MutationObserver picks up streamed and client-navigated content.
 * - Never touches an element before React has hydrated it (streamed Suspense boundaries
 *   hydrate after the root): such elements wait, and proceed after HYDRATION_WAIT_MS at the
 *   latest (e.g. a boundary whose JS failed) so nothing stays hidden.
 * - Reduced motion: nothing is hidden (CSS) and everything is marked done immediately.
 *
 * Rules: .claude/rules/architecture.md → „Text Reveal“.
 */
import { gsap, useGSAP } from "@/lib/gsap/client";
import { countWords, hasFlexOrGridText, restoreWords, splitWords } from "@/lib/textReveal";
import { hiddenSelector, TEXT_REVEAL, type RevealState } from "@/constants/textRevealConfig";
import { MEDIA } from "@/constants/motion";

declare global {
  interface Window {
    __trFailsafe?: number;
  }
}

const { attrs, classes, word, block, maxWords, enterRatio } = TEXT_REVEAL;

/** Upper bound for waiting on hydration of an element before revealing it anyway. */
const HYDRATION_WAIT_MS = 4000;

function getState(el: Element): RevealState | null {
  return el.getAttribute(attrs.state) as RevealState | null;
}

function setState(el: Element, state: RevealState): void {
  el.setAttribute(attrs.state, state);
}

/**
 * React attaches its fiber to a host element (own property `__reactFiber$…`) when the element
 * is hydrated or created; server HTML that React has not reached yet has none.
 */
function isHydrated(el: Element): boolean {
  return Object.keys(el).some((key) => key.startsWith("__reactFiber$"));
}

function queryHidden(root: ParentNode): Element[] {
  try {
    const found = Array.from(root.querySelectorAll(hiddenSelector));
    if (root instanceof Element && root.matches(hiddenSelector)) found.unshift(root);
    return found;
  } catch {
    // Selector unsupported (no :has()): the stylesheet rule is dropped too, nothing is hidden.
    return [];
  }
}

function whenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: 600 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 120);
  return () => window.clearTimeout(id);
}

export function TextRevealGlobal(): null {
  useGSAP((_context, contextSafe) => {
    const html = document.documentElement;
    window.clearTimeout(window.__trFailsafe);
    if (!html.classList.contains(classes.js) || !contextSafe) return;

    const reducedQuery = window.matchMedia(MEDIA.reducedMotion);
    const running = new Set<Element>();
    const pending = new Set<Element>();
    const waiting = new Map<Element, number>();
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    let frame = 0;
    let waitTimer = 0;
    let sweepTimer = 0;
    let disposed = false;
    let cancelMutationIdle: () => void = () => {};

    const finish = (el: Element) => {
      running.delete(el);
      pending.delete(el);
      setState(el, "done");
    };

    const reveal = contextSafe((el: Element) => {
      if (disposed || !el.isConnected) return;
      const state = getState(el);
      if (state === "running" || state === "done") return;
      io?.unobserve(el);
      pending.delete(el);

      const words = countWords(el.textContent);
      if (words === 0 || reducedQuery.matches) {
        finish(el);
        return;
      }
      running.add(el);

      if (words > maxWords || hasFlexOrGridText(el)) {
        gsap.set(el, { opacity: 0, y: block.liftPx });
        setState(el, "running");
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: block.duration,
          ease: block.ease,
          clearProps: "opacity,transform",
          onComplete: () => finish(el),
        });
        return;
      }

      const spans = splitWords(el);
      const fontSize = parseFloat(window.getComputedStyle(el).fontSize) || 16;
      gsap.set(spans, {
        opacity: 0,
        filter: `blur(${word.blurPx}px)`,
        y: fontSize * word.liftEm,
        willChange: "transform, opacity, filter",
      });
      setState(el, "running");
      gsap.to(spans, {
        opacity: 1,
        filter: "blur(0px)",
        y: 0,
        duration: word.duration,
        ease: word.ease,
        stagger: {
          each: Math.min(word.staggerEach, word.staggerBudget / spans.length),
          from: "random",
        },
        onComplete: () => {
          restoreWords(el);
          finish(el);
        },
      });
    });

    /** Reveal without animation (focus moved into hidden copy, reduced motion switched on). */
    const revealNow = (el: Element) => {
      io?.unobserve(el);
      finish(el);
    };

    /** The last lines of a page may never cross the shrunk root; flush them at the bottom. */
    const flushBottom = () => {
      frame = 0;
      if (pending.size === 0) return;
      const scrolledToEnd =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (!scrolledToEnd) return;
      for (const el of Array.from(pending)) {
        const rect = el.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight) reveal(el);
      }
    };
    /** After scrolling stops: anything pending above the viewport was skipped over — show it. */
    const sweepAbove = () => {
      sweepTimer = 0;
      for (const el of Array.from(pending)) {
        if (el.getBoundingClientRect().bottom <= 0) revealNow(el);
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(flushBottom);
      if (sweepTimer) window.clearTimeout(sweepTimer);
      sweepTimer = window.setTimeout(sweepAbove, 150);
    };

    const track = (el: Element) => {
      if (reducedQuery.matches) {
        finish(el);
        return;
      }
      setState(el, "pending");
      pending.add(el);
      io?.observe(el);
    };

    const checkWaiting = () => {
      waitTimer = 0;
      const now = performance.now();
      for (const [el, since] of Array.from(waiting)) {
        if (!el.isConnected || getState(el)) {
          waiting.delete(el);
        } else if (isHydrated(el) || now - since > HYDRATION_WAIT_MS) {
          waiting.delete(el);
          track(el);
        }
      }
      if (waiting.size > 0) waitTimer = window.setTimeout(checkWaiting, 150);
      onScroll();
    };

    const consider = (el: Element) => {
      if (getState(el) || pending.has(el) || waiting.has(el)) return;
      if (isHydrated(el)) {
        track(el);
        return;
      }
      waiting.set(el, performance.now());
      if (!waitTimer) waitTimer = window.setTimeout(checkWaiting, 150);
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      for (const el of Array.from(pending)) {
        if (el.contains(target)) revealNow(el);
      }
    };

    const onReducedChange = () => {
      if (!reducedQuery.matches) return;
      for (const el of Array.from(pending)) revealNow(el);
    };

    const start = () => {
      if (disposed) return;
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) reveal(entry.target);
            // Already scrolled past (scroll restoration, anchor jumps, fast flings): show at once.
            else if (entry.boundingClientRect.bottom <= (entry.rootBounds?.top ?? 0))
              revealNow(entry.target);
          }
        },
        { rootMargin: `0px 0px -${Math.round(enterRatio * 100)}% 0px`, threshold: 0 },
      );
      queryHidden(document.body).forEach(consider);

      const added = new Set<Element>();
      let idlePending = false;
      mo = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element) added.add(node);
          });
        }
        if (added.size === 0 || idlePending) return;
        idlePending = true;
        cancelMutationIdle = whenIdle(() => {
          idlePending = false;
          for (const node of Array.from(added)) {
            if (node.isConnected) queryHidden(node).forEach(consider);
          }
          added.clear();
          onScroll();
        });
      });
      mo.observe(document.body, { childList: true, subtree: true });

      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      document.addEventListener("focusin", onFocusIn);
      reducedQuery.addEventListener("change", onReducedChange);
      onScroll();
    };

    const cancelStart = whenIdle(start);

    return () => {
      disposed = true;
      cancelStart();
      cancelMutationIdle();
      io?.disconnect();
      mo?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      if (waitTimer) window.clearTimeout(waitTimer);
      if (sweepTimer) window.clearTimeout(sweepTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("focusin", onFocusIn);
      reducedQuery.removeEventListener("change", onReducedChange);
      for (const el of Array.from(running)) {
        restoreWords(el);
        finish(el);
      }
      for (const el of Array.from(pending)) finish(el);
      for (const el of Array.from(waiting.keys())) finish(el);
    };
  });

  return null;
}
