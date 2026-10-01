import { describe, expect, it } from "vitest";

import { checkoutSchema, formFieldForServerField, stepForServerField, type CheckoutValues } from "@/lib/validation/checkout";
import { inquirySchema, type InquiryValues } from "@/lib/validation/inquiry";
import { emailProblem, mbProblem, passwordProblem, pibProblem } from "@/lib/validation/identifiers";
import { mechanicRegistrationSchema } from "@/lib/validation/mechanicRegistration";
import { ERRORS } from "@/lib/i18n/sr/shop";

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

describe("PIB / MB messages by case (FLOW-09)", () => {
  const messages = (v: unknown, path: string) => {
    const r = checkoutSchema.safeParse(v);
    return r.success ? [] : r.error.issues.filter((i) => i.path.join(".") === path).map((i) => i.message);
  };
  const company = { ...base, isCompany: true, companyName: "Servis" };

  it("says what is wrong with a PIB: empty, length or check digit", () => {
    expect(pibProblem("")).toBe(ERRORS.pib.required);
    expect(pibProblem("10405213")).toBe(ERRORS.pib.length);
    expect(pibProblem("104052136")).toBe(ERRORS.pib.checksum);
    expect(pibProblem("104 052 135")).toBeNull();
    expect(messages({ ...company, pib: "" }, "pib")).toEqual([ERRORS.pib.required]);
    expect(messages({ ...company, pib: "104052136" }, "pib")).toEqual([ERRORS.pib.checksum]);
  });

  it("says what is wrong with an MB: an 8-digit number with a bad check digit is not a length problem", () => {
    expect(mbProblem("")).toBe(ERRORS.mb.required);
    expect(mbProblem("2008469")).toBe(ERRORS.mb.length);
    expect(mbProblem("64552873")).toBe(ERRORS.mb.checksum);
    expect(mbProblem("20084693")).toBeNull();
    expect(messages({ ...company, pib: "104052135", mb: "64552873" }, "mb")).toEqual([ERRORS.mb.checksum]);
  });

  it("uses the same messages in the mechanic registration", () => {
    const schema = mechanicRegistrationSchema({ needsAccount: true });
    const r = schema.safeParse({
      email: "",
      password: "",
      companyName: "Servis",
      pib: "",
      mb: "64552873",
      contactPerson: "Petar",
      phone: "064 123 4567",
      city: "Beograd",
      address: "Ulica 1",
      serviceTypes: ["mehanika"],
      brandsServiced: [],
      terms: true,
    });
    const byPath = Object.fromEntries((r.success ? [] : r.error.issues).map((i) => [i.path.join("."), i.message]));
    expect(byPath.pib).toBe(ERRORS.pib.required);
    expect(byPath.mb).toBe(ERRORS.mb.checksum);
    // COPY-13: an empty e-mail is „required“, not „invalid“.
    expect(byPath.email).toBe(ERRORS.emailRequired);
    expect(byPath.password).toBe(ERRORS.required("lozinku"));
  });
});

describe("password rules (BE-12 mirror)", () => {
  it("rejects a password equal to the e-mail address", () => {
    expect(passwordProblem("marko2024@primer.rs", "Marko2024@primer.rs")).toBe(ERRORS.passwordIsEmail);
    expect(passwordProblem("TajnaLozinka-555", "marko2024@primer.rs")).toBeNull();
    expect(passwordProblem("kratka1")).toBe("Lozinka mora imati najmanje 10 znakova.");
  });

  it("orders e-mail messages required → format", () => {
    expect(emailProblem("  ")).toBe(ERRORS.emailRequired);
    expect(emailProblem("pogresno@")).toBe(ERRORS.email);
    expect(emailProblem("ime@primer.rs")).toBeNull();
  });
});
