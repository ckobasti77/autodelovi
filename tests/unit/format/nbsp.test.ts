import { describe, expect, it } from "vitest";

import { nbspShortWords, nbspUnits, noDashAtLineStart, typographer } from "@/lib/format/nbsp";

const NBSP = "\u00a0";

describe("nbspUnits", () => {
  it.each([
    ["Cena 12.990 RSD", `Cena 12.990${NBSP}RSD`],
    ["Na stanju 4 kom.", `Na stanju 4${NBSP}kom.`],
    ["Disk 288 mm", `Disk 288${NBSP}mm`],
    ["Dužina 45 cm", `Dužina 45${NBSP}cm`],
    ["Masa 6,4 kg", `Masa 6,4${NBSP}kg`],
    ["Snaga 110 kW / 150 KS", `Snaga 110${NBSP}kW / 150${NBSP}KS`],
    ["Popust 15 %", `Popust 15${NBSP}%`],
    ["Isporuka za 2 dana", `Isporuka za 2${NBSP}dana`],
    ["Oko 500 din.", `Oko 500${NBSP}din.`],
  ])("%j", (input, expected) => {
    expect(nbspUnits(input)).toBe(expected);
  });

  it("leaves words that merely start with a unit alone", () => {
    expect(nbspUnits("Stiže 2 danas")).toBe("Stiže 2 danas");
    expect(nbspUnits("Ima 3 komada")).toBe("Ima 3 komada");
  });

  it("does not bind across a line break", () => {
    expect(nbspUnits("12.990\nRSD")).toBe("12.990\nRSD");
  });
});

describe("nbspShortWords", () => {
  it.each([
    ["Filteri i ulja", `Filteri i${NBSP}ulja`],
    ["Delovi u Beogradu", `Delovi u${NBSP}Beogradu`],
    ["Rad s kupcima", `Rad s${NBSP}kupcima`],
    ["Put k servisu", `Put k${NBSP}servisu`],
    ["Reč o kvalitetu", `Reč o${NBSP}kvalitetu`],
    ["Brzo, a tačno", `Brzo, a${NBSP}tačno`],
    ["U ponudi i u radnji", `U${NBSP}ponudi i${NBSP}u${NBSP}radnji`],
    ["A onda I kraj", `A${NBSP}onda I${NBSP}kraj`],
  ])("%j", (input, expected) => {
    expect(nbspShortWords(input)).toBe(expected);
  });

  it("ignores letters that are part of a longer word or code", () => {
    expect(nbspShortWords("Golf 1K0 s-line")).toBe("Golf 1K0 s-line");
    expect(nbspShortWords("Audi A4 B8")).toBe("Audi A4 B8");
    expect(nbspShortWords("Kraj reči a")).toBe("Kraj reči a");
  });
});

describe("noDashAtLineStart", () => {
  it.each([
    ["Delovi — odmah", `Delovi${NBSP}— odmah`],
    ["Pon – pet", `Pon${NBSP}– pet`],
    ["Kraj —", `Kraj${NBSP}—`],
  ])("%j", (input, expected) => {
    expect(noDashAtLineStart(input)).toBe(expected);
  });

  it("leaves hyphenated words and ranges without spaces alone", () => {
    expect(noDashAtLineStart("Pon–pet 8–17, e-mail")).toBe("Pon–pet 8–17, e-mail");
  });
});

describe("typographer", () => {
  it("applies every rule", () => {
    expect(typographer("Disk i pločice — 12.990 RSD u radnji")).toBe(
      `Disk i${NBSP}pločice${NBSP}— 12.990${NBSP}RSD u${NBSP}radnji`,
    );
  });

  it("is idempotent", () => {
    const once = typographer("Filteri i ulja — 4 kom. za 2 dana");
    expect(typographer(once)).toBe(once);
  });
});
