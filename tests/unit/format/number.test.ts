import { describe, expect, it } from "vitest";

import { formatNumber, formatPercent, formatQuantity, formatSigned } from "@/lib/format/number";

const NBSP = "\u00a0";
const MINUS = "\u2212";

/** What the module produced while it used Intl (ICU), as the reference for the pure version. */
function viaIntl(value: number, min: number, max: number): string {
  const magnitude = new Intl.NumberFormat("sr-Latn-RS", {
    useGrouping: "always",
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(Math.abs(value));
  return value < 0 && !/^[0.,]*$/.test(magnitude) ? `${MINUS}${magnitude}` : magnitude;
}

describe("formatSigned without Intl matches Intl.NumberFormat sr-Latn-RS (PERF-01)", () => {
  const DIGITS: [number, number][] = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
    [2, 2],
    [0, 3],
    [3, 3],
    [0, 20],
  ];
  const EDGES = [
    0,
    -0,
    1,
    9,
    10,
    999,
    1000,
    4290,
    12990,
    99999.5,
    999.995,
    1.005,
    1.255,
    2.675,
    0.615,
    0.125,
    0.135,
    8.345,
    1.45,
    1.55,
    2.5,
    0.5,
    0.05,
    0.005,
    0.0049,
    1 / 3,
    2 / 3,
    0.1 + 0.2,
    1e-7,
    1.5e-7,
    0.000001,
    1234567.891,
    9999999.999,
    123456789012345680000,
    1e21,
    1.5e21,
    -1250.456,
    -0.001,
    -0.004,
    -0.005,
    Number.MAX_SAFE_INTEGER,
  ];

  it.each(DIGITS)("edge values with %i\u2013%i decimals", (min, max) => {
    for (const value of EDGES) expect(formatSigned(value, min, max)).toBe(viaIntl(value, min, max));
  });

  it("a seeded spread of 20 000 values", () => {
    let seed = 22;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 20000; i++) {
      const scale = 10 ** Math.floor(random() * 16 - 6);
      const value = (random() - 0.2) * scale;
      const rounded = i % 3 === 0 ? Math.round(value * 1000) / 1000 : value;
      const [min, max] = DIGITS[i % DIGITS.length];
      expect(formatSigned(rounded, min, max)).toBe(viaIntl(rounded, min, max));
    }
  });
});

describe("formatNumber", () => {
  it.each<[number, { decimals?: number } | undefined, string]>([
    [1250, undefined, "1.250"],
    [999, undefined, "999"],
    [1234567, undefined, "1.234.567"],
    [1250.5, undefined, "1.250,5"],
    [1250.456, undefined, "1.250,46"],
    [1250, { decimals: 2 }, "1.250,00"],
    [0.1 + 0.2, { decimals: 1 }, "0,3"],
    [1250.6, { decimals: 0 }, "1.251"],
    [-1250, undefined, `${MINUS}1.250`],
    [-0.001, { decimals: 2 }, "0,00"],
    [0, undefined, "0"],
  ])("%d %j → %s", (value, opts, expected) => {
    expect(formatNumber(value, opts)).toBe(expected);
  });

  it("throws for non-finite input", () => {
    expect(() => formatNumber(Number.NaN)).toThrow(RangeError);
    expect(() => formatNumber(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("formatPercent", () => {
  it.each<[number, { decimals?: number } | undefined, string]>([
    [0.15, undefined, `15${NBSP}%`],
    [0.2, undefined, `20${NBSP}%`],
    [0.155, undefined, `15,5${NBSP}%`],
    [1, undefined, `100${NBSP}%`],
    [0.12345, { decimals: 2 }, `12,35${NBSP}%`],
    [0.07, { decimals: 0 }, `7${NBSP}%`],
    [-0.05, undefined, `${MINUS}5${NBSP}%`],
  ])("%d %j → %j", (ratio, opts, expected) => {
    expect(formatPercent(ratio, opts)).toBe(expected);
  });
});

describe("formatQuantity", () => {
  it.each([
    [4, `4${NBSP}kom.`],
    [1, `1${NBSP}kom.`],
    [1250, `1.250${NBSP}kom.`],
  ])("%i → %j", (count, expected) => {
    expect(formatQuantity(count)).toBe(expected);
  });
});
