import { describe, expect, test } from "vitest";

import { PART_NOTES } from "@/lib/catalog/partNotes";
import { CATEGORIES, STAGES } from "@/lib/catalog/taxonomy";
import { STAGE_SENTENCE, STAGE_SHORT } from "@/lib/i18n/sr/hero";

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

  test("every stage has a short label and a caption sentence", () => {
    for (const s of STAGES) {
      expect(STAGE_SHORT[s.key], s.key).toBeTruthy();
      expect(STAGE_SENTENCE[s.key], s.key).toBeTruthy();
      expect(STAGE_SENTENCE[s.key]).not.toMatch(EKAVIAN_TRAPS);
    }
  });
});
