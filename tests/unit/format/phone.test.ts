import { describe, expect, it } from "vitest";

import { formatPhone, normalizePhone, telHref, viberHref, whatsappHref } from "@/lib/format/phone";

const NBSP = "\u00a0";

describe("normalizePhone", () => {
  it.each([
    ["064 123 4567", "+381641234567"],
    ["064/123-4567", "+381641234567"],
    ["+381 64 123 4567", "+381641234567"],
    ["00381641234567", "+381641234567"],
    ["381641234567", "+381641234567"],
    ["0641234567", "+381641234567"],
    ["64 123 4567", "+381641234567"],
    ["+381 (0) 64 1234567", "+381641234567"],
    ["+381 064 123 4567", "+381641234567"],
    [`064${NBSP}123${NBSP}4567`, "+381641234567"],
    ["063 123 456", "+38163123456"],
    ["060.123.4567", "+381601234567"],
    ["011 123 4567", "+381111234567"],
    ["(011) 123-45-67", "+381111234567"],
    ["021 456 789", "+38121456789"],
    ["018 123 456", "+38118123456"],
    ["0230 123 45", "+38123012345"],
    ["+49 151 1234 5678", "+4915112345678"],
    ["0049 30 1234567", "+49301234567"],
    ["+1 (212) 555-0123", "+12125550123"],
  ])("%j → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "   ",
    "nema",
    "064 123",
    "064 123 45678",
    "0441234567",
    "123",
    "+381 99 123 4567",
    "+12 34",
    "064 123 4567 posle 17h",
  ])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("formatPhone", () => {
  it.each([
    ["+381641234567", `+381${NBSP}64${NBSP}123${NBSP}4567`],
    ["+38163123456", `+381${NBSP}63${NBSP}123${NBSP}456`],
    ["+381111234567", `+381${NBSP}11${NBSP}123${NBSP}4567`],
    ["+38121456789", `+381${NBSP}21${NBSP}456${NBSP}789`],
    ["+38123012345", `+381${NBSP}230${NBSP}123${NBSP}45`],
    ["064/123-4567", `+381${NBSP}64${NBSP}123${NBSP}4567`],
    ["+4915112345678", `+49${NBSP}15112345678`],
    ["+12125550123", `+1${NBSP}2125550123`],
    ["+38591234567", `+385${NBSP}91234567`],
  ])("%s → %j", (input, expected) => {
    expect(formatPhone(input)).toBe(expected);
  });

  it("never contains an ordinary (breakable) space", () => {
    expect(formatPhone("+381641234567")).not.toContain(" ");
  });

  it("returns un-normalisable input trimmed and unchanged", () => {
    expect(formatPhone("  nema  ")).toBe("nema");
  });
});

describe("link builders", () => {
  it("builds tel:, viber:// and wa.me links", () => {
    expect(telHref("+381641234567")).toBe("tel:+381641234567");
    expect(viberHref("+381641234567")).toBe("viber://chat?number=%2B381641234567");
    expect(whatsappHref("+381641234567")).toBe("https://wa.me/381641234567");
  });

  it("URL-encodes the WhatsApp message", () => {
    expect(whatsappHref("+381641234567", "Treba mi deo: 1K0 615 301 AA & disk?")).toBe(
      "https://wa.me/381641234567?text=Treba%20mi%20deo%3A%201K0%20615%20301%20AA%20%26%20disk%3F",
    );
    expect(whatsappHref("+381641234567", "Kočnice, šta imate?")).toBe(
      "https://wa.me/381641234567?text=Ko%C4%8Dnice%2C%20%C5%A1ta%20imate%3F",
    );
  });

  it("ignores an empty WhatsApp message", () => {
    expect(whatsappHref("+381641234567", "  ")).toBe("https://wa.me/381641234567");
  });

  it("cleans a formatted number before building links", () => {
    expect(telHref(`+381${NBSP}64${NBSP}123${NBSP}4567`)).toBe("tel:+381641234567");
  });
});
