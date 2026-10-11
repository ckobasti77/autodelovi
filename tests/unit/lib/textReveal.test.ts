// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import {
  countWords,
  hasFlexOrGridText,
  hashText,
  isSplit,
  restoreWords,
  shuffledOrder,
  splitWords,
} from "@/lib/textReveal";
import { hiddenSelector, TEXT_REVEAL } from "@/constants/textRevealConfig";
import {
  buildTextRevealBootScript,
  buildTextRevealCss,
  buildTextRevealNoscriptCss,
} from "@/lib/textRevealCss";

function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host.firstElementChild as HTMLElement;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("splitWords / restoreWords", () => {
  it("moves the original text node into the first word span (never clones)", () => {
    const p = mount("<p>Rasklopi auto sada</p>");
    const original = p.firstChild as Text;
    const spans = splitWords(p);
    expect(spans).toHaveLength(3);
    expect(spans[0]?.firstChild).toBe(original);
    expect(spans.every((span) => span.classList.contains(TEXT_REVEAL.classes.word))).toBe(true);
    expect(p.textContent).toBe("Rasklopi auto sada");
  });

  it("keeps whitespace as text between the spans so lines still break", () => {
    const p = mount("<p>jedan  dva\ntri</p>");
    splitWords(p);
    const whitespace = [...p.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent);
    expect(whitespace).toEqual(["  ", "\n"]);
  });

  it("keeps a no-break space inside one word", () => {
    const p = mount("<p>Cena 12.990 RSD sa PDV-om</p>");
    const spans = splitWords(p);
    expect(spans.map((span) => span.textContent)).toEqual(["Cena", "12.990 RSD", "sa", "PDV-om"]);
  });

  it("splits text inside inline children (links) but skips opted-out subtrees and buttons", () => {
    const p = mount(
      '<p>Vidi <a href="/x">uslove dostave</a> <span data-reveal="off">12.990 RSD</span> <button>U korpu</button></p>',
    );
    const spans = splitWords(p);
    expect(spans.map((span) => span.textContent)).toEqual(["Vidi", "uslove", "dostave"]);
    expect(p.querySelector("a")?.querySelectorAll(`.${TEXT_REVEAL.classes.word}`)).toHaveLength(2);
    expect(p.querySelector('[data-reveal="off"]')?.textContent).toBe("12.990 RSD");
  });

  it("restores the exact nodes, values and markup", () => {
    const html = "Pre zamene <strong>proverite</strong> broj na kućištu.";
    const p = mount(`<p>${html}</p>`);
    const originals = [...p.childNodes].flatMap((node) =>
      node.nodeType === Node.TEXT_NODE ? [node] : [...node.childNodes],
    );
    splitWords(p);
    expect(isSplit(p)).toBe(true);
    restoreWords(p);
    expect(isSplit(p)).toBe(false);
    expect(p.innerHTML).toBe(html);
    const after = [...p.childNodes].flatMap((node) =>
      node.nodeType === Node.TEXT_NODE ? [node] : [...node.childNodes],
    );
    expect(after).toHaveLength(originals.length);
    after.forEach((node, i) => expect(node).toBe(originals[i]));
    expect(p.querySelectorAll(`.${TEXT_REVEAL.classes.word}`)).toHaveLength(0);
  });

  it("keeps React's value when the node was rewritten while split", () => {
    const p = mount("<p>Stara cena</p>");
    const node = p.firstChild as Text;
    splitWords(p);
    node.data = "Nova vrednost";
    restoreWords(p);
    expect(p.textContent).toBe("Nova vrednost");
    expect(p.firstChild).toBe(node);
  });

  it("is idempotent: a second split returns the same spans, a second restore is a no-op", () => {
    const p = mount("<p>jedan dva</p>");
    const first = splitWords(p);
    expect(splitWords(p)).toEqual(first);
    restoreWords(p);
    restoreWords(p);
    expect(p.innerHTML).toBe("jedan dva");
  });

  it("marks and unmarks a split element for translation tooling", () => {
    const p = mount("<p>jedan dva</p>");
    splitWords(p);
    expect(p.hasAttribute(TEXT_REVEAL.attrs.split)).toBe(true);
    restoreWords(p);
    expect(p.hasAttribute(TEXT_REVEAL.attrs.split)).toBe(false);
  });
});

describe("helpers", () => {
  it.each([
    ["", 0],
    ["   ", 0],
    ["jedan", 1],
    ["jedan  dva\ntri", 3],
  ])("countWords(%j) = %i", (text, expected) => {
    expect(countWords(text)).toBe(expected);
  });

  it("detects text sitting directly in a flex container", () => {
    const flex = mount('<p style="display:flex">Na stanju <span>4 kom.</span></p>');
    const plain = mount("<p>Na <span>stanju</span></p>");
    expect(hasFlexOrGridText(flex)).toBe(true);
    expect(hasFlexOrGridText(plain)).toBe(false);
  });

  it("shuffledOrder is a deterministic permutation seeded by the text", () => {
    const a = shuffledOrder(9, "Rasklopi auto. Nađi deo.");
    expect([...a].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(shuffledOrder(9, "Rasklopi auto. Nađi deo.")).toEqual(a);
    expect(shuffledOrder(9, "Drugi tekst")).not.toEqual(a);
    expect(shuffledOrder(0, "x")).toEqual([]);
  });

  it("hashText is a stable 32-bit FNV-1a", () => {
    expect(hashText("")).toBe(0x811c9dc5);
    expect(hashText("Euromotors Plus")).toBe(hashText("Euromotors Plus"));
    expect(hashText("Euromotors Plus")).toBeLessThan(2 ** 32);
  });
});

describe("generated stylesheet and boot script", () => {
  it("hides exactly the selector the observer reveals, only under html.tr-js without failsafe", () => {
    const squash = (value: string) => value.replace(/\s*,\s*/g, ",");
    const css = squash(buildTextRevealCss());
    expect(css).toContain(`html.${TEXT_REVEAL.classes.js}:not(.${TEXT_REVEAL.classes.failsafe})`);
    expect(css).toContain(squash(`:is(${hiddenSelector})`));
    expect(css).toContain('[data-reveal-state="running"]');
    expect(css).toContain("prefers-reduced-motion: no-preference");
    expect(css).toContain("scripting: none");
  });

  it("splits hiding into a boot rule (tr-hide, selector) and a runtime rule (pending attribute)", () => {
    const squash = (value: string) => value.replace(/\s*,\s*/g, ",");
    const css = squash(buildTextRevealCss());
    const { classes, attrs } = TEXT_REVEAL;
    expect(css).toContain(
      squash(
        `html.${classes.boot}:not(.${classes.failsafe}) :is(${hiddenSelector}):not([${attrs.state}])`,
      ),
    );
    expect(css).toContain(
      `html.${classes.js}:not(.${classes.failsafe}) [${attrs.state}="pending"]{opacity: 0;}`,
    );
  });

  it("animates words and blocks with CSS keyframes; phones get the variant without blur", () => {
    const css = buildTextRevealCss();
    const { classes, attrs, word, block } = TEXT_REVEAL;
    expect(css).toContain(
      `[${attrs.state}="running"] .${classes.word}{animation: tr-word ${word.durationMs}ms`,
    );
    expect(css).toContain(
      `calc(var(--i,0) * min(${word.staggerEachMs}ms,${word.staggerBudgetMs}ms / var(--n,1)))`,
    );
    expect(css).toContain(
      `[${attrs.state}="running"][${attrs.mode}="block"]{animation: tr-block ${block.durationMs}ms`,
    );
    expect(css).toMatch(/@keyframes tr-word\{from\{opacity: 0;filter: blur\(8px\)/);
    expect(css).toMatch(/@keyframes tr-word-lite\{from\{opacity: 0;transform: translateY/);
    for (const feature of TEXT_REVEAL.liteMedia) {
      expect(css).toContain(
        `and ${feature}{[${attrs.state}="running"] .${classes.word}{animation-name: tr-word-lite;}}`,
      );
    }
    // Every animation sits behind the reduced-motion gate.
    expect(css.match(/animation:/g)?.length).toBe(3);
    expect(css.split("@media screen and (prefers-reduced-motion: no-preference)").length - 1).toBe(
      2 + TEXT_REVEAL.liteMedia.length,
    );
  });

  it("the noscript stylesheet forces visibility", () => {
    expect(buildTextRevealNoscriptCss().replace(/ /g, "")).toContain("opacity:1!important");
  });

  it("the boot script adds tr-js and arms the failsafe", () => {
    document.documentElement.className = "";
    new Function(buildTextRevealBootScript())();
    expect(document.documentElement.classList.contains(TEXT_REVEAL.classes.js)).toBe(true);
    expect(document.documentElement.classList.contains(TEXT_REVEAL.classes.boot)).toBe(true);
    expect(window.__trFailsafe).toBeDefined();
    window.clearTimeout(window.__trFailsafe);
    document.documentElement.className = "";
  });
});

describe("hiddenSelector (DOM semantics)", () => {
  let supported = true;
  try {
    document.querySelectorAll(hiddenSelector);
  } catch {
    supported = false;
  }

  it.runIf(supported)(
    "hides top-level copy, never containers, skipped chrome or nested copy",
    () => {
      const root = mount(`
      <main>
        <h2 id="h">Naslov</h2>
        <p id="p">Pasus <a href="/x">link</a></p>
        <ul><li id="li">Stavka <p id="nested">ugnežđen</p></li></ul>
        <ul><li id="card"><article><h3 id="card-title">Disk</h3><img alt=""></article></li></ul>
        <nav><p id="nav-p">Meni</p></nav>
        <div data-reveal="off"><p id="off">Isključeno</p></div>
        <p id="with-price">Cena <span data-reveal="off">12.990 RSD</span></p>
        <span id="eyebrow">Kočnice</span>
        <p><span id="inner-span">unutra</span></p>
        <div data-reveal="text" id="explicit">Broj 187</div>
      </main>`);
      const hidden = new Set(
        [...root.querySelectorAll(hiddenSelector)].map((el) => el.id).filter(Boolean),
      );
      expect(hidden).toEqual(new Set(["h", "p", "li", "card-title", "eyebrow", "explicit"]));
    },
  );
});
