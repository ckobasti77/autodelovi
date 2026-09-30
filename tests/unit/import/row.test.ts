import { describe, expect, it } from "vitest";

import { buildVehicleIndex, formatFitments, parseFitmentText } from "@/lib/import/fitmentText";
import { createIssues, splitMulti, suggestCategories, validateRow } from "@/lib/import/row";

import { CATEGORIES, VEHICLES, context } from "./refs";

describe("fitment text", () => {
  const index = buildVehicleIndex(VEHICLES);

  it("matches brand, generation, years and engine codes", () => {
    const { fitments, unmatched } = parseFitmentText(index, "VW Golf VII 2014-2020 [CRLB, CAYC]");
    expect(unmatched).toEqual([]);
    expect(fitments).toEqual([
      { brandId: "b-vw", modelId: "m-golf", generationId: "g-golf7", yearFrom: 2014, yearTo: 2020, engineId: "e-20tdi110" },
      { brandId: "b-vw", modelId: "m-golf", generationId: "g-golf7", yearFrom: 2014, yearTo: 2020, engineId: "e-16tdi77" },
    ]);
  });

  it("handles aliases, missing brands, engine names and several segments", () => {
    const { fitments, unmatched } = parseFitmentText(
      index,
      "Škoda Octavia III; golf 8\nPassat B6 2.0 TDI | Audi A4 B6 | Opel Astra H",
    );
    expect(fitments.map((f) => `${f.generationId}:${f.engineId ?? "*"}`)).toEqual([
      "g-oct3:*",
      "g-golf8:*",
      "g-passatb6:e-20tdi103pd",
      "g-passatb6:e-20tdi103cr",
      "g-a4b6:*",
    ]);
    expect(unmatched).toEqual(["Opel Astra H"]);
  });

  it("does not confuse Golf VII with Golf VIII", () => {
    expect(parseFitmentText(index, "VW Golf VIII").fitments[0]?.generationId).toBe("g-golf8");
  });

  it("refuses engines that are not linked to the generation", () => {
    expect(parseFitmentText(index, "Golf VII [BKD]").unmatched).toEqual(["Golf VII [BKD]"]);
  });

  it("round-trips through the formatter", () => {
    const source = "VW Golf VII 2014-2020 [CRLB, CAYC]; Škoda Octavia III; Audi A4 B8 [CBAB]";
    const first = parseFitmentText(index, source).fitments;
    const text = formatFitments(VEHICLES, first);
    expect(text).toBe(source);
    expect(parseFitmentText(index, text).fitments).toEqual(first);
  });
});

describe("validateRow", () => {
  it("normalizes a complete row", () => {
    const r = validateRow(
      {
        sku: "  DISK-001 ",
        name: "Kočioni  disk prednji",
        category: "kocioni diskovi",
        manufacturer: "ate",
        quality: "OEM",
        oem: "1K0 615 301 AA; 5Q0.615.301.F | 1K0615301AA",
        cross: "Febi Bilstein 12345678; ATE 24.0125-0158.1",
        priceRetail: "12.990,00",
        cost: "7.500",
        stock: "4",
        fitment: "VW Golf VII",
        images: "https://example.com/a.jpg; ftp://bad",
        weight: "5,4",
        active: "da",
      },
      context(),
    );
    expect(r.errors).toEqual([]);
    expect(r.data).toMatchObject({
      sku: "DISK-001",
      name: "Kočioni disk prednji",
      categoryId: "c-disk",
      manufacturerId: "mf-ate",
      quality: "oem",
      oemNumbers: ["1K0 615 301 AA", "5Q0.615.301.F"],
      crossNumbers: [
        { manufacturer: "Febi Bilstein", raw: "12345678" },
        { manufacturer: "ATE", raw: "24.0125-0158.1" },
      ],
      retailPricePara: 1_299_000,
      costNetPara: 750_000,
      stockQty: 4,
      images: ["https://example.com/a.jpg"],
      weightGrams: 5400,
      active: true,
    });
    expect(r.data.fitments).toHaveLength(1);
    expect(r.warnings.map((w) => w.code)).toEqual(["IMAGE_URL_INVALID"]);
  });

  it("reports the seeded error kinds", () => {
    const ctx = context();
    expect(validateRow({ sku: "A", priceRetail: "12,99a" }, ctx).errors[0]?.code).toBe("PRICE_INVALID");
    expect(validateRow({ sku: "A", stock: "-3" }, ctx).errors[0]?.code).toBe("STOCK_NEGATIVE");
    const unknown = validateRow({ sku: "A", category: "Nepostojeća kategorija" }, ctx);
    expect(unknown.errors[0]?.code).toBe("CATEGORY_UNKNOWN");
    expect(unknown.unknownCategory?.suggestions).toHaveLength(3);
    expect(validateRow({ name: "Bez šifre" }, ctx).errors[0]?.code).toBe("SKU_MISSING");
    expect(validateRow({ sku: "A", ean: "12AB" }, ctx).errors[0]?.field).toBe("ean");
  });

  it("asks for the group when a category name repeats", () => {
    const ctx = context();
    expect(validateRow({ sku: "A", category: "Senzori" }, ctx).errors[0]?.code).toBe("CATEGORY_AMBIGUOUS");
    expect(validateRow({ sku: "A", category: "Motor › Senzori" }, ctx).data.categoryId).toBe("c-senzori-a");
  });

  it("uses value maps for unknown categories and manufacturers", () => {
    const ctx = context({
      valueMaps: { category: { diskovi: "c-disk" }, manufacturer: { novimaker: "new" } },
    });
    const r = validateRow({ sku: "A", category: "Diskovi", manufacturer: "Novi Maker" }, ctx);
    expect(r.errors).toEqual([]);
    expect(r.data).toMatchObject({ categoryId: "c-disk", newManufacturer: true, manufacturerName: "Novi Maker" });
  });

  it("derives the retail price from the net price", () => {
    const r = validateRow({ sku: "A", priceNet: "10.000" }, context());
    expect(r.data.retailPricePara).toBe(1_200_000);
    expect(r.warnings.map((w) => w.code)).toContain("PRICE_FROM_NET");
  });

  it("ignores non stock/price fields in stock_price mode", () => {
    const r = validateRow(
      { sku: "A", name: "Ignored", stock: "5", priceRetail: "1.000" },
      context({ mode: "stock_price" }),
    );
    expect(r.data).toEqual({ sku: "A", stockQty: 5, retailPricePara: 100_000 });
  });

  it("warns on ambiguous numbers only when asked", () => {
    expect(validateRow({ sku: "A", priceRetail: "12.990" }, context()).warnings).toEqual([]);
    const warned = validateRow({ sku: "A", priceRetail: "12.990" }, context({ warnAmbiguous: true }));
    expect(warned.warnings[0]?.code).toBe("AMBIGUOUS_NUMBER");
  });

  it("keeps SKUs written as numbers intact", () => {
    expect(validateRow({ sku: 1234567 }, context()).data.sku).toBe("1234567");
  });

  it("lists what a new product still needs", () => {
    expect(createIssues({ sku: "A" }).map((i) => i.code)).toEqual([
      "NAME_MISSING",
      "CATEGORY_MISSING",
      "MANUFACTURER_MISSING",
      "PRICE_MISSING",
    ]);
  });

  it("splits multi-value cells without breaking codes", () => {
    expect(splitMulti("1K0 615 301 AA; 5Q0/615/301|X-1\nY")).toEqual(["1K0 615 301 AA", "5Q0/615/301", "X-1", "Y"]);
  });

  it("suggests close category names", () => {
    expect(suggestCategories("kocioni disk", CATEGORIES)[0]).toBe("Kočnice › Kočioni diskovi");
  });
});
