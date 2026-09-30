import { describe, expect, it } from "vitest";

import { decodeCsvBytes, detectDelimiter, encodeWindows1250 } from "@/lib/import/csv";
import { mappingProblems } from "@/lib/import/fields";
import {
  applyPreset,
  autoMap,
  detectHeaderRow,
  guessField,
  normalizeHeader,
  presetScore,
  toPresetMapping,
} from "@/lib/import/headers";
import { sniffImage } from "@/lib/import/imageSniff";
import {
  detectNumberFormat,
  parseBool,
  parseMoney,
  parseNumber,
  parseWeight,
  parseWholeNumber,
} from "@/lib/import/numbers";

describe("headers", () => {
  it("normalizes case, diacritics and punctuation", () => {
    expect(normalizeHeader("Proizvođač")).toBe("proizvodjac");
    expect(normalizeHeader(" Kat. br. ")).toBe("katbr");
    expect(normalizeHeader("MP cena (sa PDV)")).toBe("mpcenasapdv");
  });

  it("maps synonyms with confidence", () => {
    expect(guessField("Šifra")).toEqual({ field: "sku", confidence: "exact" });
    expect(guessField("SIFRA")).toEqual({ field: "sku", confidence: "exact" });
    expect(guessField("kat. br.")).toEqual({ field: "oem", confidence: "alias" });
    expect(guessField("Proizvodjac")?.field).toBe("manufacturer");
    expect(guessField("Kolicna")).toEqual({ field: "stock", confidence: "fuzzy" });
    expect(guessField("MP cena sa PDV-om (RSD)")?.field).toBe("priceRetail");
    expect(guessField("VP cena bez PDV")?.field).toBe("priceNet");
    expect(guessField("Nešto sasvim drugo")).toBeNull();
  });

  it("auto-maps a real export and uses each field once", () => {
    const mapped = autoMap([
      "Šifra",
      "Naziv artikla",
      "Kat. br.",
      "Brend",
      "MPC",
      "Lager",
      "Šifra",
    ]);
    expect(mapped.map((m) => m.field)).toEqual([
      "sku",
      "name",
      "oem",
      "manufacturer",
      "priceRetail",
      "stock",
      "ignore",
    ]);
  });

  it("finds the header row below a title block", () => {
    const rows = [
      ["Cenovnik — izvoz 29.09.2026."],
      [],
      ["Šifra", "Naziv", "Količina", "MP cena"],
      ["A-1", "Disk", 3, 12990],
    ];
    expect(detectHeaderRow(rows)).toBe(2);
  });

  it("scores and applies presets", () => {
    const headers = ["Artikal", "Opis kratki", "Stanje", "Nabavna"];
    const preset = toPresetMapping([
      { column: 0, header: "Artikal", field: "sku" },
      { column: 1, header: "Opis kratki", field: "description" },
      { column: 2, header: "Stanje", field: "stock" },
    ]);
    expect(presetScore(preset, headers)).toBe(1);
    const applied = applyPreset(preset, headers);
    expect(applied.map((m) => m.field)).toEqual(["sku", "description", "stock", "cost"]);
    expect(presetScore(preset, ["Šifra", "Naziv"])).toBe(0);
  });

  it("reports mapping problems", () => {
    expect(mappingProblems([{ column: 0, header: "Naziv", field: "name" }], "full")).toContain(
      "Izaberite kolonu sa šifrom artikla.",
    );
    expect(
      mappingProblems(
        [
          { column: 0, header: "Šifra", field: "sku" },
          { column: 1, header: "Naziv", field: "name" },
        ],
        "stock_price",
      ),
    ).toEqual(["Izaberite bar jednu kolonu sa količinom, cenom ili statusom."]);
  });
});

describe("numbers", () => {
  it("parses Serbian and English formats", () => {
    expect(parseNumber("1.234,56", "sr")).toEqual({ ok: true, value: 1234.56, ambiguous: false });
    expect(parseNumber("1,234.56", "en")).toEqual({ ok: true, value: 1234.56, ambiguous: false });
    expect(parseNumber("12 990,00 RSD", "sr")).toEqual({
      ok: true,
      value: 12990,
      ambiguous: false,
    });
    expect(parseNumber("1.234.567", "sr")).toEqual({ ok: true, value: 1234567, ambiguous: false });
    expect(parseNumber(12990, "sr")).toEqual({ ok: true, value: 12990, ambiguous: false });
  });

  it("flags ambiguous single separators", () => {
    expect(parseNumber("12.990", "sr")).toEqual({ ok: true, value: 12990, ambiguous: true });
    expect(parseNumber("12.990", "en")).toEqual({ ok: true, value: 12.99, ambiguous: true });
    expect(parseNumber("12,990", "sr")).toEqual({ ok: true, value: 12.99, ambiguous: true });
  });

  it("refuses malformed numbers", () => {
    expect(parseNumber("12,99a", "sr").ok).toBe(false);
    expect(parseNumber("12.99", "sr").ok).toBe(false);
    expect(parseNumber("1,2,3", "sr").ok).toBe(false);
    expect(parseNumber("", "sr")).toEqual({ ok: false, reason: "empty" });
  });

  it("detects the format from evidence", () => {
    expect(detectNumberFormat(["1.234,56", "12,5", "12.990"]).format).toBe("sr");
    expect(detectNumberFormat(["1,234.56", "12.5"]).format).toBe("en");
    expect(detectNumberFormat(["12.990", 5]).sr).toBe(0);
  });

  it("converts money to para half-up and refuses negatives", () => {
    expect(parseMoney("12.990,005", "sr")).toEqual({ ok: true, para: 1299001, ambiguous: false });
    expect(parseMoney("0,5", "sr")).toEqual({ ok: true, para: 50, ambiguous: false });
    expect(parseMoney("-5", "sr")).toEqual({ ok: false, reason: "negative" });
  });

  it("parses whole numbers, booleans and weights", () => {
    expect(parseWholeNumber("12,0", "sr")).toEqual({ ok: true, value: 12 });
    expect(parseWholeNumber("1,5", "sr")).toEqual({ ok: false, reason: "fraction" });
    expect(parseWholeNumber("-3", "sr")).toEqual({ ok: false, reason: "negative" });
    expect(parseBool("DA")).toEqual({ ok: true, value: true });
    expect(parseBool("ne")).toEqual({ ok: true, value: false });
    expect(parseBool("možda").ok).toBe(false);
    expect(parseWeight("5,4", "sr")).toEqual({ ok: true, grams: 5400, ambiguous: false });
    expect(parseWeight("450 g", "sr")).toEqual({ ok: true, grams: 450, ambiguous: false });
    expect(parseWeight(1.25, "sr")).toEqual({ ok: true, grams: 1250, ambiguous: false });
  });
});

describe("csv", () => {
  const text = "Šifra;Naziv;Količina\nA-1;Kočioni disk „ATE“ — čćžšđ ČĆŽŠĐ;3\n";

  it("decodes Windows-1250 and keeps Serbian letters", () => {
    const decoded = decodeCsvBytes(encodeWindows1250(text));
    expect(decoded.encoding).toBe("windows-1250");
    expect(decoded.text).toBe(text);
  });

  it("decodes UTF-8 with and without a BOM", () => {
    const utf8 = new TextEncoder().encode(text);
    expect(decodeCsvBytes(utf8)).toMatchObject({ encoding: "utf-8", bom: false, text });
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]);
    expect(decodeCsvBytes(withBom)).toMatchObject({ encoding: "utf-8", bom: true, text });
  });

  it("honours an encoding override", () => {
    const decoded = decodeCsvBytes(encodeWindows1250(text), "windows-1250");
    expect(decoded.text).toContain("čćžšđ");
  });

  it("detects the delimiter outside quotes", () => {
    expect(detectDelimiter(text)).toBe(";");
    expect(detectDelimiter('a,b,c\n"x;y",2,3\n4,5,6')).toBe(",");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
    expect(detectDelimiter('šifra;cena\n"12,5";"1.234,56"')).toBe(";");
  });
});

describe("image sniffing", () => {
  it("reads PNG dimensions", () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    png.set([0, 0, 0x03, 0x20], 16); // 800
    png.set([0, 0, 0x02, 0x58], 20); // 600
    expect(sniffImage(png)).toEqual({ mime: "image/png", width: 800, height: 600 });
  });

  it("reads JPEG SOF dimensions", () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0,
      0x02, 0x80, 0x03, 0x01, 0x22, 0x00,
    ]);
    expect(sniffImage(jpeg)).toEqual({ mime: "image/jpeg", width: 640, height: 480 });
  });

  it("refuses non-images", () => {
    expect(sniffImage(new TextEncoder().encode("<html><body>404</body></html>"))).toBeNull();
  });
});
