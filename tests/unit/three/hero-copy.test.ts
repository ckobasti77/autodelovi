import { describe, expect, test } from "vitest";

import { PART_NOTES } from "@/lib/catalog/partNotes";
import { CATEGORIES, SYSTEMS } from "@/lib/catalog/taxonomy";
import { HERO_COPY, SLOT_LABEL_SHORT, SYSTEM_SHORT } from "@/lib/i18n/sr/hero";

const EKAVIAN_TRAPS = /\b(dio|dijel|cijen|uvjet|rješen|vrijem|mjest|primjer)/i;

describe("3D hero copy", () => {
  test("every category has one mechanic's note (callout, parts list)", () => {
    for (const c of CATEGORIES) {
      const note = PART_NOTES[c.slug];
      expect(note, c.slug).toBeTruthy();
      expect(note.length).toBeLessThanOrEqual(90);
      expect(note.endsWith(".")).toBe(true);
      expect(note).not.toMatch(EKAVIAN_TRAPS);
      expect(note).not.toContain("!");
    }
    expect(Object.keys(PART_NOTES).sort()).toEqual(CATEGORIES.map((c) => c.slug).sort());
  });

  test("every system has a short chip name that starts its full name", () => {
    for (const system of SYSTEMS) {
      const short = SYSTEM_SHORT[system.slug];
      expect(short, system.slug).toBeTruthy();
      // „Izduv“ for „Izduvni sistem“, „Vešanje“ for „Vešanje i upravljanje“ …
      expect(system.labelSr.startsWith(short), system.slug).toBe(true);
    }
  });

  test("a short slot name is the start of the category's full name (WCAG 2.5.3)", () => {
    for (const [slug, short] of Object.entries(SLOT_LABEL_SHORT)) {
      const category = CATEGORIES.find((c) => c.slug === slug);
      expect(category, slug).toBeDefined();
      expect(category!.labelSr.startsWith(short), slug).toBe(true);
      expect(short.length).toBeLessThan(category!.labelSr.length);
    }
  });

  test("the hero's own sentences keep the voice: ekavian, no exclamation marks", () => {
    const values: unknown[] = Object.values(HERO_COPY);
    const strings = values.filter((v): v is string => typeof v === "string");
    for (const s of strings) {
      expect(s).not.toMatch(EKAVIAN_TRAPS);
      expect(s).not.toContain("!");
    }
    expect(HERO_COPY.introCounts(10, 44)).toBe("10 sistema · 44 kategorije");
    expect(HERO_COPY.pageAnnounce(["Kočnice", "Točkovi"], 5)).toBe("Kočnice, Točkovi — 5 kategorija");
    expect(HERO_COPY.chipName("Točkovi", 1, HERO_COPY.chipShown)).toBe("Točkovi, 1 kategorija, prikazano");
    expect(HERO_COPY.chipName("Kočnice", 4, "")).toBe("Kočnice, 4 kategorije");
  });
});
