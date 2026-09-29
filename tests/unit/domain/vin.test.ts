import { describe, expect, it } from "vitest";

import {
  computeVinCheckDigit,
  decodeModelYear,
  decodeVin,
  decodeWmi,
  modelYearCandidates,
  normalizeVin,
  vagModelCode,
  vagModelCodes,
  vagModelHint,
  validateVin,
} from "@/lib/domain/vin";

const GOLF_V = "WVWZZZ1KZ8W000001";
const NOW = new Date("2026-09-29T10:00:00Z");

/** A syntactically valid European VW VIN with the given position-10 character. */
const vinWithYear = (code: string) => `WVWZZZ1KZ${code}W000001`;

describe("normalizeVin", () => {
  it.each([
    ["wvwzzz1kz8w000001", GOLF_V],
    ["WVW ZZZ 1KZ 8W0 000 01", GOLF_V],
    ["WVW-ZZZ-1KZ-8W0.000.01", GOLF_V],
    [" WVW\u00a0ZZZ1KZ8W000001 ", GOLF_V],
  ])("%j → %s", (input, expected) => {
    expect(normalizeVin(input)).toBe(expected);
  });
});

describe("validateVin", () => {
  it("accepts a European VAG VIN whose position 9 is not a check digit", () => {
    const result = validateVin("wvw zzz 1kz 8w0 000 01");
    expect(result).toEqual({
      valid: true,
      normalized: GOLF_V,
      errors: [],
      invalidChars: [],
      checkDigit: { applicable: false, valid: false },
    });
  });

  it.each([
    ["1M8GDM9AXKP042788", true],
    ["1HGCM82633A004352", true],
    ["11111111111111111", true],
    ["1M8GDM9A1KP042788", false],
  ])("computes the North-American check digit for %s (valid: %s)", (vin, checkValid) => {
    const result = validateVin(vin);
    expect(result.valid).toBe(true);
    expect(result.checkDigit).toEqual({ applicable: true, valid: checkValid });
  });

  it.each([
    ["1M8GDM9AXKP042788", "X"],
    ["1HGCM82633A004352", "3"],
    ["11111111111111111", "1"],
    ["123", null],
  ])("computeVinCheckDigit(%s) → %s", (vin, expected) => {
    expect(computeVinCheckDigit(vin)).toBe(expected);
  });

  it("reports an empty VIN", () => {
    expect(validateVin("  ")).toEqual({
      valid: false,
      normalized: "",
      errors: ["empty"],
      invalidChars: [],
      checkDigit: { applicable: false, valid: null },
    });
  });

  it("reports a wrong length", () => {
    const result = validateVin("WVWZZZ1KZ8W00000");
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["length"]);
    expect(result.checkDigit.valid).toBeNull();
  });

  it("reports forbidden characters and suggests the digit the owner meant", () => {
    const result = validateVin("WVWZZZ1KZ8WOQ0001");
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["chars"]);
    expect(result.invalidChars).toEqual(["O", "Q"]);
    expect(result.suggestion).toBe(GOLF_V);
  });

  it("maps I to 1 in the suggestion", () => {
    expect(validateVin("WVWZZZ1KZ8W00001I").suggestion).toBe("WVWZZZ1KZ8W000011");
  });

  it("gives no suggestion when swapping I/O/Q would still be invalid", () => {
    const result = validateVin("WVWZZZ1KZ8WOOO1");
    expect(result.errors).toEqual(["length", "chars"]);
    expect(result.suggestion).toBeUndefined();
    expect(validateVin("WVWZZZ1KZ8W0000*O").suggestion).toBeUndefined();
  });

  it("lists other invalid characters once each", () => {
    expect(validateVin("WVWZZZ1KZ8W00*#*1").invalidChars).toEqual(["*", "#"]);
  });
});

describe("decodeWmi", () => {
  it.each([
    ["WVWZZZ1KZ8W000001", "Volkswagen"],
    ["WVGZZZ5NZAW000001", "Volkswagen"],
    ["WV1ZZZ7HZ8H000001", "Volkswagen"],
    ["WV2ZZZ7HZ8H000001", "Volkswagen"],
    ["WV3ZZZ2EZ8H000001", "Volkswagen"],
    ["WAUZZZ8K9BA012345", "Audi"],
    ["WA1ZZZ4M0JD012345", "Audi"],
    ["WUAZZZ8V7GA012345", "Audi"],
    ["TRUZZZ8J981012345", "Audi"],
    ["TMBBS21Z982012345", "Škoda"],
    ["TMP", "Škoda"],
    ["VSSZZZ5FZER123456", "SEAT"],
    ["1VWBP7A3XCC012345", "Volkswagen"],
    ["3VWDX7AJ5DM123456", "Volkswagen"],
    ["9BWAA05W0AP000001", "Volkswagen"],
    ["AAVZZZ6RZCU000001", "Volkswagen"],
    ["LSVAA2180E2000001", "Volkswagen"],
    ["LFV2A21K0A3000001", "Volkswagen"],
    ["XW8ZZZ61ZDG000001", "Volkswagen"],
    ["WP0ZZZ99ZTS392124", "Porsche"],
    ["WP1ZZZ9PZ8LA00001", "Porsche"],
  ])("%s → %s (VAG)", (vin, make) => {
    const info = decodeWmi(vin);
    expect(info.make).toBe(make);
    expect(info.isVag).toBe(true);
    expect(info.wmi).toBe(normalizeVin(vin).slice(0, 3));
    expect(info.manufacturer).toBeTruthy();
  });

  it.each(["VF1BB0A0512345678", "WBA3A5C50CF256651", "JTDKB20U093000001", "", "WV"])(
    "%j is not a VAG vehicle",
    (vin) => {
      expect(decodeWmi(vin)).toMatchObject({ manufacturer: null, make: null, isVag: false });
    },
  );

  it("adds a short Serbian note where the WMI is ambiguous or non-European", () => {
    expect(decodeWmi("VSSZZZ5FZER123456").note).toContain("Cupra");
    expect(decodeWmi("3VWDX7AJ5DM123456").note).toContain("vanevropskog");
    expect(decodeWmi(GOLF_V).note).toBeUndefined();
  });
});

describe("model year (position 10)", () => {
  it.each([
    ["F", [1985, 2015]],
    ["A", [1980, 2010]],
    ["Y", [2000, 2030]],
    ["1", [2001, 2031]],
    ["9", [2009, 2039]],
    ["0", []],
    ["Z", []],
    ["U", []],
  ])("candidates for %s → %j", (code, expected) => {
    expect(modelYearCandidates(vinWithYear(code))).toEqual(expected);
  });

  it.each([
    ["8", 2008],
    ["F", 2015],
    ["A", 2010],
    ["T", 2026],
    ["V", 2027],
    ["W", 1998],
    ["Y", 2000],
    ["1", 2001],
    ["0", null],
    ["Z", null],
    ["Q", null],
  ])("decodes %s as %s in 2026", (code, year) => {
    expect(decodeModelYear(vinWithYear(code), { now: NOW })).toBe(year);
  });

  it("moves to the next cycle as time passes", () => {
    expect(decodeModelYear(vinWithYear("1"), { now: new Date("2031-03-01T00:00:00Z") })).toBe(2031);
    expect(decodeModelYear(vinWithYear("Y"), { now: new Date("2029-06-01T00:00:00Z") })).toBe(2030);
  });

  it("returns nothing for a VIN shorter than 10 characters", () => {
    expect(modelYearCandidates("WVWZZZ1KZ")).toEqual([]);
    expect(decodeModelYear("WVWZZZ1KZ", { now: NOW })).toBeNull();
  });
});

describe("VAG model code (positions 7–8)", () => {
  it.each([
    [GOLF_V, "1K"],
    ["WVWZZZAUZFW123456", "AU"],
    ["WAUZZZ8K9BA012345", "8K"],
    ["VSSZZZ5FZER123456", "5F"],
    ["TMBBS21Z982012345", "1Z"],
    ["TMBJJ7NE5F0123456", "NE"],
    ["WP0ZZZ99ZTS392124", "99"],
    ["3VWDX7AJ5DM123456", null],
    ["VF1ZZZ1KZ8W000001", null],
    ["WVWZZZ1", null],
    ["WVWAAA1KZ8W000001", null],
  ])("%s → %s", (vin, expected) => {
    expect(vagModelCode(vin)).toBe(expected);
  });

  it.each([
    ["WVWZZZAUZFW123456", { code: "AU", make: "Volkswagen", model: "Golf VII" }],
    ["WVWZZZ3CZ9E012345", { code: "3C", make: "Volkswagen", model: "Passat B6 / B7" }],
    ["WAUZZZ4G9CN012345", { code: "4G", make: "Audi", model: "A6 C7" }],
    ["TMBBS21Z982012345", { code: "1Z", make: "Škoda", model: "Octavia II" }],
    ["VSSZZZKLZMR123456", { code: "KL", make: "SEAT", model: "Leon IV (SEAT / Cupra)" }],
  ])("hints %s", (vin, hint) => {
    expect(vagModelHint(vin)).toEqual(hint);
  });

  it("does not hint a model from another brand", () => {
    expect(vagModelCode("WAUZZZ1KZ8W000001")).toBe("1K");
    expect(vagModelHint("WAUZZZ1KZ8W000001")).toBeNull();
  });

  it("does not hint unknown codes", () => {
    expect(vagModelHint("WP0ZZZ99ZTS392124")).toBeNull();
  });

  it("keeps the code table to two-character keys of known brands", () => {
    for (const [code, entry] of Object.entries(vagModelCodes)) {
      expect(code).toMatch(/^[A-Z0-9]{2}$/);
      expect(["Volkswagen", "Audi", "Škoda", "SEAT", "Cupra", "Porsche"]).toContain(entry.make);
    }
  });
});

describe("decodeVin", () => {
  it("combines validation, WMI, model year and model hint", () => {
    expect(decodeVin("wvw zzz 1kz 8w0 000 01", { now: NOW })).toEqual({
      normalized: GOLF_V,
      validation: validateVin(GOLF_V),
      wmi: {
        wmi: "WVW",
        manufacturer: "Volkswagen, putnička vozila (Nemačka)",
        make: "Volkswagen",
        isVag: true,
      },
      modelYear: 2008,
      modelYearCandidates: [2008, 2038],
      modelCode: "1K",
      model: { code: "1K", make: "Volkswagen", model: "Golf V / Golf VI, Jetta" },
    });
  });

  it("degrades gracefully for garbage", () => {
    const decoded = decodeVin("nije vin");
    expect(decoded.validation.valid).toBe(false);
    expect(decoded.wmi.isVag).toBe(false);
    expect(decoded.modelCode).toBeNull();
    expect(decoded.model).toBeNull();
  });
});
