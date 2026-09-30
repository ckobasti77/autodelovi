/** Staff e-mails: new order / inquiry / mechanic, quote follow-ups, low stock, digest, reminders. */
import { adminLink, type EmailContext } from "../context";
import {
  bullets,
  button,
  facts,
  heading,
  join,
  notice,
  paragraph,
  subheading,
  type RenderedEmail,
} from "../html";
import { formatPhone, normalizePhone, telHref } from "../../format/phone";
import type {
  StaffDigestEmailData,
  StaffInquiryEmailData,
  StaffLowStockEmailData,
  StaffMechanicEmailData,
  StaffOrderEmailData,
  StaffQuoteEmailData,
  StaffReminderEmailData,
} from "../types";
import { CHANNEL_LABEL, date, frame, linesBlock, plural, rsd } from "./shared";

function staffFrame(
  ctx: EmailContext,
  input: { subject: string; preheader: string; reference?: string; body: ReturnType<typeof join> },
): RenderedEmail {
  return frame(ctx, {
    ...input,
    audience: "staff",
    manageLink: {
      label: "Podešavanja obaveštenja",
      href: adminLink(ctx, "/admin/podesavanja?tab=obavestenja"),
    },
  });
}

function phoneValue(phone: string | undefined): string {
  const e164 = normalizePhone(phone);
  return e164 ? `[${formatPhone(e164)}](${telHref(e164)})` : (phone ?? "");
}

const CUSTOMER_TYPE = { guest: "gost", customer: "kupac sa nalogom", mechanic: "majstor" } as const;

export function staffOrderNew(d: StaffOrderEmailData, ctx: EmailContext): RenderedEmail {
  const body = join(
    heading(`Nova porudžbina ${d.number}`),
    d.customerType === "mechanic"
      ? notice(
          "info",
          `Majstorska porudžbina${d.tierName ? ` · razred ${d.tierName}` : ""}`,
          d.companyName ?? undefined,
        )
      : null,
    facts([
      ["Kupac", `${d.customerName} (${CUSTOMER_TYPE[d.customerType]})`],
      ["Firma", d.customerType === "mechanic" ? "" : (d.companyName ?? "")],
      ["Telefon", phoneValue(d.phone)],
      ["E-pošta", d.email],
      ["Dostava", d.deliveryLabel],
      ["Plaćanje", d.paymentLabel],
      ["Izvor", d.source],
      ["Napomena kupca", d.note ?? ""],
    ]),
    d.hasBackorder ? notice("warning", "Ima stavki po porudžbini", "Proverite rok kod dobavljača pre potvrde.") : null,
    linesBlock(d.lines, d.moreLines, [["Ukupno sa PDV-om", rsd(d.totalPara), { strong: true }]]),
    button("Otvorite porudžbinu", d.adminUrl),
  );
  return staffFrame(ctx, {
    subject: `Nova porudžbina ${d.number} — ${rsd(d.totalPara)}`,
    preheader: `${d.customerName}, ${d.itemCount} kom · ${d.deliveryLabel} · ${d.paymentLabel}`,
    reference: d.number,
    body,
  });
}

function inquirySubjectTail(d: StaffInquiryEmailData): string {
  const parts = [d.vehicleLabel, d.categoryLabels[0]].filter(Boolean);
  if (parts.length) return parts.join(", ");
  const excerpt = d.messageExcerpt.replace(/\s+/g, " ").trim();
  return excerpt.length > 40 ? `${excerpt.slice(0, 40).trim()}…` : excerpt;
}

export function staffInquiryNew(d: StaffInquiryEmailData, ctx: EmailContext): RenderedEmail {
  const body = join(
    heading(`Novi upit ${d.number}`),
    d.isMechanic ? notice("info", "Upit šalje odobreni majstor") : null,
    facts([
      ["Kupac", d.name],
      ["Telefon", phoneValue(d.phone)],
      ["E-pošta", d.email ?? ""],
      ["Odgovor želi", CHANNEL_LABEL[d.preferredChannel]],
      ["Vozilo", d.vehicleLabel ?? ""],
      ["VIN", d.vin ?? "", { mono: true }],
      ["Traži", d.categoryLabels.join(", ")],
      ["Brojevi", d.requestedCodes.slice(0, 12).join(", "), { mono: true }],
      ["Fotografije", d.photoCount ? String(d.photoCount) : ""],
    ]),
    d.messageExcerpt ? notice("info", "Poruka", d.messageExcerpt) : null,
    button("Otvorite upit", d.adminUrl),
  );
  const tail = inquirySubjectTail(d);
  return staffFrame(ctx, {
    subject: `Novi upit ${d.number}${tail ? ` — ${tail}` : ""}`,
    preheader: `${d.name} · odgovor ${CHANNEL_LABEL[d.preferredChannel]}`,
    reference: d.number,
    body,
  });
}

export function staffMechanicNew(d: StaffMechanicEmailData, ctx: EmailContext): RenderedEmail {
  const body = join(
    heading("Nova registracija majstora"),
    paragraph(`**${d.companyName}** čeka odobrenje. Proverite PIB i dodelite razred.`),
    facts([
      ["Servis", d.companyName],
      ["PIB", d.pib, { mono: true }],
      ["Grad", d.city],
      ["Kontakt osoba", d.contactPerson],
      ["Telefon", phoneValue(d.phone)],
      ["E-pošta", d.email],
      ["Vrsta servisa", d.serviceTypes.join(", ")],
    ]),
    button("Pregledajte registraciju", d.adminUrl),
  );
  return staffFrame(ctx, {
    subject: `Nova registracija majstora — ${d.companyName}`,
    preheader: `${d.city} · ${d.contactPerson}`,
    body,
  });
}

export function staffQuoteAccepted(d: StaffQuoteEmailData, ctx: EmailContext): RenderedEmail {
  const body = join(
    heading("Ponuda je prihvaćena."),
    paragraph(
      `Ponuda za upit **${d.number}** je prihvaćena (kupac: ${d.customerName})${d.orderNumber ? `; napravljena je porudžbina **${d.orderNumber}**` : ""}.`,
    ),
    d.totalPara !== undefined ? facts([["Ukupno", rsd(d.totalPara), { strong: true }]]) : null,
    button(d.orderNumber ? "Otvorite porudžbinu" : "Otvorite upit", d.adminUrl),
  );
  return staffFrame(ctx, {
    subject: `Ponuda prihvaćena — ${d.number}${d.orderNumber ? ` → ${d.orderNumber}` : ""}`,
    preheader: "Porudžbina čeka potvrdu.",
    reference: d.number,
    body,
  });
}

export function staffQuoteRenewal(d: StaffQuoteEmailData, ctx: EmailContext): RenderedEmail {
  const body = join(
    heading("Kupac traži novu ponudu."),
    paragraph(
      `Ponuda za upit **${d.number}** je istekla, a ${d.customerName} traži obnovljenu. Proverite cene i rok pa pošaljite novu verziju.`,
    ),
    button("Otvorite upit", d.adminUrl),
  );
  return staffFrame(ctx, {
    subject: `Traži se nova ponuda — ${d.number}`,
    preheader: `${d.customerName} čeka obnovljenu ponudu.`,
    reference: d.number,
    body,
  });
}

export function staffLowStock(d: StaffLowStockEmailData, ctx: EmailContext): RenderedEmail {
  const shown = d.items.slice(0, 30);
  const body = join(
    heading(`Malo na stanju: ${d.total} ${plural(d.total, ["artikal", "artikla", "artikala"])}`),
    paragraph("Artikli koji su u poslednjem satu pali na prag zaliha ili ispod njega."),
    facts(
      shown.map(
        (i) =>
          [i.sku, `[${i.name}](${i.url}) — ${i.qty === 0 ? "nema na stanju" : `ostalo ${i.qty} kom`}`] as const,
      ),
    ),
    d.total > shown.length
      ? paragraph(`I još ${d.total - shown.length} u lageru.`, { muted: true })
      : null,
    button("Otvorite lager", d.adminUrl),
  );
  return staffFrame(ctx, {
    subject: `Malo na stanju: ${d.total} ${plural(d.total, ["artikal", "artikla", "artikala"])}`,
    preheader: shown
      .slice(0, 3)
      .map((i) => i.sku)
      .join(", "),
    body,
  });
}

export function staffDailyDigest(d: StaffDigestEmailData, ctx: EmailContext): RenderedEmail {
  const waiting = d.openInquiryCount;
  const subject = `Pregled za ${date(d.day)} — ${d.orders.count} ${plural(d.orders.count, [
    "porudžbina",
    "porudžbine",
    "porudžbina",
  ])}, ${waiting} ${plural(waiting, ["upit", "upita", "upita"])} bez odgovora`;
  const body = join(
    heading(`Pregled za ${date(d.day)}`),
    facts([
      ["Porudžbine", `${d.orders.count} · ${rsd(d.orders.valuePara)}`, { strong: true }],
      ["Otkazane", d.orders.cancelled ? String(d.orders.cancelled) : ""],
      ["Novi upiti", String(d.inquiriesReceived)],
      ["Registracije majstora", d.registrations ? String(d.registrations) : ""],
    ]),
    subheading(`Čeka potvrdu (${d.openOrderCount})`),
    d.openOrders.length
      ? bullets(d.openOrders.map((o) => `[${o.number}](${o.url}) — ${o.ageLabel}`))
      : paragraph("Nijedna porudžbina ne čeka potvrdu.", { muted: true }),
    subheading(`Upiti bez odgovora (${waiting})`),
    d.openInquiries.length
      ? bullets(d.openInquiries.map((o) => `[${o.number}](${o.url}) — ${o.ageLabel}`))
      : paragraph("Svi upiti imaju odgovor.", { muted: true }),
    d.pendingMechanics.length ? subheading(`Majstori čekaju odobrenje (${d.pendingMechanics.length})`) : null,
    d.pendingMechanics.length
      ? bullets(d.pendingMechanics.map((m) => `[${m.companyName}](${m.url})`))
      : null,
    subheading("Lager"),
    paragraph(
      d.lowStockCount || d.outOfStockCount
        ? `Bez zaliha: **${d.outOfStockCount}** · malo na stanju: **${d.lowStockCount}**. [Otvorite lager](${d.stockUrl})`
        : "Nema artikala ispod praga.",
    ),
    d.zeroSearches.length ? subheading("Traženo, a nemamo") : null,
    d.zeroSearches.length
      ? bullets(d.zeroSearches.map((s) => `${s.query} — ${s.count}×`))
      : null,
    d.zeroSearches.length ? paragraph(`[Sve pretrage](${d.searchesUrl})`, { muted: true }) : null,
    button("Otvorite kontrolnu tablu", d.dashboardUrl),
  );
  return staffFrame(ctx, {
    subject,
    preheader: `Juče ${rsd(d.orders.valuePara)} · ${d.openOrderCount} čeka potvrdu · ${waiting} upita bez odgovora`,
    body,
  });
}

export function staffReminder(d: StaffReminderEmailData, ctx: EmailContext): RenderedEmail {
  const isOrder = d.target === "order";
  const what = isOrder ? `Porudžbina ${d.number} čeka potvrdu` : `Upit ${d.number} čeka odgovor`;
  const prefix = d.level >= 2 ? "Drugi podsetnik" : "Podsetnik";
  const body = join(
    heading(`${what}.`),
    paragraph(`${d.customerName} čeka **${d.ageLabel}** radnog vremena.`),
    d.level >= 2
      ? notice("warning", "Drugi podsetnik", "Kupac verovatno već traži drugde. Javite se danas.")
      : null,
    button(isOrder ? "Otvorite porudžbinu" : "Otvorite upit", d.url),
  );
  return staffFrame(ctx, {
    subject: `${prefix}: ${what.charAt(0).toLowerCase()}${what.slice(1)}`,
    preheader: `${d.customerName} čeka ${d.ageLabel} radnog vremena.`,
    reference: d.number,
    body,
  });
}
