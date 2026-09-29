import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RevealText } from "@/components/text-reveal/RevealText";
import { shuffledOrder } from "@/lib/textReveal";

describe("RevealText (LCP-safe, server-rendered)", () => {
  it("renders the tag, opts out of the global pass and sets the word count", () => {
    const html = renderToStaticMarkup(<RevealText as="h1">Rasklopi auto. Nađi deo.</RevealText>);
    expect(html.startsWith("<h1")).toBe(true);
    expect(html).toContain('data-reveal="off"');
    expect(html).toContain("--n:4");
    expect(html.match(/class="rw"/g)).toHaveLength(4);
  });

  it("assigns every word a shuffled index — a permutation seeded by the text", () => {
    const text = "Delovi za Volkswagen, Audi, Škoda, SEAT i Cupra";
    const html = renderToStaticMarkup(<RevealText>{text}</RevealText>);
    const indices = [...html.matchAll(/--i:(\d+)/g)].map((m) => Number(m[1]));
    expect(indices).toEqual(shuffledOrder(8, text));
  });

  it("turns a newline into a line break and keeps the words in order", () => {
    const html = renderToStaticMarkup(
      <RevealText as="h1">{"Rasklopi\nauto.\nNađi deo."}</RevealText>,
    );
    expect(html.match(/<br\/>/g)).toHaveLength(2);
    const words = [...html.matchAll(/class="rw"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(words).toEqual(["Rasklopi", "auto.", "Nađi", "deo."]);
  });

  it("keeps no-break spaces inside a word and collapses ordinary whitespace", () => {
    const html = renderToStaticMarkup(<RevealText>{"Cena   12.990 RSD"}</RevealText>);
    const words = [...html.matchAll(/class="rw"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(words).toEqual(["Cena", "12.990 RSD"]);
  });

  it("passes other attributes through", () => {
    const html = renderToStaticMarkup(
      <RevealText as="p" id="lead" className="type-lead">
        Tekst
      </RevealText>,
    );
    expect(html).toContain('id="lead"');
    expect(html).toContain('class="type-lead"');
  });
});
