import { describe, expect, it } from "vitest";

import {
  isPlausibleOem,
  looksLikeOemList,
  normalizeCode,
  normalizeOem,
  parsePastedOemList,
  parsePastedOemListDetailed,
} from "@/lib/domain/codes";

describe("normalizeOem", () => {
  it.each([
    ["1K0 615 301 AA", "1K0615301AA"],
    ["1k0-615-301-aa", "1K0615301AA"],
    ["06A.906.461.L", "06A906461L"],
    ["5Q0/615/301 F", "5Q0615301F"],
    ["  03l\u00a0115\u00a0562  ", "03L115562"],
    ["1K0\u2013615\u2014301\u2212AA", "1K0615301AA"],
    ["1K0\u2010615\u2011301\u2012AA", "1K0615301AA"],
    ["N_910_845_01", "N91084501"],
    ["5Q0\\615\\301", "5Q0615301"],
    ["\u200b1K0615301AA\ufeff", "1K0615301AA"],
  ])("%j → %s", (input, expected) => {
    expect(normalizeOem(input)).toBe(expected);
  });

  it("is exported under the search alias too", () => {
    expect(normalizeCode("1k0 615 301 aa")).toBe("1K0615301AA");
  });
});

describe("isPlausibleOem", () => {
  it.each([
    ["1K0615301AA", true],
    ["N91084501", true],
    ["12345", true],
    ["A1B2C3D4E5F6G7H8J9K0L1M2N", true],
    ["1234", false],
    ["ABCDEFG", false],
    ["1K0-615", false],
    ["A1B2C3D4E5F6G7H8J9K0L1M2N3", false],
    ["", false],
  ])("%j → %s", (value, expected) => {
    expect(isPlausibleOem(value)).toBe(expected);
  });
});

describe("parsePastedOemList", () => {
  it("splits on newlines, commas, semicolons, tabs and pipes", () => {
    expect(
      parsePastedOemList("1K0615301AA\n5Q0615301F, 03L115562;06A906461L\tN91084501|8E0615301"),
    ).toEqual(["1K0615301AA", "5Q0615301F", "03L115562", "06A906461L", "N91084501", "8E0615301"]);
  });

  it("keeps spaced groups of one code together", () => {
    expect(parsePastedOemList("1K0 615 301 AA\n03L 115 562\nN 910 845 01")).toEqual([
      "1K0615301AA",
      "03L115562",
      "N91084501",
    ]);
  });

  it("splits space-separated full codes on one line", () => {
    expect(parsePastedOemList("1K0615301AA 5Q0615301F")).toEqual(["1K0615301AA", "5Q0615301F"]);
    expect(parsePastedOemList("1K0-615-301-AA   5Q0.615.301.F")).toEqual([
      "1K0615301AA",
      "5Q0615301F",
    ]);
  });

  it.each([
    ["1K0615301AA x2"],
    ["1K0615301AA x 2"],
    ["1K0615301AA ×3"],
    ["1K0615301AA × 3"],
    ["1K0615301AA 2x"],
    ["1K0615301AA 2 kom"],
    ["1K0615301AA 2 kom."],
    ["1K0615301AA kom 2"],
    ["1K0615301AA kom: 2"],
    ["1K0615301AA (2)"],
    ["1K0615301AA (2 kom)"],
    ["2x 1K0615301AA"],
    ["2 x 1K0615301AA"],
    ["2× 1K0615301AA"],
    ["2 kom 1K0615301AA"],
    ["(2) 1K0615301AA"],
    ["1K0 615 301 AA x2"],
    ["1K0615301AA - 2 kom"],
  ])("strips the quantity in %j", (line) => {
    expect(parsePastedOemList(line)).toEqual(["1K0615301AA"]);
  });

  it.each([
    ["1. 1K0615301AA"],
    ["1) 1K0615301AA"],
    ["12. 1K0 615 301 AA"],
    ["- 1K0615301AA"],
    ["• 1K0615301AA"],
    ["* 1K0615301AA"],
    ["OEM: 1K0615301AA"],
    ["Br. dela: 1K0 615 301 AA"],
  ])("strips list prefixes and labels in %j", (line) => {
    expect(parsePastedOemList(line)).toEqual(["1K0615301AA"]);
  });

  it("does not mistake a dotted code for numbering", () => {
    expect(parsePastedOemList("059.130.755.AB")).toEqual(["059130755AB"]);
  });

  it("de-duplicates by normalised form in first-seen order", () => {
    expect(parsePastedOemList("5Q0615301F\n1K0 615 301 AA\n1k0-615-301-aa\n5Q0615301F x2")).toEqual(
      ["5Q0615301F", "1K0615301AA"],
    );
  });

  it("parses a realistic WhatsApp message", () => {
    const message = [
      "Pozdrav, treba mi:",
      "1. 1K0 615 301 AA x2",
      "2. 1K0 698 151 A (2 kom)",
      "3. 03L115562",
      "Hvala!",
    ].join("\n");
    expect(parsePastedOemListDetailed(message)).toEqual({
      codes: [
        { raw: "1K0 615 301 AA", normalized: "1K0615301AA" },
        { raw: "1K0 698 151 A", normalized: "1K0698151A" },
        { raw: "03L115562", normalized: "03L115562" },
      ],
      rejected: ["Pozdrav", "treba mi:", "Hvala!"],
    });
  });

  it("parses an Excel column paste with Windows line endings", () => {
    expect(parsePastedOemList("OEM\r\n1K0615301AA\r\n5Q0615301F\r\n")).toEqual([
      "1K0615301AA",
      "5Q0615301F",
    ]);
  });

  it("returns nothing for empty or code-free text", () => {
    expect(parsePastedOemList("")).toEqual([]);
    expect(parsePastedOemListDetailed("  \n , ; ")).toEqual({ codes: [], rejected: [] });
    expect(parsePastedOemListDetailed("Imate li diskove?")).toEqual({
      codes: [],
      rejected: ["Imate li diskove?"],
    });
  });
});

describe("looksLikeOemList", () => {
  it.each([
    ["1K0615301AA\n5Q0615301F", true],
    ["1K0615301AA 5Q0615301F", true],
    ["1K0615301AA, 1K0 615 301 AA", false],
    ["1K0 615 301 AA", false],
    ["kočioni diskovi golf 7", false],
  ])("%j → %s", (text, expected) => {
    expect(looksLikeOemList(text)).toBe(expected);
  });
});
