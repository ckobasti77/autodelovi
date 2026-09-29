import { describe, expect, it } from "vitest";

import { paginationRange } from "@/lib/pagination";

describe("paginationRange", () => {
  it.each([
    [1, 1, [1]],
    [1, 2, [1, 2]],
    [1, 5, [1, 2, "gap", 5]],
    [3, 5, [1, 2, 3, 4, 5]],
    [6, 12, [1, "gap", 5, 6, 7, "gap", 12]],
    [4, 12, [1, 2, 3, 4, 5, "gap", 12]],
    [9, 12, [1, "gap", 8, 9, 10, 11, 12]],
    [12, 12, [1, "gap", 11, 12]],
    [99, 12, [1, "gap", 11, 12]],
  ] as const)("page %i of %i", (page, total, expected) => {
    expect(paginationRange(page, total)).toEqual(expected);
  });

  it("returns nothing for an empty result", () => {
    expect(paginationRange(1, 0)).toEqual([]);
  });

  it("never hides a single page behind a gap", () => {
    for (let total = 1; total <= 30; total++) {
      for (let page = 1; page <= total; page++) {
        const tokens = paginationRange(page, total);
        tokens.forEach((token, i) => {
          if (token !== "gap") return;
          const before = tokens[i - 1] as number;
          const after = tokens[i + 1] as number;
          expect(after - before).toBeGreaterThan(2);
        });
      }
    }
  });
});
