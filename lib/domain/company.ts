/**
 * Seller data that must be filled in before documents (predračun, otpremnica) and the
 * footer can be trusted. Shared by the dashboard setup notice and the print views.
 */
export type CompanyField = "legalName" | "pib" | "address" | "phone" | "bankAccount";

type CompanyLike = {
  legalName: string;
  pib?: string;
  address: { street: string; city: string; postalCode: string };
  phones: readonly unknown[];
  bankAccounts: readonly unknown[];
};

export function missingCompanyFields(c: CompanyLike): CompanyField[] {
  const missing: CompanyField[] = [];
  if (!c.legalName.trim()) missing.push("legalName");
  if (!c.pib?.trim()) missing.push("pib");
  if (!c.address.street.trim() || !c.address.city.trim()) missing.push("address");
  if (c.phones.length === 0) missing.push("phone");
  if (c.bankAccounts.length === 0) missing.push("bankAccount");
  return missing;
}

/**
 * Serbian bank account („tekući račun“) to its 18-digit form: `160-123456-78` pads the middle
 * part to 13 digits. Null when the shape is wrong.
 */
export function normalizeBankAccount(input: string): string | null {
  const parts = input.trim().split(/\s*-\s*/);
  if (parts.length === 3) {
    const [bank, middle, control] = parts as [string, string, string];
    if (!/^\d{3}$/.test(bank) || !/^\d{1,13}$/.test(middle) || !/^\d{2}$/.test(control))
      return null;
    return `${bank}${middle.padStart(13, "0")}${control}`;
  }
  const digits = input.replace(/\s/g, "");
  return /^\d{18}$/.test(digits) ? digits : null;
}

/** 18 digits whose control pair satisfies ISO 7064 MOD 97-10 (the whole number mod 97 = 1). */
export function isValidBankAccount(input: string): boolean {
  const n = normalizeBankAccount(input);
  if (!n) return false;
  let rest = 0;
  for (const d of n) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}
