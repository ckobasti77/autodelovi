// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useFocusReturn } from "@/lib/dom/focusReturn";

/**
 * jsdom has no layout: every element gets a 100×20 box at the top of the viewport unless it is
 * marked `data-box="empty"` (zero box, like the emptied toast list) or `data-box="offscreen"`
 * (scrolled away).
 */
beforeAll(() => {
  const box = (el: Element) => el.getAttribute("data-box");
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (this: Element) {
    const empty = box(this) === "empty";
    return [{ width: empty ? 0 : 100, height: empty ? 0 : 20 }] as unknown as DOMRectList;
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const top = box(this) === "offscreen" ? 5000 : 10;
    return { top, bottom: top + 20, left: 0, right: 100, width: 100, height: 20 } as DOMRect;
  });
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  document.body.innerHTML = `
    <a href="#sadrzaj" id="skip">Preskoči na sadržaj</a>
    <header>
      <a href="/" id="logo">Euromotors Plus</a>
      <span id="chip-slot"><button type="button" id="chip">Izaberite vozilo</button></span>
      <button type="button" id="cart">Korpa</button>
    </header>
    <main id="sadrzaj" tabindex="-1">
      <a href="/delovi" id="far" data-box="offscreen">Delovi</a>
      <span id="badge-slot"><button type="button" id="badge">Izaberite vozilo da proverimo</button></span>
      <button type="button" id="add">Dodaj u korpu</button>
    </main>
    <div role="region"><ol tabindex="-1" id="toasts"><li tabindex="0" id="toast"><button type="button" id="action">Pogledaj korpu</button></li></ol></div>
    <div role="dialog" id="panel"><button type="button" id="inside">Zatvori</button></div>
  `;
  vi.mocked(Element.prototype.scrollIntoView).mockClear();
});

afterEach(() => cleanup());

const byId = (id: string) => document.getElementById(id) as HTMLElement;

/** Opens the hook with focus where the test put it, moves focus into the panel, runs `whileOpen`, closes. */
function openAndClose(whileOpen: () => void = () => {}) {
  const { result, rerender } = renderHook(({ open }) => useFocusReturn(true, open), {
    initialProps: { open: false },
  });
  rerender({ open: true });
  byId("inside").focus();
  act(whileOpen);
  const panel = byId("panel");
  const event = new Event("focusScope.autoFocusOnUnmount", { cancelable: true });
  panel.addEventListener(event.type, result.current.onCloseAutoFocus);
  panel.dispatchEvent(event);
  return event;
}

describe("useFocusReturn (A11Y-02)", () => {
  it("returns focus to the opener without scrolling the page", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    byId("cart").focus();
    const event = openAndClose();
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe("cart");
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    focus.mockRestore();
  });

  it("scrolls by the minimum only when the opener is entirely off screen", () => {
    byId("far").focus();
    openAndClose();
    expect(document.activeElement?.id).toBe("far");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      inline: "nearest",
    });
  });

  it("follows an opener that re-rendered as a new element (header chip after a vehicle choice)", () => {
    byId("chip").focus();
    openAndClose(() => {
      byId("chip-slot").innerHTML =
        '<span><button type="button" id="chip-set">Golf VII</button><button type="button" id="clear">Ukloni</button></span>';
    });
    expect(document.activeElement?.id).toBe("chip-set");
  });

  it("moves to the next control when the opener's slot has none left (fitment badge that now fits)", () => {
    byId("badge").focus();
    openAndClose(() => {
      byId("badge-slot").innerHTML = "<p>Odgovara za Golf VII</p>";
    });
    expect(document.activeElement?.id).toBe("add");
  });

  it("skips an emptied toast list and a vanished toast action for the control used before them", () => {
    byId("add").focus();
    byId("action").focus();
    // Radix Toast moves focus to its list when the focused toast closes.
    byId("toasts").focus();
    openAndClose(() => {
      byId("toast").remove();
      byId("toasts").setAttribute("data-box", "empty");
    });
    expect(document.activeElement?.id).toBe("add");
  });

  it("remembers a pressed control that the browser did not focus (Safari)", () => {
    byId("logo").focus();
    byId("logo").blur();
    byId("cart").dispatchEvent(new Event("pointerdown", { bubbles: true }));
    openAndClose();
    expect(document.activeElement?.id).toBe("cart");
  });

  it("never scrolls to an older control that is off screen; falls back to the main landmark", () => {
    byId("far").focus();
    byId("action").focus();
    openAndClose(() => {
      byId("toast").remove();
    });
    expect(document.activeElement?.id).toBe("sadrzaj");
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("opened from <body> (shortcut), ignores a control used earlier that is now off screen", () => {
    byId("far").focus();
    byId("far").blur();
    openAndClose();
    expect(document.activeElement?.id).toBe("sadrzaj");
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("takes focus back from an outer overlay container (picker opened from the filter sheet)", () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div role="dialog" id="sheet" tabindex="-1"><button type="button" id="in-sheet">Izaberite vozilo</button></div>',
    );
    byId("in-sheet").focus();
    openAndClose(() => byId("sheet").focus());
    expect(document.activeElement?.id).toBe("in-sheet");
  });

  it("leaves focus alone when the user already moved it outside the panel", () => {
    byId("chip").focus();
    openAndClose(() => byId("add").focus());
    expect(document.activeElement?.id).toBe("add");
  });
});
