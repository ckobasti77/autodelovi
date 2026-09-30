/**
 * Public settings → shell/contact shapes (pure, shared by server pages and client islands).
 * Empty values stay empty so every consumer hides the channel instead of inventing one.
 */
import { resolveCompany, resolveContact, site, type Company, type Contact } from "@/config/site";
import { formatRSD } from "@/lib/format/money";

export type SettingsHours = { day: number; open: string; close: string; closed: boolean }[];

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

const DAY_SHORT = ["ned", "pon", "uto", "sre", "čet", "pet", "sub"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function hhmm(value: string): string {
  const [h, m] = value.split(":");
  const hour = String(Number(h));
  return m && m !== "00" ? `${hour}:${m}` : hour;
}

/** „Pon–pet 8–17, sub 8–14“ (closed days omitted); empty when no hours are set. */
export function formatHours(hours: SettingsHours): string {
  const byDay = new Map(hours.map((h) => [h.day, h]));
  const groups: { from: number; to: number; label: string }[] = [];
  for (const day of WEEK_ORDER) {
    const h = byDay.get(day);
    if (!h || h.closed) continue;
    const label = `${hhmm(h.open)}–${hhmm(h.close)}`;
    const last = groups[groups.length - 1];
    const prevDay = last ? WEEK_ORDER[WEEK_ORDER.indexOf(day) - 1] : undefined;
    if (last && last.label === label && last.to === prevDay) last.to = day;
    else groups.push({ from: day, to: day, label });
  }
  const text = groups
    .map((g) =>
      g.from === g.to
        ? `${DAY_SHORT[g.from]} ${g.label}`
        : `${DAY_SHORT[g.from]}–${DAY_SHORT[g.to]} ${g.label}`,
    )
    .join(", ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

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
