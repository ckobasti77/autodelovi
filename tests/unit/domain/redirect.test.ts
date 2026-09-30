import { describe, expect, it } from "vitest";

import { isSafeRelativePath, safeNextPath } from "@/lib/domain/redirect";

describe("safeNextPath", () => {
  it("keeps same-origin relative paths with query and hash", () => {
    expect(safeNextPath("/nalog/porudzbine?strana=2#vrh", "/x")).toBe(
      "/nalog/porudzbine?strana=2#vrh",
    );
    expect(safeNextPath(["/korpa", "/admin"], "/x")).toBe("/korpa");
  });

  it.each([
    undefined,
    "",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\\/evil.com",
    "/\n/evil.com",
    "javascript:alert(1)",
    "evil.com",
    `/${"a".repeat(600)}`,
  ])("rejects %j", (value) => {
    expect(safeNextPath(value, "/prijava")).toBe("/prijava");
  });

  it("normalises dot segments without leaving the origin", () => {
    expect(safeNextPath("/nalog/../korpa", "/x")).toBe("/korpa");
  });
});

describe("isSafeRelativePath", () => {
  it("accepts plain paths and rejects protocol-relative tricks", () => {
    expect(isSafeRelativePath("/za-majstore")).toBe(true);
    expect(isSafeRelativePath("/\\evil.com")).toBe(false);
    expect(isSafeRelativePath("//evil.com")).toBe(false);
  });
});
