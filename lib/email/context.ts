/**
 * Everything a template needs besides its own data: brand, company and contact data from
 * settings (empty-safe — missing values are simply not shown), the site origin and link
 * helpers (UTM on own links, click-to-chat links from settings).
 */
import { BRAND_NAME } from "../domain/brand";
import { formatHours, type SettingsHours } from "../format/hours";
import { formatPhone, normalizePhone, telHref, viberHref, whatsappHref } from "../format/phone";
import type { FooterContact } from "./html";

export type EmailCompany = {
  legalName: string;
  displayName?: string;
  pib?: string;
  mb?: string;
  address: { street: string; city: string; postalCode: string };
  phones: readonly { label: string; e164: string }[];
  viber?: string;
  whatsapp?: string;
  email?: string;
  bankAccounts: readonly { bank: string; account: string }[];
  mapUrl?: string;
};

export type EmailSettingsLike = {
  company: EmailCompany;
  hours: SettingsHours;
  brand: { name: string };
};

export type EmailContext = {
  siteUrl: string;
  brandName: string;
  company: EmailCompany;
  hoursText: string;
};

export function emailContext(settings: EmailSettingsLike, siteUrl: string): EmailContext {
  return {
    siteUrl: siteUrl.replace(/\/$/, ""),
    brandName: settings.brand.name.trim() || BRAND_NAME,
    company: settings.company,
    hoursText: formatHours(settings.hours),
  };
}

/** Absolute URL on the site; own links carry `utm_source=email&utm_medium=transactional`. */
export function siteLink(ctx: EmailContext, path: string, campaign?: string): string {
  const base = `${ctx.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
  if (!campaign) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}utm_source=email&utm_medium=transactional&utm_campaign=${encodeURIComponent(campaign)}`;
}

/** Admin links never carry UTM (staff traffic is not marketing). */
export function adminLink(ctx: EmailContext, path: string): string {
  return siteLink(ctx, path);
}

export function companyName(ctx: EmailContext): string {
  return ctx.company.displayName?.trim() || ctx.company.legalName.trim() || ctx.brandName;
}

export function addressLine(ctx: EmailContext): string {
  const a = ctx.company.address;
  const city = [a.postalCode.trim(), a.city.trim()].filter(Boolean).join(" ");
  return [a.street.trim(), city].filter(Boolean).join(", ");
}

export function companyLines(ctx: EmailContext): string[] {
  const c = ctx.company;
  const ids = [c.pib?.trim() ? `PIB ${c.pib.trim()}` : "", c.mb?.trim() ? `MB ${c.mb.trim()}` : ""]
    .filter(Boolean)
    .join(" · ");
  return [c.legalName.trim() || ctx.brandName, addressLine(ctx), ids].filter(Boolean);
}

/** Phone, Viber, WhatsApp and e-mail — only channels present in settings. */
export function footerContacts(ctx: EmailContext, whatsappText?: string): FooterContact[] {
  const out: FooterContact[] = [];
  const phone = normalizePhone(ctx.company.phones[0]?.e164);
  if (phone) out.push({ label: "Telefon", value: formatPhone(phone), href: telHref(phone) });
  const viber = normalizePhone(ctx.company.viber);
  if (viber) out.push({ label: "Viber", value: formatPhone(viber), href: viberHref(viber) });
  const whatsapp = normalizePhone(ctx.company.whatsapp);
  if (whatsapp)
    out.push({
      label: "WhatsApp",
      value: formatPhone(whatsapp),
      href: whatsappHref(whatsapp, whatsappText),
    });
  const email = ctx.company.email?.trim();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    out.push({ label: "E‑pošta", value: email, href: `mailto:${email}` });
  return out;
}

/** „Pozovite +381 64 … ili pišite na Viber“ — one sentence for „Pitanja?“ paragraphs. */
export function contactSentence(ctx: EmailContext): string {
  const phone = normalizePhone(ctx.company.phones[0]?.e164);
  const viber = normalizePhone(ctx.company.viber);
  const parts: string[] = [];
  if (phone) parts.push(`pozovite [${formatPhone(phone)}](${telHref(phone)})`);
  if (viber) parts.push(`pišite na [Viber](${viberHref(viber)})`);
  if (parts.length === 0) return "Odgovorite na ovu poruku.";
  return `${parts.join(" ili ")[0]!.toUpperCase()}${parts.join(" ili ").slice(1)} ili odgovorite na ovu poruku.`;
}
