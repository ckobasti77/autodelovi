import { describe, expect, test } from "vitest";

import {
  decodeQuickOrderFile,
  parseQuickOrder,
  QUICK_ORDER_MAX_ITEMS,
  quickOrderTextFromCodes,
} from "@/lib/domain/quickOrder";

/** First reading of every item as `CODE×qty`. */
function firsts(text: string): string[] {
  return parseQuickOrder(text).items.map(
    (i) => `${i.candidates[0]!.normalized}×${i.candidates[0]!.quantity}`,
  );
}

function readings(text: string): string[][] {
  return parseQuickOrder(text).items.map((i) =>
    i.candidates.map((c) => `${c.normalized}×${c.quantity}`),
  );
}

describe("parseQuickOrder — quantities", () => {
  test.each([
    ["1K0615301AA 2", "1K0615301AA×2"],
    ["1K0615301AA x2", "1K0615301AA×2"],
    ["1K0615301AA X 3", "1K0615301AA×3"],
    ["1K0615301AA × 4", "1K0615301AA×4"],
    ["1K0615301AA×4", "1K0615301AA×4"],
    ["1K0615301AA 2x", "1K0615301AA×2"],
    ["1K0615301AA 2 kom", "1K0615301AA×2"],
    ["1K0615301AA 2 kom.", "1K0615301AA×2"],
    ["1K0615301AA kom 5", "1K0615301AA×5"],
    ["1K0615301AA kom: 5", "1K0615301AA×5"],
    ["1K0615301AA (2)", "1K0615301AA×2"],
    ["1K0615301AA (2 kom)", "1K0615301AA×2"],
    ["2x 1K0-698-151", "1K0698151×2"],
    ["2 x 1K0 698 151", "1K0698151×2"],
    ["3 kom 1K0698151", "1K0698151×3"],
    ["(2) 1K0698151", "1K0698151×2"],
    ["5Q0 698 151 x4", "5Q0698151×4"],
    ["1K0615301AA;2", "1K0615301AA×2"],
    ["1K0615301AA\t7", "1K0615301AA×7"],
    ["1K0615301AA, 2", "1K0615301AA×2"],
    ["1k0.615.301.aa", "1K0615301AA×1"],
    ["OEM: 1K0 615 301 AA", "1K0615301AA×1"],
    ["- 1K0615301AA 2", "1K0615301AA×2"],
    ["1. 1K0615301AA 2", "1K0615301AA×2"],
  ])("%s → %s", (input, expected) => {
    expect(firsts(input)).toEqual([expected]);
  });

  test("a plain trailing integer yields both readings, quantity first", () => {
    expect(readings("1K0615301AA 2")).toEqual([["1K0615301AA×2", "1K0615301AA2×1"]]);
    expect(readings("1K0 615 301 AA 2")).toEqual([["1K0615301AA×2", "1K0615301AA2×1"]]);
  });

  test("a three-digit tail after spaced groups prefers the code reading", () => {
    expect(readings("03L 115 562")).toEqual([["03L115562×1", "03L115×562"]]);
  });

  test("a zero-led tail stays part of the code first", () => {
    expect(readings("N 910 845 01")).toEqual([["N91084501×1", "N910845×1"]]);
  });

  test("a plain leading integer is a quantity", () => {
    expect(readings("2 1K0615301AA")).toEqual([["1K0615301AA×2", "21K0615301AA×1"]]);
  });

  test("zero and four-digit numbers are not valid quantities", () => {
    expect(firsts("1K0615301AA 0")).toEqual(["1K0615301AA0×1"]);
    expect(firsts("1K0615301AA x1000")[0]).not.toBe("1K0615301AA×1000");
  });
});

/** Every reading as `CODE×qty` plus `!typed` when the typed quantity was out of range. */
function readingsWithErrors(text: string): string[][] {
  return parseQuickOrder(text).items.map((i) =>
    i.candidates.map(
      (c) =>
        `${c.normalized}×${c.quantity}${c.requestedQuantity !== undefined ? `!${c.requestedQuantity}` : ""}`,
    ),
  );
}

describe("parseQuickOrder — quantities out of range (FLOW-22)", () => {
  test("a trailing 0 keeps the code as a second reading with a quantity error", () => {
    expect(readingsWithErrors("5Q0615505R 0")).toEqual([["5Q0615505R0×1", "5Q0615505R×1!0"]]);
  });

  test("a trailing 4–5 digit number keeps the code with a clamped quantity", () => {
    expect(readingsWithErrors("5Q0615505R 1000")).toEqual([
      ["5Q0615505R1000×1", "5Q0615505R×999!1000"],
    ]);
    expect(readingsWithErrors("5Q0 615 505 R 25000")[0]![1]).toBe("5Q0615505R×999!25000");
  });

  test("explicit zero quantities mark the only reading", () => {
    expect(readingsWithErrors("5Q0615505R x0")).toEqual([["5Q0615505R×1!0"]]);
    expect(readingsWithErrors("0x 5Q0615505R")).toEqual([["5Q0615505R×1!0"]]);
    expect(readingsWithErrors("5Q0615505R;Disk;0")).toEqual([["5Q0615505R×1!0"]]);
  });

  test("valid quantities never carry requestedQuantity", () => {
    for (const item of parseQuickOrder("1K0615301AA 2\n5Q0 698 151 x4\n03L 115 562").items) {
      for (const c of item.candidates) expect(c.requestedQuantity).toBeUndefined();
    }
  });
});

describe("parseQuickOrder — lines and cells", () => {
  test("several lines, blank lines and bullets", () => {
    const text = "1K0615301AA 2\n\n• 5Q0698151 x4\r\n2x 1K0-698-151\n";
    expect(firsts(text)).toEqual(["1K0615301AA×2", "5Q0698151×4", "1K0698151×2"]);
    expect(parseQuickOrder(text).items.map((i) => i.lineNo)).toEqual([1, 3, 4]);
  });

  test("several full codes on one line become separate items", () => {
    const parsed = parseQuickOrder("1K0615301AA 5Q0698151");
    expect(parsed.items.map((i) => i.key)).toEqual(["1.1", "1.2"]);
    expect(firsts("1K0615301AA 5Q0698151")).toEqual(["1K0615301AA×1", "5Q0698151×1"]);
  });

  test("comma list with quantities", () => {
    expect(firsts("1K0615301AA 2, 5Q0698151 x4")).toEqual(["1K0615301AA×2", "5Q0698151×4"]);
  });

  test("CSV rows: header ignored, description and price skipped, quantity column read", () => {
    const csv = [
      "OEM;Naziv;Količina;Cena",
      '"1K0615301AA";"Disk prednji";"2";"12.990,00"',
      "5Q0698151;Pločice Golf 7;4;6.490,00",
      "Golf 7 disk;1K0698151;1",
    ].join("\n");
    const parsed = parseQuickOrder(csv);
    expect(firsts(csv)).toEqual(["1K0615301AA×2", "5Q0698151×4", "1K0698151×1"]);
    expect(parsed.ignored).toBe(1);
    expect(parsed.rejected).toEqual([]);
  });

  test("typos with digits are rejected, plain text is ignored", () => {
    const parsed = parseQuickOrder("1K0615301AA\n12\nhvala, Marko\nAB1");
    expect(parsed.items).toHaveLength(1);
    expect(parsed.rejected.map((r) => r.lineNo)).toEqual([2, 4]);
    expect(parsed.ignored).toBe(1);
  });

  test("caps the number of items", () => {
    const text = Array.from(
      { length: QUICK_ORDER_MAX_ITEMS + 5 },
      (_, i) => `1K0615${String(i).padStart(3, "0")}AA 1`,
    ).join("\n");
    const parsed = parseQuickOrder(text);
    expect(parsed.items).toHaveLength(QUICK_ORDER_MAX_ITEMS);
    expect(parsed.truncated).toBe(true);
  });

  test("keeps the typed code for display", () => {
    const [item] = parseQuickOrder("5Q0 698 151 x4").items;
    expect(item!.candidates[0]!.code).toBe("5Q0 698 151");
    expect(item!.raw).toBe("5Q0 698 151 x4");
  });
});

describe("helpers", () => {
  test("text from `?kodovi=`", () => {
    expect(quickOrderTextFromCodes(["1K0615301AA", " ", "5Q0698151"])).toBe(
      "1K0615301AA\n5Q0698151",
    );
  });

  test("decodes UTF-8 with BOM and falls back to Windows-1250", () => {
    const utf8 = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Količina;Šifra")]);
    expect(decodeQuickOrderFile(utf8.buffer)).toBe("Količina;Šifra");
    // „Količina“ in Windows-1250: č = 0xE8.
    const cp1250 = new Uint8Array([0x4b, 0x6f, 0x6c, 0x69, 0xe8, 0x69, 0x6e, 0x61]);
    expect(decodeQuickOrderFile(cp1250.buffer)).toBe("Količina");
  });
});
