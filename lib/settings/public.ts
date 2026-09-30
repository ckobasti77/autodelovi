/**
 * Public settings → shell/contact shapes (pure, shared by server pages and client islands).
 * Empty values stay empty so every consumer hides the channel instead of inventing one.
 */
import { resolveCompany, resolveContact, site, type Company, type Contact } from "@/config/site";
import { formatHours, type SettingsHours } from "@/lib/format/hours";
import { formatRSD } from "@/lib/format/money";

export { formatHours, type SettingsHours };

export type SettingsCompany = {
  legalName: string;
  displayName?: string;
  pib?: string;
  mb?: string;
  address: { street: string; city: string; postalCode: string };
  phones: { label: string; e164: string }[];
  viber?: string;
  whatsapp?: string;
  email?: string;
  bankAccounts: { bank: string; account: string }[];
  mapUrl?: string;
  registryNote?: string;
};

export type PublicSettingsLike = {
  company: SettingsCompany;
  hours: SettingsHours;
  brand: { name: string; tagline: string };
  commerce: { freeShippingOverPara: number; quoteValidityDays: number; etaText: string };
  deliveryMethods: {
    code: "pickup" | "courier";
    label: string;
    description: string;
    pricePara: number;
    freeOverPara?: number;
    etaText: string;
  }[];
};

export function contactFromSettings(s: Pick<PublicSettingsLike, "company" | "hours">): Contact {
  const c = s.company;
  return resolveContact({
    phone: c.phones[0]?.e164 ?? "",
    viber: c.viber ?? "",
    whatsapp: c.whatsapp ?? "",
    email: c.email ?? "",
    hours: formatHours(s.hours),
    address: {
      street: c.address.street,
      city: c.address.city,
      postalCode: c.address.postalCode,
      mapUrl: c.mapUrl ?? "",
    },
  });
}

export function companyFromSettings(s: Pick<PublicSettingsLike, "company">): Company {
  const c = s.company;
  const seat = [c.address.street, [c.address.postalCode, c.address.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return resolveCompany({
    legalName: c.legalName,
    pib: c.pib ?? "",
    mb: c.mb ?? "",
    registry: c.registryNote ?? "",
    seat,
  });
}

/** Values for `{{…}}` placeholders in content pages (lib/content/placeholders.ts). */
export function placeholderValues(s: PublicSettingsLike, siteUrl = site.url): Record<string, string> {
  const contact = contactFromSettings(s);
  const company = companyFromSettings(s);
  const courier = s.deliveryMethods.find((d) => d.code === "courier");
  const freeOver = courier?.freeOverPara ?? s.commerce.freeShippingOverPara;
  const account = s.company.bankAccounts[0];
  return {
    "firma.naziv": company.legalName || s.company.displayName || "",
    "firma.pib": company.pib,
    "firma.mb": company.mb,
    "firma.adresa": company.seat,
    "firma.email": contact.email,
    "firma.telefon": contact.phone,
    "firma.registar": company.registry,
    "firma.racun": account ? `${account.account} (${account.bank})` : "",
    brend: s.brand.name || site.brand.name,
    sajt: siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    "dostava.kurir.cena": courier ? formatRSD(courier.pricePara) : "",
    "dostava.besplatnoPreko": freeOver ? formatRSD(freeOver) : "",
    "ponuda.vaziDana": String(s.commerce.quoteValidityDays),
    radnoVreme: formatHours(s.hours),
  };
}
