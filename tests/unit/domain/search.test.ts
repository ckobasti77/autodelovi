import { describe, expect, test } from "vitest";

import { BRANDS, MODELS } from "@/convex/seedData/vehicles";
import {
  foldForSearch,
  parseVehicleTerms,
  partTerms,
  termMatchesText,
  type VehicleTermTree,
} from "@/lib/domain/search";

const tree: VehicleTermTree = BRANDS.map((brand) => ({
  brand,
  models: MODELS.filter((m) => m.brand === brand.slug).map((model) => ({
    model,
    generations: model.generations,
  })),
}));

const parse = (q: string) => parseVehicleTerms(foldForSearch(q).split(" ").filter(Boolean), tree);

describe("parseVehicleTerms (FLOW-01, D230)", () => {
  test.each([
    ["pločice golf 7", ["plocice"]],
    ["kočioni disk golf 7", ["kocioni", "disk"]],
    ["amortizer golf 7", ["amortizer"]],
    ["golf 7", []],
    ["pločice golf vii", ["plocice"]],
    ["Golf VII pločice", ["plocice"]],
    ["vw golf 7 pločice", ["plocice"]],
    ["pločice golf7", ["plocice"]],
    ["pločice mk7", ["plocice"]],
  ])("„%s“ → Golf VII, part terms %j", (q, rest) => {
    const { match, rest: left } = parse(q);
    expect(match).toEqual({ brandSlug: "volkswagen", modelSlug: "golf", generationSlug: "golf-7" });
    expect(left).toEqual(rest);
  });

  test("Roman and Arabic numbers map to the same generation", () => {
    expect(parse("octavia 3 filter").match?.generationSlug).toBe("octavia-3");
    expect(parse("octavia iii filter").match?.generationSlug).toBe("octavia-3");
    expect(parse("golf 5").match?.generationSlug).toBe("golf-5");
    expect(parse("golf v").match?.generationSlug).toBe("golf-5");
  });

  test("model only, brand only, and a generation the catalog does not have", () => {
    expect(parse("hladnjak passat").match).toEqual({
      brandSlug: "volkswagen",
      modelSlug: "passat",
      generationSlug: null,
    });
    const golf9 = parse("hladnjak golf 9");
    expect(golf9.match).toMatchObject({ modelSlug: "golf", generationSlug: null });
    expect(golf9.rest).toEqual(["hladnjak"]);
    expect(parse("audi pločice").match).toEqual({
      brandSlug: "audi",
      modelSlug: null,
      generationSlug: null,
    });
  });

  test("no vehicle: every token stays a part term", () => {
    expect(parse("kočioni disk")).toEqual({ match: null, rest: ["kocioni", "disk"] });
    expect(parse("disk 7")).toEqual({ match: null, rest: ["disk", "7"] });
  });
});

describe("partTerms and termMatchesText", () => {
  test("one-letter noise is dropped unless it is all there is", () => {
    expect(partTerms(foldForSearch("<b>disk</b>").split(" "))).toEqual(["disk"]);
    expect(partTerms(["a"])).toEqual(["a"]);
  });

  test("inflected forms match the category and product names", () => {
    expect(termMatchesText("plocica", foldForSearch("Kočione pločice"))).toBe(true);
    expect(termMatchesText("disk", foldForSearch("Kočioni diskovi"))).toBe(true);
    expect(termMatchesText("amortizera", foldForSearch("Amortizeri"))).toBe(true);
    expect(termMatchesText("disk", foldForSearch("Metlice brisača"))).toBe(false);
  });
});
