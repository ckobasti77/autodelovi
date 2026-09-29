import { describe, expect, it } from "vitest";

import { countSr, pluralSr } from "@/lib/format/plural";

const BROJ = ["broj", "broja", "brojeva"] as const;

describe("pluralSr", () => {
  it.each([
    [1, "broj"],
    [2, "broja"],
    [4, "broja"],
    [5, "brojeva"],
    [11, "brojeva"],
    [12, "brojeva"],
    [14, "brojeva"],
    [21, "broj"],
    [22, "broja"],
    [25, "brojeva"],
    [101, "broj"],
    [111, "brojeva"],
    [0, "brojeva"],
  ])("%i → %s", (n, expected) => {
    expect(pluralSr(n, BROJ)).toBe(expected);
  });

  it("countSr joins with a no-break space", () => {
    expect(countSr(3, ["artikal", "artikla", "artikala"])).toBe("3 artikla");
  });
});
