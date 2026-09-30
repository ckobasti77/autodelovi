import { describe, expect, it } from "vitest";

import { isLiveRoute, ROUTES } from "@/constants/routes";

describe("isLiveRoute", () => {
  it.each([
    ["/", true],
    ["/styleguide", true],
    ["/styleguide#boje", true],
    ["/styleguide?strana=2", true],
    ["/delovi", true],
    ["/delovi/kocnice", true],
    [ROUTES.searchFor("1K0 615"), true],
    ["/majstor", true],
    ["/majstor/brza-porudzbina?kodovi=1K0615301AA", true],
    ["/admin/majstori", true],
    ["/ponuda/zimske-gume", true],
    ["/nepostojeca-strana", false],
    ["/za-majstore", true],
    ["/za-majstore/registracija", true],
    ["/stylegui", false],
  ])("%s → %s", (href, expected) => {
    expect(isLiveRoute(href)).toBe(expected);
  });

  it("builds encoded helper routes", () => {
    expect(ROUTES.searchFor("1K0 615/301")).toBe("/pretraga?q=1K0%20615%2F301");
    expect(ROUTES.inquiryWith({ q: "turbina", kodovi: ["A1", "B2"] })).toBe(
      "/upit?q=turbina&kodovi=A1%2CB2",
    );
    expect(ROUTES.inquiryWith({})).toBe("/upit");
  });
});
