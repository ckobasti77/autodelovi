import { describe, expect, it } from "vitest";

import { dinarsToPara, formatRSD, formatRSDParts, paraToDinars } from "@/lib/format/money";

const NBSP = "\u00a0";
const MINUS = "\u2212";

describe("formatRSD", () => {
  it.each([
    [1299000, `12.990${NBSP}RSD`],
    [1299050, `12.990,50${NBSP}RSD`],
    [1299005, `12.990,05${NBSP}RSD`],
    [429000, `4.290${NBSP}RSD`],
    [99900, `999${NBSP}RSD`],
    [0, `0${NBSP}RSD`],
    [1, `0,01${NBSP}RSD`],
    [150, `1,50${NBSP}RSD`],
    [123456789, `1.234.567,89${NBSP}RSD`],
    [100000000, `1.000.000${NBSP}RSD`],
  ])("%i para → %s", (para, expected) => {
    expect(formatRSD(para)).toBe(expected);
  });

  it("uses the real minus sign for negative amounts", () => {
    expect(formatRSD(-150000)).toBe(`${MINUS}1.500${NBSP}RSD`);
    expect(formatRSD(-1299050)).toBe(`${MINUS}12.990,50${NBSP}RSD`);
  });

  it("rounds fractional para and never prints a negative zero", () => {
    expect(formatRSD(1299049.6)).toBe(`12.990,50${NBSP}RSD`);
    expect(formatRSD(-0.4)).toBe(`0${NBSP}RSD`);
  });

  it("omits the unit when asked", () => {
    expect(formatRSD(1299000, { unit: false })).toBe("12.990");
    expect(formatRSD(1299050, { unit: false })).toBe("12.990,50");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "throws a RangeError for %s",
    (value) => {
      expect(() => formatRSD(value)).toThrow(RangeError);
    },
  );
});

describe("formatRSDParts", () => {
  it("splits value and unit", () => {
    expect(formatRSDParts(1299000)).toEqual({ value: "12.990", unit: "RSD" });
    expect(formatRSDParts(1299050)).toEqual({ value: "12.990,50", unit: "RSD" });
    expect(formatRSDParts(-50000)).toEqual({ value: `${MINUS}500`, unit: "RSD" });
  });
});

describe("paraToDinars", () => {
  it.each([
    [1299050, 12990.5],
    [1299000, 12990],
    [1, 0.01],
    [-150, -1.5],
  ])("%i → %d", (para, dinars) => {
    expect(paraToDinars(para)).toBe(dinars);
  });
});

describe("dinarsToPara", () => {
  it.each<[number | string, number]>([
    [12990, 1299000],
    [12990.5, 1299050],
    [0.29, 29],
    [1.005, 101],
    [-12.5, -1250],
    ["12.990,50", 1299050],
    ["12990.50", 1299050],
    ["12990,5", 1299050],
    ["12 990", 1299000],
    [`12${NBSP}990,00`, 1299000],
    ["12.990", 1299000],
    ["1.234.567", 123456700],
    ["1,234.56", 123456],
    ["12,99", 1299],
    ["12.99", 1299],
    ["0.125", 13],
    ["12.990 RSD", 1299000],
    ["12.990 din.", 1299000],
    ["-150", -15000],
    [`${MINUS}150,50`, -15050],
    ["  4290  ", 429000],
    [",50", 50],
  ])("%s → %i para", (input, para) => {
    expect(dinarsToPara(input)).toBe(para);
  });

  it.each(["", "   ", "abc", "12.99.1", "1.2345.678", "12,990.50,1", "RSD"])(
    "rejects %j",
    (input) => {
      expect(() => dinarsToPara(input)).toThrow(RangeError);
    },
  );

  it("rejects non-finite numbers", () => {
    expect(() => dinarsToPara(Number.NaN)).toThrow(RangeError);
  });
});
