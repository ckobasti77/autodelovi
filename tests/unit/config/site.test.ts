import { describe, expect, it } from "vitest";

import { contactLinkList, contactLinks, resolveContact, site, type Contact } from "@/config/site";

const NBSP = "\u00a0";
const DISPLAY = `+381${NBSP}64${NBSP}123${NBSP}4567`;

const emptyContact: Contact = {
  phone: "",
  viber: "",
  whatsapp: "",
  email: "",
  hours: "",
  address: { street: "", postalCode: "", city: "", mapUrl: "" },
};

describe("contactLinks", () => {
  it.each([null, undefined, "", "   ", "nema", "064 12"])("tel(%j) → null", (value) => {
    expect(contactLinks.tel(value)).toBeNull();
    expect(contactLinks.viber(value)).toBeNull();
    expect(contactLinks.whatsapp(value)).toBeNull();
  });

  it("builds a tel: link with a non-breaking display", () => {
    expect(contactLinks.tel("064 123 4567")).toEqual({
      channel: "phone",
      href: "tel:+381641234567",
      display: DISPLAY,
    });
  });

  it("builds a Viber link", () => {
    expect(contactLinks.viber("064/123-4567")).toEqual({
      channel: "viber",
      href: "viber://chat?number=%2B381641234567",
      display: DISPLAY,
    });
  });

  it("builds a WhatsApp link with an optional message", () => {
    expect(contactLinks.whatsapp("+381 64 123 4567")?.href).toBe("https://wa.me/381641234567");
    expect(contactLinks.whatsapp("+381 64 123 4567", "Treba mi deo")).toEqual({
      channel: "whatsapp",
      href: "https://wa.me/381641234567?text=Treba%20mi%20deo",
      display: DISPLAY,
    });
  });

  it.each([null, undefined, "", "   ", "prodaja", "prodaja@", "pro daja@primer.rs", "a@b"])(
    "email(%j) → null",
    (value) => {
      expect(contactLinks.email(value)).toBeNull();
    },
  );

  it("builds a mailto: link, trimmed, with an encoded subject", () => {
    expect(contactLinks.email("  prodaja@primer.rs ")).toEqual({
      channel: "email",
      href: "mailto:prodaja@primer.rs",
      display: "prodaja@primer.rs",
    });
    expect(contactLinks.email("prodaja@primer.rs", "Upit: 1K0 615 301 AA")?.href).toBe(
      "mailto:prodaja@primer.rs?subject=Upit%3A%201K0%20615%20301%20AA",
    );
  });
});

describe("resolveContact", () => {
  it("returns the config fallback without overrides", () => {
    expect(resolveContact()).toEqual(site.contact);
    expect(resolveContact(null)).toEqual(site.contact);
  });

  it("ignores empty and whitespace-only overrides", () => {
    const resolved = resolveContact({
      phone: "   ",
      email: "",
      address: { street: " ", postalCode: "", city: "", mapUrl: "" },
    });
    expect(resolved).toEqual(site.contact);
  });

  it("applies non-empty overrides, trimmed, field by field", () => {
    const resolved = resolveContact({
      phone: " 064 123 4567 ",
      hours: "Pon–pet 8–17",
      address: { street: "Kneza Miloša 1", postalCode: "", city: "Beograd", mapUrl: "" },
    });
    expect(resolved.phone).toBe("064 123 4567");
    expect(resolved.hours).toBe("Pon–pet 8–17");
    expect(resolved.address).toEqual({
      street: "Kneza Miloša 1",
      postalCode: site.contact.address.postalCode,
      city: "Beograd",
      mapUrl: site.contact.address.mapUrl,
    });
    expect(resolved.email).toBe(site.contact.email);
  });
});

describe("contactLinkList", () => {
  it("returns nothing for an empty contact", () => {
    expect(contactLinkList(emptyContact)).toEqual([]);
  });

  it("orders phone, Viber, WhatsApp, e-mail", () => {
    const links = contactLinkList({
      ...emptyContact,
      email: "prodaja@primer.rs",
      whatsapp: "065 111 2222",
      viber: "064 123 4567",
      phone: "011 123 4567",
    });
    expect(links.map((link) => link.channel)).toEqual(["phone", "viber", "whatsapp", "email"]);
    expect(links.map((link) => link.href)).toEqual([
      "tel:+381111234567",
      "viber://chat?number=%2B381641234567",
      "https://wa.me/381651112222",
      "mailto:prodaja@primer.rs",
    ]);
  });

  it("drops invalid or missing channels", () => {
    const links = contactLinkList({ ...emptyContact, phone: "064 123 4567", email: "nije-email" });
    expect(links).toEqual([{ channel: "phone", href: "tel:+381641234567", display: DISPLAY }]);
  });
});
