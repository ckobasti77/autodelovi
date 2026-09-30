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
