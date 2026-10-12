import { describe, expect, it } from "vitest";

import { SEED_FAQS as FAQS, SEED_PAGES as PAGES } from "@/convex/seedData/content";
import { fillPlaceholders } from "@/lib/content/placeholders";
import { cutoffLabel, fastestContactSentence } from "@/lib/settings/public";

describe("sentence-level placeholders (COPY-03, COPY-04, D233)", () => {
  it("drops only the sentence whose required value is empty", () => {
    const md =
      "Porudžbine potvrđene do {{dostava.rokSlanja}} šaljemo istog dana. Kurir isporučuje za 1–2 radna dana.";
    expect(fillPlaceholders(md, {})).toBe("Kurir isporučuje za 1–2 radna dana.");
    expect(fillPlaceholders(md, { "dostava.rokSlanja": "14 časova" })).toBe(
      "Porudžbine potvrđene do 14 časova šaljemo istog dana. Kurir isporučuje za 1–2 radna dana.",
    );
  });

  it("keeps list markers, drops lines left empty, and does not split on 12.990 or 1–2", () => {
    const md =
      "1. Pošaljite izjavu. Možete i na {{firma.email}}. Rok je 14 dana.\n- PIB: {{firma.pib}}\nCena 12.990 RSD.";
    expect(fillPlaceholders(md, {})).toBe("1. Pošaljite izjavu. Rok je 14 dana.\nCena 12.990 RSD.");
  });

  it("seeded content never names a missing channel or an unconfirmed cut-off", () => {
    const all = [...PAGES.map((p) => p.bodyMd), ...FAQS.map((f) => f.answerMd)].map((md) =>
      fillPlaceholders(md, {}),
    );
    const text = all.join("\n");
    expect(text).not.toMatch(/14 časova/);
    expect(text).not.toMatch(/stranice Kontakt|stranici Kontakt/);
    expect(text).not.toMatch(/Viber/);
    expect(text).not.toMatch(/\{\{|\}\}/);
  });

  it("the FAQ on returns states the statutory right as the legal page does (COPY-02)", () => {
    const faq = FAQS.find((f) => f.question === "Mogu li da vratim deo?")!;
    expect(faq.answerMd).toMatch(/14 dana od prijema, bez navođenja razloga/);
    expect(faq.answerMd).toMatch(/umanjenje vrednosti/);
    expect(faq.answerMd).not.toMatch(/nije ugrađivan|originalnom pakovanju/);
    expect(faq.answerMd).toMatch(/\(\/reklamacije-i-povrat\)/);
  });
});

describe("a placeholder that is a sentence by itself", () => {
  const md = "{{kontakt.najbrze}} Ako ne znate broj dela, pošaljite broj šasije.";

  it("takes only itself away when it is empty", () => {
    expect(fillPlaceholders(md, { "kontakt.najbrze": "" })).toBe(
      "Ako ne znate broj dela, pošaljite broj šasije.",
    );
  });

  it("stays in front of the next sentence when it has a value", () => {
    expect(fillPlaceholders(md, { "kontakt.najbrze": "Najbrže je da nas pozovete." })).toBe(
      "Najbrže je da nas pozovete. Ako ne znate broj dela, pošaljite broj šasije.",
    );
  });

  it("leaves a placeholder inside a sentence to the sentence rule", () => {
    expect(
      fillPlaceholders("Porudžbine do {{rok}} šaljemo istog dana. Ostale sutradan.", { rok: "" }),
    ).toBe("Ostale sutradan.");
  });
});

describe("settings-driven values", () => {
  it("formats the cut-off and refuses malformed values", () => {
    expect(cutoffLabel("14:00")).toBe("14 časova");
    expect(cutoffLabel("14:30")).toBe("14.30 časova");
    expect(cutoffLabel("")).toBe("");
    expect(cutoffLabel(undefined)).toBe("");
    expect(cutoffLabel("25:00")).toBe("");
  });

  it("builds the fastest-contact sentence only from channels that exist", () => {
    // formatPhone joins the groups with no-break spaces.
    const sentence = (c: { phone: string; viber: string }) =>
      fastestContactSentence(c).replace(/\u00a0/g, " ");
    expect(sentence({ phone: "", viber: "" })).toBe("");
    expect(sentence({ phone: "+381641234567", viber: "" })).toBe(
      "Najbrže je da nas pozovete na +381 64 123 4567.",
    );
    expect(sentence({ phone: "+381641234567", viber: "+381641234567" })).toMatch(
      /pozovete ili pišete na Viber, na \+381 64 123 4567\.$/,
    );
  });
});
