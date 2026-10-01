"use client";

/**
 * Site-wide text reveal. Mounted once in the root layout; renders nothing.
 *
 * - After hydration, in an idle callback, finds every element matching `hiddenSelector` (the
 *   selector the boot stylesheet hides), marks it pending and observes it with one
 *   IntersectionObserver whose root is shrunk from the bottom by `enterRatio`.
 * - On entry: short copy is split into words (`splitWords`), each span gets its shuffled index
 *   `--i` and the word count `--n`, and the state flips to `running` — the CSS keyframes in
 *   lib/textRevealCss.ts animate them (no per-frame JS, PERF-05). Long copy (> maxWords) and
 *   text sitting directly in flex/grid boxes fade as a block. The DOM is restored as soon as
 *   the animation has ended.
 * - Once every element carries an explicit state, `tr-hide` is removed from <html>: the
 *   `:has()`-based boot rule stops being evaluated and only `[data-reveal-state="pending"]`
 *   hides. A MutationObserver marks streamed and client-navigated copy pending before it is
 *   painted (MutationObserver callbacks run before the next frame).
 * - Never touches an element before React has hydrated it (streamed Suspense boundaries
 *   hydrate after the root): such elements wait, and proceed after HYDRATION_WAIT_MS at the
 *   latest (e.g. a boundary whose JS failed) so nothing stays hidden.
 * - Failsafe: if the boot script's timer fired before this component mounted, the copy is
 *   already visible — nothing is hidden or animated again in this document (PERF-06).
 * - Reduced motion: nothing is hidden (CSS) and everything is marked done immediately.
 *
 * Rules: .claude/rules/architecture.md → „Text Reveal“.
 */
import { useEffect } from "react";

import {
  countWords,
  hasFlexOrGridText,
  restoreWords,
  shuffledOrder,
  splitWords,
} from "@/lib/textReveal";
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
/** Slack after the last keyframe before the DOM is restored. */
const END_SLACK_MS = 60;

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

function whenIdle(callback: () => void, timeout: number): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 120);
  return () => window.clearTimeout(id);
}

export function TextRevealGlobal(): null {
  useEffect(() => {
    const html = document.documentElement;
    window.clearTimeout(window.__trFailsafe);
    if (!html.classList.contains(classes.js)) return;
    // The failsafe already revealed everything: never hide copy that is on screen again.
    if (html.classList.contains(classes.failsafe)) {
      html.classList.remove(classes.boot);
      return;
    }

    const reducedQuery = window.matchMedia(MEDIA.reducedMotion);
    const running = new Map<Element, number>();
    const pending = new Set<Element>();
    const waiting = new Map<Element, number>();
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    let frame = 0;
    let waitTimer = 0;
    let sweepTimer = 0;
    let disposed = false;

    /** True while the `:has()` boot rule still hides unmarked server HTML. */
    const bootRuleActive = () => html.classList.contains(classes.boot);
    /** Drop the boot rule once nothing depends on it (all copy marked, page loaded). */
    const releaseBootRule = () => {
      if (disposed || !bootRuleActive()) return;
      if (waiting.size > 0 || document.readyState !== "complete") return;
      html.classList.remove(classes.boot);
    };

    const finish = (el: Element) => {
      const timer = running.get(el);
      if (timer) window.clearTimeout(timer);
      running.delete(el);
      pending.delete(el);
      // Whichever path ends a reveal gets the original text nodes back (a no-op unless split): one
      // IntersectionObserver batch can carry an element's entry *and* its exit above the root
      // (a fast scroll), and the exit's revealNow() used to clear the restore timer the entry had
      // just started — the word spans then stayed in the DOM for good.
      restoreWords(el);
      el.removeAttribute(attrs.mode);
      setState(el, "done");
    };

    const reveal = (el: Element) => {
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

      if (words > maxWords || hasFlexOrGridText(el)) {
        el.setAttribute(attrs.mode, "block");
        setState(el, "running");
        running.set(
          el,
          window.setTimeout(() => finish(el), block.durationMs + END_SLACK_MS),
        );
        return;
      }

      const spans = splitWords(el);
      const order = shuffledOrder(spans.length, el.textContent ?? "");
      spans.forEach((span, index) => {
        span.style.setProperty("--i", String(order[index] ?? 0));
        span.style.setProperty("--n", String(spans.length));
      });
      setState(el, "running");
      const step = Math.min(word.staggerEachMs, word.staggerBudgetMs / Math.max(spans.length, 1));
      const total = word.durationMs + step * Math.max(spans.length - 1, 0) + END_SLACK_MS;
      running.set(
        el,
        window.setTimeout(() => finish(el), total),
      );
    };

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
          // Without the boot rule this copy has been visible all along: do not hide it now.
          if (bootRuleActive()) track(el);
          else finish(el);
        }
      }
      if (waiting.size > 0) waitTimer = window.setTimeout(checkWaiting, 150);
      else releaseBootRule();
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

    const onLoad = () => releaseBootRule();

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

      // Synchronous on purpose: the callback runs before the next frame, so new copy is marked
      // pending (hidden) before it is ever painted, without the document-wide boot rule.
      mo = new MutationObserver((mutations) => {
        let added = false;
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element && node.isConnected) {
              queryHidden(node).forEach(consider);
              added = true;
            }
          });
        }
        if (added) onScroll();
      });
      mo.observe(document.body, { childList: true, subtree: true });

      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      window.addEventListener("load", onLoad);
      document.addEventListener("focusin", onFocusIn);
      reducedQuery.addEventListener("change", onReducedChange);
      onScroll();
      releaseBootRule();
    };

    // After hydration, off the critical path; the timeout bounds how long copy waits.
    const cancelStart = whenIdle(start, 600);

    return () => {
      disposed = true;
      cancelStart();
      io?.disconnect();
      mo?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      if (waitTimer) window.clearTimeout(waitTimer);
      if (sweepTimer) window.clearTimeout(sweepTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("load", onLoad);
      document.removeEventListener("focusin", onFocusIn);
      reducedQuery.removeEventListener("change", onReducedChange);
      for (const el of Array.from(running.keys())) finish(el);
      for (const el of Array.from(pending)) finish(el);
      for (const el of Array.from(waiting.keys())) finish(el);
    };
  }, []);

  return null;
}
