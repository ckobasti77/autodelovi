import { describe, expect, it } from "vitest";

import { missingCompanyFields } from "@/lib/domain/company";

const complete = {
  legalName: "Primer d.o.o.",
  pib: "100000001",
  address: { street: "Ulica 1", city: "Beograd", postalCode: "11000" },
  phones: [{ label: "Prodaja", e164: "+381641234567" }],
  bankAccounts: [{ bank: "Banka", account: "160-0000000000000-00" }],
};

describe("missingCompanyFields", () => {
  it("returns nothing for complete seller data", () => {
    expect(missingCompanyFields(complete)).toEqual([]);
  });

  it("lists every empty field in a stable order", () => {
    expect(
      missingCompanyFields({
        legalName: "  ",
        address: { street: "", city: "Beograd", postalCode: "" },
        phones: [],
        bankAccounts: [],
      }),
    ).toEqual(["legalName", "pib", "address", "phone", "bankAccount"]);
  });

  it("treats a blank PIB as missing", () => {
    expect(missingCompanyFields({ ...complete, pib: " " })).toEqual(["pib"]);
  });
});

describe("bank accounts (QA FLOW-15)", () => {
  it("pads the middle part and checks MOD 97-10", async () => {
    const { normalizeBankAccount, isValidBankAccount } = await import("@/lib/domain/company");
    // 160-0000000123456-XX: the control pair is 98 - (first 16 digits × 100 mod 97).
    const first16 = "1600000000123456";
    let rest = 0;
    for (const d of `${first16}00`) rest = (rest * 10 + Number(d)) % 97;
    const control = String(98 - rest).padStart(2, "0");
    expect(normalizeBankAccount(`160-123456-${control}`)).toBe(`${first16}${control}`);
    expect(isValidBankAccount(`160-123456-${control}`)).toBe(true);
    expect(isValidBankAccount(`${first16}${control}`)).toBe(true);
    const wrong = String((Number(control) + 1) % 100).padStart(2, "0");
    expect(isValidBankAccount(`160-123456-${wrong}`)).toBe(false);
    expect(normalizeBankAccount("160-12a-55")).toBeNull();
    expect(isValidBankAccount("123")).toBe(false);
  });
});
