import { describe, expect, it } from "vitest";

import { checkoutSchema, formFieldForServerField, stepForServerField, type CheckoutValues } from "@/lib/validation/checkout";
import { inquirySchema, type InquiryValues } from "@/lib/validation/inquiry";

const base: CheckoutValues = {
  firstName: "Nikola",
  lastName: "Stanković",
  phone: "064 123 4567",
  email: "nikola@primer.rs",
  isCompany: false,
  companyName: "",
  pib: "",
  mb: "",
  deliveryMethod: "pickup",
  street: "",
  city: "",
  postalCode: "",
  addressNote: "",
  paymentMethod: "pickup_cash",
  vin: "",
  useVehicle: true,
  note: "",
  terms: true,
};

const issues = (v: unknown) => {
  const r = checkoutSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("checkout schema (mirrors convex validateCheckout)", () => {
  it("accepts a guest pickup order", () => {
    expect(issues(base)).toEqual([]);
  });

  it("requires an address for the courier", () => {
    expect(issues({ ...base, deliveryMethod: "courier", paymentMethod: "cod" }).sort()).toEqual(["city", "postalCode", "street"]);
    expect(
      issues({ ...base, deliveryMethod: "courier", paymentMethod: "cod", street: "Bulevar 1", city: "Novi Sad", postalCode: "21000" }),
    ).toEqual([]);
  });

  it("checks PIB (MOD 11,10) and MB for company buyers", () => {
    expect(issues({ ...base, isCompany: true, companyName: "Servis", pib: "104052136" })).toEqual(["pib"]);
    expect(issues({ ...base, isCompany: true, companyName: "Servis", pib: "104052135", mb: "20084693" })).toEqual([]);
    expect(issues({ ...base, isCompany: true, companyName: "Servis", pib: "104052135", mb: "20084690" })).toEqual(["mb"]);
  });

  it("keeps bank transfer for companies and validates phone, e-mail, VIN, terms", () => {
    expect(issues({ ...base, paymentMethod: "bank_transfer" })).toEqual(["paymentMethod"]);
    expect(issues({ ...base, phone: "123", email: "x@", vin: "WVWZZZ1KZ8W12345I", terms: false }).sort()).toEqual([
      "email",
      "phone",
      "terms",
      "vin",
    ]);
  });

  it("maps Convex error fields back to steps and fields", () => {
    expect(stepForServerField("contact.email")).toBe(0);
    expect(stepForServerField("delivery.address.postalCode")).toBe(1);
    expect(stepForServerField("payment.method")).toBe(2);
    expect(stepForServerField(null)).toBe(3);
    expect(formFieldForServerField("company.pib")).toBe("pib");
    expect(formFieldForServerField("unknown")).toBeNull();
  });
});

const inquiry: InquiryValues = {
  vin: "",
  brandSlug: "",
  modelSlug: "",
  generationSlug: "",
  year: "",
  message: "Turbina za Golf",
  name: "Marko",
  phone: "065 987 6543",
  email: "",
  channel: "phone",
  consent: true,
};

describe("inquiry schema (mirrors convex inquiries.submit)", () => {
  const paths = (v: unknown) => {
    const r = inquirySchema.safeParse(v);
    return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
  };
  it("accepts a phone inquiry without VIN", () => {
    expect(paths(inquiry)).toEqual([]);
  });
  it("needs the contact that matches the reply channel", () => {
    expect(paths({ ...inquiry, channel: "email" })).toEqual(["email"]);
    expect(paths({ ...inquiry, phone: "", email: "m@primer.rs" })).toEqual(["phone"]);
    expect(paths({ ...inquiry, phone: "", email: "m@primer.rs", channel: "email" })).toEqual([]);
  });
  it("validates VIN, year, message and consent", () => {
    expect(paths({ ...inquiry, vin: "WVWZZZ1KZ8W123456", year: "2016" })).toEqual([]);
    expect(paths({ ...inquiry, vin: "WVWZZZ", year: "16", message: "x", consent: false }).sort()).toEqual([
      "consent",
      "message",
      "vin",
      "year",
    ]);
  });
});
