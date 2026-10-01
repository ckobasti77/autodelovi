import { describe, expect, test } from "vitest";

import { markdownDescription } from "@/lib/content/markdown";

const MD = `## Dostava

Na sajtu nema plaćanja karticom. Porudžbinu šaljete bez plaćanja, a mi je **potvrđujemo** telefonom.

| Dostava | Cena |
| --- | --- |
| Kurir | 450 RSD |

- Prva stavka liste.`;

describe("content page meta description (COPY-10)", () => {
  test("whole sentences of the paragraphs, never headings, tables or lists", () => {
    const d = markdownDescription(MD, 155);
    expect(d).toBe(
      "Na sajtu nema plaćanja karticom. Porudžbinu šaljete bez plaćanja, a mi je potvrđujemo telefonom.",
    );
    expect(d).not.toMatch(/Dostava \||RSD|##|\*\*|Prva stavka/);
  });

  test("stops before a sentence that would not fit", () => {
    expect(markdownDescription(MD, 60)).toBe("Na sajtu nema plaćanja karticom.");
  });

  test("a first sentence longer than the limit is cut at a word", () => {
    const d = markdownDescription(`${"reč ".repeat(60)}kraj.`, 50);
    expect(d.length).toBeLessThanOrEqual(50);
    expect(d.endsWith("reč…")).toBe(true);
  });
});
