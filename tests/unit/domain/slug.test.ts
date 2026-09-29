import { describe, expect, it } from "vitest";

import { slugifySr } from "@/lib/domain/slug";

describe("slugifySr", () => {
  it.each([
    ["Kočioni diskovi", "kocioni-diskovi"],
    ["Đon žute šipke", "djon-zute-sipke"],
    ["đak ĐURĐEVDAN", "djak-djurdjevdan"],
    ["VW Golf VII 2.0 TDI", "vw-golf-vii-2-0-tdi"],
    ["Škoda Octavia III (5E)", "skoda-octavia-iii-5e"],
    ["Filteri & ulja", "filteri-i-ulja"],
    ["  --Ćevapi--  ", "cevapi"],
    ["Кочиони дискови", "kocioni-diskovi"],
    ["Љубиша Њега Џип", "ljubisa-njega-dzip"],
    ["Ђорђе Ћирић Жарко Шиљак", "djordje-ciric-zarko-siljak"],
    ["Mäßig über Öl", "massig-uber-ol"],
    ["Café Æther Øresund Œuvre", "cafe-aether-oresund-oeuvre"],
    ["Seat León Cupra", "seat-leon-cupra"],
    ["Ulje 5W-30 / 4 l", "ulje-5w-30-4-l"],
    ["snake_case.and/slashes\\too", "snake-case-and-slashes-too"],
    ["A---B___C...D", "a-b-c-d"],
    ["", ""],
    ["   ", ""],
    ["!!!", ""],
  ])("%j → %j", (input, expected) => {
    expect(slugifySr(input)).toBe(expected);
  });

  it("cuts at a dash boundary without a trailing dash", () => {
    expect(slugifySr("kocioni diskovi prednji", { maxLength: 18 })).toBe("kocioni-diskovi");
    expect(slugifySr("kocioni diskovi prednji", { maxLength: 15 })).toBe("kocioni-diskovi");
    expect(slugifySr("kocioni diskovi prednji", { maxLength: 16 })).toBe("kocioni-diskovi");
  });

  it("hard-cuts a single word longer than the limit", () => {
    expect(slugifySr("Kočionidiskovi", { maxLength: 7 })).toBe("kocioni");
  });

  it("defaults to 80 characters", () => {
    const slug = slugifySr("rezervni deo ".repeat(20));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug.startsWith("rezervni-deo-rezervni")).toBe(true);
  });

  it("only ever returns lowercase ASCII letters, digits and single dashes", () => {
    const slug = slugifySr("Ključ 17 mm — „Profi“ (ž/č/ć/š/đ) №1 ™");
    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(slug).toBe("kljuc-17-mm-profi-z-c-c-s-dj-1");
  });
});
