"use client";

/**
 * The site-wide reveal engine — copy word by word, everything else as blocks. Mounted once in
 * the root layout; renders nothing.
 *
 * - After hydration, in an idle callback, finds every element the boot stylesheet hides — copy
 *   (`hiddenSelector`) and blocks (`blockHiddenSelector`: `data-reveal="block"` and the direct
 *   children of `data-reveal-group`) — marks it pending and observes it with ONE
 *   IntersectionObserver whose root is shrunk from the bottom by the shared line (REVEAL_LINE).
 * - Trigger rule: an element reveals when its vertical centre crosses the line; an element
 *   taller than REVEAL_TALL_RATIO of the viewport reveals when its top does. The decision is
 *   made from the observer entry's own rectangles (no layout read while scrolling).
 * - Copy: short copy is split into words (`splitWords`), each span gets its shuffled index `--i`
 *   and the word count `--n`, and the state flips to `running` — CSS keyframes animate them
 *   (PERF-05). Long copy (> maxWords) and text sitting directly in flex/grid boxes fade as a
 *   block. The DOM is restored as soon as the animation has ended.
 * - Blocks: opacity + a short lift, once. Blocks that cross the line in the same observer
 *   callback form a batch per group and start `stepMs` apart in document order (`--rv-d`),
 *   capped so the batch finishes within about 700 ms — a grid reveals row by row, card by card.
 * - Once every copy element carries an explicit state, `tr-hide` is removed from <html>: the
 *   `:has()`-based boot rule stops being evaluated and only `[data-reveal-state="pending"]`
 *   hides. A MutationObserver marks streamed, client-navigated and newly listed content pending
 *   before it is painted (MutationObserver callbacks run before the next frame).
 * - Never touches an element before React has hydrated it (streamed Suspense boundaries
 *   hydrate after the root): such elements wait, and proceed after HYDRATION_WAIT_MS at the
 *   latest (e.g. a boundary whose JS failed) so nothing stays hidden.
 * - Nothing stays hidden: elements already above the viewport are shown at once (scroll
 *   restoration, anchor jumps, fast flings — also checked when scrolling stops), elements that
 *   can never reach the line are flushed at the end of the page, focus moving into hidden
 *   content shows it, and content skipped by `content-visibility: auto` waits until the
 *   browser renders it.
 * - Failsafe: if the boot script's timer fired before this component mounted, everything is
 *   already visible — nothing is hidden or animated again in this document (PERF-06).
 * - Reduced motion: nothing is hidden (CSS) and everything is marked done immediately.
 *
 * Rules: .claude/rules/architecture.md → „Reveal“.
 */
import { useEffect } from "react";

import {
  countWords,
  hasFlexOrGridText,
  restoreWords,
  shuffledOrder,
  splitWords,
} from "@/lib/textReveal";
import {
  BLOCK_REVEAL,
  REVEAL_TALL_RATIO,
  blockHiddenSelector,
  staggerDelayMs,
} from "@/constants/revealConfig";
import { hiddenSelector, TEXT_REVEAL, type RevealState } from "@/constants/textRevealConfig";
import { MEDIA } from "@/constants/motion";

declare global {
  interface Window {
    __trFailsafe?: number;
  }
}

const { attrs, classes, word, block, maxWords, enterRatio } = TEXT_REVEAL;

type Kind = "text" | "block";
type Box = { top: number; bottom: number; height: number };

/** Upper bound for waiting on hydration of an element before revealing it anyway. */
const HYDRATION_WAIT_MS = 4000;
/** Slack after the last keyframe before the DOM is restored. */
const END_SLACK_MS = 60;
/** Scrolling counts as stopped after this long without a scroll event. */
const SCROLL_IDLE_MS = 150;

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

function matchAll(root: ParentNode, selector: string): Element[] {
  try {
    const found = Array.from(root.querySelectorAll(selector));
    if (root instanceof Element && root.matches(selector)) found.unshift(root);
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

/**
 * True for an element inside a `content-visibility: auto` subtree the browser is skipping: it
 * has no box yet, but it is not `display: none` — the observer reports it again once rendered.
 */
function isSkippedByContentVisibility(el: Element): boolean {
  if (typeof el.checkVisibility !== "function") return false;
  return el.checkVisibility() && !el.checkVisibility({ contentVisibilityAuto: true });
}

/** The trigger rule (REVEAL_LINE): centre past the line; top for tall elements. */
function hasCrossed(box: Box, lineY: number, viewportHeight: number): boolean {
  if (box.height > viewportHeight * REVEAL_TALL_RATIO) return box.top <= lineY;
  return box.top + box.height / 2 <= lineY + 0.5;
}

function byDocumentOrder(a: Element, b: Element): number {
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

export function TextRevealGlobal(): null {
  useEffect(() => {
    const html = document.documentElement;
    window.clearTimeout(window.__trFailsafe);
    if (!html.classList.contains(classes.js)) return;
    // The failsafe already revealed everything: never hide content that is on screen again.
    if (html.classList.contains(classes.failsafe)) {
      html.classList.remove(classes.boot);
      return;
    }

    const reducedQuery = window.matchMedia(MEDIA.reducedMotion);
    const running = new Map<Element, number>();
    const pending = new Map<Element, Kind>();
    /** Pending elements inside the observer root that have not crossed the line yet. */
    const armed = new Set<Element>();
    const waiting = new Map<Element, { since: number; kind: Kind }>();
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    let frame = 0;
    let waitTimer = 0;
    let idleTimer = 0;
    let disposed = false;

    /** True while the `:has()` boot rule still hides unmarked server copy. */
    const bootRuleActive = () => html.classList.contains(classes.boot);
    /** Drop the boot rule once nothing depends on it (all copy marked, page loaded). */
    const releaseBootRule = () => {
      if (disposed || !bootRuleActive()) return;
      if (document.readyState !== "complete") return;
      for (const entry of waiting.values()) if (entry.kind === "text") return;
      html.classList.remove(classes.boot);
    };

    const finish = (el: Element) => {
      const timer = running.get(el);
      if (timer) window.clearTimeout(timer);
      running.delete(el);
      pending.delete(el);
      armed.delete(el);
      // Whichever path ends a reveal gets the original text nodes back (a no-op unless split): one
      // IntersectionObserver batch can carry an element's entry *and* its exit above the root
      // (a fast scroll), and the exit's revealNow() used to clear the restore timer the entry had
      // just started — the word spans then stayed in the DOM for good.
      restoreWords(el);
      el.removeAttribute(attrs.mode);
      if (el instanceof HTMLElement && el.style.getPropertyValue(BLOCK_REVEAL.delayVar)) {
        el.style.removeProperty(BLOCK_REVEAL.delayVar);
        if (el.getAttribute("style") === "") el.removeAttribute("style");
      }
      setState(el, "done");
    };

    const revealText = (el: Element) => {
      const words = countWords(el.textContent);
      if (words === 0) {
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

    const revealBlock = (el: Element, index: number, count: number) => {
      const lite = el.closest(`[${BLOCK_REVEAL.attrs.tone}="lite"]`) !== null;
      const fade = el.getAttribute(BLOCK_REVEAL.attrs.variant) === BLOCK_REVEAL.modes.fade;
      const timing = lite ? BLOCK_REVEAL.lite : BLOCK_REVEAL.default;
      const delay = staggerDelayMs(index, count, timing);
      if (delay > 0 && el instanceof HTMLElement) {
        el.style.setProperty(BLOCK_REVEAL.delayVar, `${delay}ms`);
      }
      el.setAttribute(attrs.mode, fade ? BLOCK_REVEAL.modes.fade : BLOCK_REVEAL.modes.rise);
      setState(el, "running");
      const duration = fade ? BLOCK_REVEAL.fade.durationMs : timing.durationMs;
      running.set(
        el,
        window.setTimeout(() => finish(el), duration + delay + END_SLACK_MS),
      );
    };

    /** Start every element of one observer callback: copy at once, blocks staggered per group. */
    const revealBatch = (elements: Element[]) => {
      if (disposed || elements.length === 0) return;
      const groups = new Map<Element | null, Element[]>();
      for (const el of elements) {
        const kind = pending.get(el);
        const state = getState(el);
        if (!kind || !el.isConnected || state === "running" || state === "done") continue;
        io?.unobserve(el);
        pending.delete(el);
        armed.delete(el);
        if (reducedQuery.matches) {
          finish(el);
        } else if (kind === "text") {
          revealText(el);
        } else {
          const parent = el.parentElement;
          const key = parent?.hasAttribute(BLOCK_REVEAL.attrs.group) ? parent : null;
          const list = groups.get(key);
          if (list) list.push(el);
          else groups.set(key, [el]);
        }
      }
      for (const list of groups.values()) {
        list.sort(byDocumentOrder);
        list.forEach((el, index) => revealBlock(el, index, list.length));
      }
    };

    /** Reveal without animation (focus moved into hidden content, reduced motion switched on). */
    const revealNow = (el: Element) => {
      io?.unobserve(el);
      finish(el);
    };

    /**
     * The rectangle to judge a pending element by outside the observer: its own, or — while
     * `content-visibility: auto` skips it — the nearest ancestor that has a box.
     */
    const measure = (el: Element): Box | null => {
      let node: Element | null = el;
      while (node) {
        const rect = node.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          return { top: rect.top, bottom: rect.bottom, height: node === el ? rect.height : 0 };
        }
        if (node === el && !isSkippedByContentVisibility(el)) return null;
        node = node.parentElement;
      }
      return null;
    };

    /**
     * Two fallbacks the observer cannot cover, run with all reads before any write:
     * - at the end of the page (rAF while scrolling), elements on screen that can never reach
     *   the line are revealed;
     * - once scrolling stops, elements left above the viewport are shown, and armed elements
     *   whose intersection ratio never reaches the threshold (clipped by a scroller) are
     *   re-checked against the line.
     */
    const sweep = (settled: boolean) => {
      if (disposed || pending.size === 0) return;
      const viewportHeight = window.innerHeight;
      const scrolledToEnd =
        viewportHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (!settled && !scrolledToEnd) return;
      const lineY = viewportHeight * (1 - enterRatio);
      const candidates = Array.from(pending.keys());
      const boxes = candidates.map((el) => (el.isConnected ? measure(el) : null));
      const batch: Element[] = [];
      candidates.forEach((el, index) => {
        const box = boxes[index];
        if (!el.isConnected) {
          finish(el);
        } else if (!box) {
          // No box and not skipped by content-visibility: `display: none` — nothing to animate.
          if (settled && !isSkippedByContentVisibility(el)) revealNow(el);
        } else if (box.bottom <= 0) {
          if (settled) revealNow(el);
        } else if (box.top < viewportHeight && box.height > 0) {
          if (scrolledToEnd) batch.push(el);
          else if (settled && armed.has(el) && hasCrossed(box, lineY, viewportHeight))
            batch.push(el);
        }
      });
      revealBatch(batch);
    };
    const onScroll = () => {
      if (!frame)
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          sweep(false);
        });
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        idleTimer = 0;
        sweep(true);
      }, SCROLL_IDLE_MS);
    };

    const track = (el: Element, kind: Kind) => {
      if (reducedQuery.matches) {
        finish(el);
        return;
      }
      setState(el, "pending");
      pending.set(el, kind);
      io?.observe(el);
    };

    const checkWaiting = () => {
      waitTimer = 0;
      const now = performance.now();
      for (const [el, entry] of Array.from(waiting)) {
        if (!el.isConnected || getState(el)) {
          waiting.delete(el);
        } else if (isHydrated(el) || now - entry.since > HYDRATION_WAIT_MS) {
          waiting.delete(el);
          // Blocks are hidden by their own rule until they carry a state. Copy without the
          // boot rule has been visible all along: do not hide it now.
          if (entry.kind === "block" || bootRuleActive()) track(el, entry.kind);
          else finish(el);
        }
      }
      if (waiting.size > 0) waitTimer = window.setTimeout(checkWaiting, 150);
      else releaseBootRule();
      onScroll();
    };

    const consider = (el: Element, kind: Kind) => {
      if (getState(el) || pending.has(el) || waiting.has(el)) return;
      if (isHydrated(el)) {
        track(el, kind);
        return;
      }
      waiting.set(el, { since: performance.now(), kind });
      if (!waitTimer) waitTimer = window.setTimeout(checkWaiting, 150);
    };

    const scan = (root: ParentNode) => {
      for (const el of matchAll(root, blockHiddenSelector)) consider(el, "block");
      for (const el of matchAll(root, hiddenSelector)) consider(el, "text");
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      for (const el of Array.from(pending.keys())) {
        if (el.contains(target)) revealNow(el);
      }
    };

    const onReducedChange = () => {
      if (!reducedQuery.matches) return;
      for (const el of Array.from(pending.keys())) revealNow(el);
    };

    const onLoad = () => releaseBootRule();

    const onIntersect: IntersectionObserverCallback = (entries) => {
      const viewportHeight = window.innerHeight;
      const batch: Element[] = [];
      for (const entry of entries) {
        const el = entry.target;
        if (!pending.has(el)) continue;
        const rect = entry.boundingClientRect;
        if (rect.width === 0 && rect.height === 0) {
          // Skipped by content-visibility: reported again when the browser renders it.
          if (isSkippedByContentVisibility(el)) continue;
          revealNow(el);
          continue;
        }
        // Already scrolled past (scroll restoration, anchor jumps, fast flings): show at once.
        if (!entry.isIntersecting && rect.bottom <= (entry.rootBounds?.top ?? 0)) {
          revealNow(el);
          continue;
        }
        if (!entry.isIntersecting) {
          armed.delete(el);
          continue;
        }
        const lineY = entry.rootBounds?.bottom ?? viewportHeight * (1 - enterRatio);
        if (hasCrossed(rect, lineY, viewportHeight)) batch.push(el);
        else armed.add(el);
      }
      revealBatch(batch);
    };

    const start = () => {
      if (disposed) return;
      io = new IntersectionObserver(onIntersect, {
        rootMargin: `0px 0px -${Math.round(enterRatio * 100)}% 0px`,
        // 0: the top enters the root (tall elements reveal, the rest are armed);
        // 0.5: half of the element is above the line — its centre has crossed it.
        threshold: [0, 0.5],
      });
      scan(document.body);

      // Synchronous on purpose: the callback runs before the next frame, so new content is
      // marked pending (hidden) before it is ever painted, without the document-wide boot rule.
      mo = new MutationObserver((mutations) => {
        let added = false;
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element && node.isConnected) {
              scan(node);
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

    // After hydration, off the critical path; the timeout bounds how long content waits.
    const cancelStart = whenIdle(start, 600);

    return () => {
      disposed = true;
      cancelStart();
      io?.disconnect();
      mo?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      if (waitTimer) window.clearTimeout(waitTimer);
      if (idleTimer) window.clearTimeout(idleTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("load", onLoad);
      document.removeEventListener("focusin", onFocusIn);
      reducedQuery.removeEventListener("change", onReducedChange);
      for (const el of Array.from(running.keys())) finish(el);
      for (const el of Array.from(pending.keys())) finish(el);
      for (const el of Array.from(waiting.keys())) finish(el);
    };
  }, []);

  return null;
}
