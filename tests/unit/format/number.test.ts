import { describe, expect, it } from "vitest";

import { formatNumber, formatPercent, formatQuantity } from "@/lib/format/number";

const NBSP = "\u00a0";
const MINUS = "\u2212";

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
