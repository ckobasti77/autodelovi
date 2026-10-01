import { describe, expect, it } from "vitest";

import {
  CELLS,
  IMAGES,
  ROWS,
  countImport,
  productsNotRestored,
  productsToDeactivate,
  productsWritten,
  rowsWithWarning,
} from "@/lib/i18n/sr/import";

// QA FLOW-24: Serbian plural forms and verb agreement in the import wizard copy.
// The count and the noun are joined by a no-break space.
const nb = (s: string) => s.replace(/(\d) /, "$1 ");

describe("import copy plurals", () => {
  it("rows, cells and images", () => {
    expect(countImport(1, ROWS)).toBe(nb("1 red"));
    expect(countImport(3, ROWS)).toBe(nb("3 reda"));
    expect(countImport(11, ROWS)).toBe(nb("11 redova"));
    expect(countImport(21, ROWS)).toBe(nb("21 red"));
    expect(countImport(1250, ROWS)).toBe(nb("1.250 redova"));
    expect(countImport(3, CELLS)).toBe(nb("3 ćelije"));
    expect(countImport(5, CELLS)).toBe(nb("5 ćelija"));
    expect(countImport(2, IMAGES)).toBe(nb("2 slike"));
  });

  it("phrases agree with the count", () => {
    expect(rowsWithWarning(1)).toBe(nb("1 red sa upozorenjem"));
    expect(productsWritten(1)).toBe(nb("1 artikal se upisuje"));
    expect(productsWritten(2)).toBe(nb("2 artikla se upisuju"));
    expect(productsWritten(490)).toBe(nb("490 artikala se upisuje"));
    expect(productsToDeactivate(1)).toBe(nb("Biće deaktiviran 1 artikal"));
    expect(productsToDeactivate(3)).toBe(nb("Biće deaktivirana 3 artikla"));
    expect(productsToDeactivate(12)).toBe(nb("Biće deaktivirano 12 artikala"));
    expect(productsNotRestored(1)).toBe(nb("1 artikal nije vraćen"));
    expect(productsNotRestored(2)).toBe(nb("2 artikla nisu vraćena"));
    expect(productsNotRestored(5)).toBe(nb("5 artikala nije vraćeno"));
  });
});
