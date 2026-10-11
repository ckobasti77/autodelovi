// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TextRevealGlobal } from "@/components/TextRevealGlobal";
import { BLOCK_REVEAL, REVEAL_LINE } from "@/constants/revealConfig";
import { TEXT_REVEAL } from "@/constants/textRevealConfig";

const { attrs, classes } = TEXT_REVEAL;

/** jsdom viewport: 1024 × 768, so the line sits at 768 × (1 − REVEAL_LINE). */
const VIEWPORT = 768;
const LINE_Y = VIEWPORT * (1 - REVEAL_LINE);
const ROOT = { top: 0, bottom: LINE_Y, height: LINE_Y } as DOMRectReadOnly;

type Entry = Partial<IntersectionObserverEntry> & { target: Element };
let deliver: (entries: Entry[]) => void = () => {};
let observerOptions: IntersectionObserverInit | undefined;

class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    observerOptions = options;
    deliver = (entries) =>
      callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function rect(top: number, height: number): DOMRectReadOnly {
  return { top, bottom: top + height, height, width: 300, left: 0, right: 300 } as DOMRectReadOnly;
}

/** An entry for an element whose box starts at `top` and is `height` tall. */
const at = (target: Element, top: number, height = 20): Entry => ({
  target,
  isIntersecting: top < LINE_Y && top + height > 0,
  boundingClientRect: rect(top, height),
  rootBounds: ROOT,
});
/** Centre above the line. */
const enter = (target: Element): Entry => at(target, 100);
const leftAbove = (target: Element): Entry => at(target, -40);

function hydrated<T extends Element>(el: T): T {
  Object.defineProperty(el, "__reactFiber$test", { value: {}, enumerable: true });
  return el;
}

/** Server copy React has hydrated (TextRevealGlobal waits for the fiber property). */
function copy(text: string): HTMLParagraphElement {
  const p = hydrated(document.createElement("p"));
  p.textContent = text;
  document.body.appendChild(p);
  return p;
}

function group(count: number): { list: HTMLUListElement; items: HTMLLIElement[] } {
  const list = hydrated(document.createElement("ul"));
  list.setAttribute(BLOCK_REVEAL.attrs.group, "");
  const items = Array.from({ length: count }, (_, i) => {
    const li = hydrated(document.createElement("li"));
    li.innerHTML = `<h3>Kartica ${i + 1}</h3><p>Opis dela</p>`;
    list.appendChild(li);
    return li;
  });
  document.body.appendChild(list);
  return { list, items };
}

const delayOf = (el: HTMLElement) => el.style.getPropertyValue(BLOCK_REVEAL.delayVar);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
  );
  // jsdom has no layout: content sits inside the viewport, below the top (not „scrolled past“).
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    top: 100,
    bottom: 120,
    left: 0,
    right: 100,
    width: 100,
    height: 20,
  } as DOMRect);
  // …on a long page that is not scrolled to its end (no bottom flush).
  Object.defineProperty(document.documentElement, "scrollHeight", {
    value: 5000,
    configurable: true,
  });
  document.documentElement.classList.add(classes.js, classes.boot);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.className = "";
  document.body.innerHTML = "";
});

async function startObserver() {
  render(<TextRevealGlobal />);
  await act(async () => {
    vi.advanceTimersByTime(700);
  });
}

describe("TextRevealGlobal — copy", () => {
  it("splits copy on entry and restores the original text node afterwards", async () => {
    const p = copy("Prikaži ceo opis");
    const original = p.firstChild;
    await startObserver();
    expect(p.getAttribute(attrs.state)).toBe("pending");

    act(() => deliver([enter(p)]));
    expect(p.getAttribute(attrs.state)).toBe("running");
    expect(p.querySelectorAll(`.${classes.word}`)).toHaveLength(3);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(p.getAttribute(attrs.state)).toBe("done");
    expect(p.querySelectorAll(`.${classes.word}`)).toHaveLength(0);
    expect(p.firstChild).toBe(original);
    expect(p.textContent).toBe("Prikaži ceo opis");
  });

  it("an entry and an exit in one observer batch (fast scroll) never leave the words split", async () => {
    const p = copy("Prikaži ceo opis");
    const original = p.firstChild;
    await startObserver();
    expect(p.getAttribute(attrs.state)).toBe("pending");

    act(() => deliver([enter(p), leftAbove(p)]));

    expect(p.getAttribute(attrs.state)).toBe("done");
    expect(p.querySelectorAll(`.${classes.word}`)).toHaveLength(0);
    expect(p.firstChild).toBe(original);
    expect(p.textContent).toBe("Prikaži ceo opis");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(p.querySelectorAll(`.${classes.word}`)).toHaveLength(0);
  });
});

describe("TextRevealGlobal — the trigger line", () => {
  it("observes with the shared line and the centre threshold", async () => {
    await startObserver();
    expect(observerOptions?.rootMargin).toBe(`0px 0px -${Math.round(REVEAL_LINE * 100)}% 0px`);
    expect(observerOptions?.threshold).toEqual([0, 0.5]);
  });

  it("waits while the top is past the line but the centre is not, then reveals", async () => {
    const p = copy("Kočioni diskovi");
    await startObserver();

    // 20 px tall: top 15 px above the line, centre 5 px below it.
    act(() => deliver([at(p, LINE_Y - 5, 20)]));
    expect(p.getAttribute(attrs.state)).toBe("pending");

    // Centre exactly on the line.
    act(() => deliver([at(p, LINE_Y - 10, 20)]));
    expect(p.getAttribute(attrs.state)).toBe("running");
  });

  it("reveals an element taller than 60 % of the viewport when its top crosses the line", async () => {
    const tall = hydrated(document.createElement("div"));
    tall.setAttribute("data-reveal", "block");
    document.body.appendChild(tall);
    await startObserver();
    expect(tall.getAttribute(attrs.state)).toBe("pending");

    act(() => deliver([at(tall, LINE_Y - 4, VIEWPORT * 0.8)]));
    expect(tall.getAttribute(attrs.state)).toBe("running");
  });

  it("starts an element that can never reach the line once it is 48 px into the viewport", async () => {
    // The last screen of a page: the copy sits 900 px down and the page can scroll only 232 px,
    // so its centre never gets to the line (it would need 280 px).
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      top: 900,
      bottom: 920,
      left: 0,
      right: 100,
      width: 100,
      height: 20,
    } as DOMRect);
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: VIEWPORT + 232,
      configurable: true,
    });
    const p = copy("Radno vreme");
    await startObserver();
    // The settled sweep has recorded its deadline (900 − 768 + 48 = 180); nothing starts yet.
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(p.getAttribute(attrs.state)).toBe("pending");

    const scrollTo = async (y: number) => {
      Object.defineProperty(window, "scrollY", { value: y, configurable: true });
      await act(async () => {
        window.dispatchEvent(new Event("scroll"));
        vi.advanceTimersByTime(20);
      });
    };
    await scrollTo(170);
    expect(p.getAttribute(attrs.state)).toBe("pending");
    await scrollTo(184);
    expect(p.getAttribute(attrs.state)).toBe("running");
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("keeps content skipped by content-visibility pending until it has a box", async () => {
    const p = copy("Radno vreme");
    p.checkVisibility = (options?: CheckVisibilityOptions) => !options?.contentVisibilityAuto;
    await startObserver();

    act(() =>
      deliver([
        {
          target: p,
          isIntersecting: false,
          boundingClientRect: { top: 0, bottom: 0, height: 0, width: 0 } as DOMRectReadOnly,
          rootBounds: ROOT,
        },
      ]),
    );
    expect(p.getAttribute(attrs.state)).toBe("pending");

    act(() => deliver([enter(p)]));
    expect(p.getAttribute(attrs.state)).toBe("running");
  });
});

describe("TextRevealGlobal — blocks", () => {
  it("reveals the items of a group as one staggered batch in document order", async () => {
    const { items } = group(4);
    await startObserver();
    for (const item of items) expect(item.getAttribute(attrs.state)).toBe("pending");
    // Copy inside a block arrives with the block.
    expect(items[0]?.querySelector("h3")?.hasAttribute(attrs.state)).toBe(false);

    // Delivered out of order on purpose.
    act(() => deliver([enter(items[2]!), enter(items[0]!), enter(items[3]!), enter(items[1]!)]));

    const { stepMs } = BLOCK_REVEAL.default;
    expect(items.map((item) => item.getAttribute(attrs.state))).toEqual(Array(4).fill("running"));
    expect(items.map((item) => item.getAttribute(attrs.mode))).toEqual(
      Array(4).fill(BLOCK_REVEAL.modes.rise),
    );
    expect(items.map(delayOf)).toEqual(["", `${stepMs}ms`, `${stepMs * 2}ms`, `${stepMs * 3}ms`]);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    for (const item of items) {
      expect(item.getAttribute(attrs.state)).toBe("done");
      expect(item.hasAttribute(attrs.mode)).toBe(false);
      expect(item.hasAttribute("style")).toBe(false);
    }
  });

  it("caps the stagger of a large batch at the budget", async () => {
    const { items } = group(12);
    await startObserver();
    act(() => deliver(items.map((item) => enter(item))));

    const last = Number.parseInt(delayOf(items[11]!), 10);
    expect(last).toBe(BLOCK_REVEAL.default.budgetMs);
    expect(last + BLOCK_REVEAL.default.durationMs).toBeLessThanOrEqual(700);
  });

  it("leaves eager items alone and uses the lite timings inside a lite scope", async () => {
    const scope = document.createElement("div");
    scope.setAttribute(BLOCK_REVEAL.attrs.tone, "lite");
    document.body.appendChild(scope);
    const { list, items } = group(3);
    scope.appendChild(list);
    items[0]!.setAttribute(BLOCK_REVEAL.attrs.eager, "");
    await startObserver();

    expect(items[0]!.hasAttribute(attrs.state)).toBe(false);
    act(() => deliver([enter(items[1]!), enter(items[2]!)]));
    expect(delayOf(items[2]!)).toBe(`${BLOCK_REVEAL.lite.stepMs}ms`);

    act(() => {
      vi.advanceTimersByTime(BLOCK_REVEAL.lite.durationMs + BLOCK_REVEAL.lite.stepMs + 100);
    });
    expect(items[2]!.getAttribute(attrs.state)).toBe("done");
  });

  it("picks up items added later and shows content that is already scrolled past", async () => {
    const { list } = group(1);
    await startObserver();

    const added = hydrated(document.createElement("li"));
    added.textContent = "Novi artikal";
    await act(async () => {
      list.appendChild(added);
      await Promise.resolve();
    });
    expect(added.getAttribute(attrs.state)).toBe("pending");

    act(() => deliver([leftAbove(added)]));
    expect(added.getAttribute(attrs.state)).toBe("done");
  });

  it("marks everything done at once under reduced motion", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })),
    );
    const { items } = group(3);
    const p = copy("Dostava i plaćanje");
    await startObserver();
    for (const el of [...items, p]) expect(el.getAttribute(attrs.state)).toBe("done");
  });
});
