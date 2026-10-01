// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TextRevealGlobal } from "@/components/TextRevealGlobal";
import { TEXT_REVEAL } from "@/constants/textRevealConfig";

const { attrs, classes } = TEXT_REVEAL;

type Entry = Partial<IntersectionObserverEntry> & { target: Element };
let deliver: (entries: Entry[]) => void = () => {};

class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
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

const enter = (target: Element): Entry => ({
  target,
  isIntersecting: true,
  boundingClientRect: { top: 100, bottom: 120 } as DOMRectReadOnly,
  rootBounds: { top: 0 } as DOMRectReadOnly,
});
const leftAbove = (target: Element): Entry => ({
  target,
  isIntersecting: false,
  boundingClientRect: { top: -40, bottom: -20 } as DOMRectReadOnly,
  rootBounds: { top: 0 } as DOMRectReadOnly,
});

/** Server copy React has hydrated (TextRevealGlobal waits for the fiber property). */
function copy(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.textContent = text;
  Object.defineProperty(p, "__reactFiber$test", { value: {}, enumerable: true });
  document.body.appendChild(p);
  return p;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
  );
  // jsdom has no layout: copy sits inside the viewport, below the top (not „scrolled past“).
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

describe("TextRevealGlobal", () => {
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
