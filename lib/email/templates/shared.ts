/** Helpers shared by every template: the frame, money/date formatting, line rows. */
import { formatRsdPlain } from "../../domain/money";
import { formatBelgradeDate, formatBelgradeDateTime } from "../../domain/time";
import { companyLines, footerContacts, type EmailContext } from "../context";
import {
  items,
  join,
  layout,
  paragraph,
  type Block,
  type ItemRow,
  type RenderedEmail,
  type TotalRow,
} from "../html";
import type { EmailLine } from "../types";

export const rsd = formatRsdPlain;
export const date = formatBelgradeDate;
export const dateTime = formatBelgradeDateTime;

export type Audience = "customer" | "staff" | "account";

const REASON: Record<Audience, (ctx: EmailContext) => string> = {
  customer: (ctx) => `Ovu poruku ste dobili jer ste poslali porudžbinu ili upit na sajtu ${ctx.brandName}.`,
  staff: (ctx) => `Ovu poruku dobijate kao zaposleni u ${ctx.brandName}.`,
  account: (ctx) => `Ovu poruku ste dobili zbog naloga na sajtu ${ctx.brandName}.`,
};

export function frame(
  ctx: EmailContext,
  input: {
    subject: string;
    preheader: string;
    reference?: string;
    body: Block;
    audience: Audience;
    reason?: string;
    manageLink?: { label: string; href: string };
    whatsappText?: string;
  },
): RenderedEmail {
  return layout({
    subject: input.subject,
    preheader: input.preheader,
    brandName: ctx.brandName,
    siteUrl: ctx.siteUrl,
    ...(input.reference ? { reference: input.reference } : {}),
    body: input.body,
    companyLines: companyLines(ctx),
    contacts: input.audience === "staff" ? [] : footerContacts(ctx, input.whatsappText),
    ...(input.audience === "staff" || !ctx.hoursText ? {} : { hoursText: ctx.hoursText }),
    reason: input.reason ?? REASON[input.audience](ctx),
    ...(input.manageLink ? { manageLink: input.manageLink } : {}),
  });
}

export function lineRows(lines: readonly EmailLine[]): ItemRow[] {
  return lines.map((l) => ({
    name: l.name,
    ...(l.sku ? { sku: l.sku } : {}),
    ...(l.manufacturer ? { meta: l.manufacturer } : {}),
    quantity: l.quantity,
    unitLabel: rsd(l.unitPricePara),
    totalLabel: rsd(l.lineTotalPara),
    ...(l.availabilityNote ? { note: l.availabilityNote } : {}),
  }));
}

/** Serbian count form: 1 stavka, 2–4 stavke, 5+ stavki (11–14 stavki). */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export function linesBlock(
  lines: readonly EmailLine[],
  moreLines: number,
  totals: readonly TotalRow[],
): Block {
  const table = items(lineRows(lines), totals);
  if (moreLines <= 0) return table;
  const more = paragraph(
    `I još ${moreLines} ${plural(moreLines, ["stavka", "stavke", "stavki"])} — sve su navedene na stranici statusa.`,
    { muted: true },
  );
  return join(table, more);
}

/** „2 h 15 min“ of working time. */
export function workingAge(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

export const CHANNEL_LABEL = {
  phone: "telefonom",
  viber: "na Viber",
  whatsapp: "na WhatsApp",
  email: "e-poštom",
} as const;
