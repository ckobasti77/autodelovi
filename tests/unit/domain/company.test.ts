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
