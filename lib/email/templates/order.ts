/** Customer order e-mails (NOTIFICATIONS §I2; subjects DS §11.6). */
import { contactSentence, type EmailContext, addressLine } from "../context";
import {
  bullets,
  button,
  facts,
  heading,
  join,
  linkLine,
  notice,
  paragraph,
  subheading,
  type Block,
  type FactRow,
  type RenderedEmail,
  type TotalRow,
} from "../html";
import type { OrderEmailData } from "../types";
import { date, frame, linesBlock, rsd } from "./shared";

function totalsRows(d: OrderEmailData): TotalRow[] {
  const rows: TotalRow[] = [];
  if (d.totals.discountPara > 0) {
    rows.push(["Artikli po maloprodajnoj ceni", rsd(d.totals.itemsRetailPara)]);
    rows.push(["Vaš rabat", `−${rsd(d.totals.discountPara)}`]);
  }
  rows.push(["Artikli", rsd(d.totals.itemsPara)]);
  rows.push([
    d.delivery.method === "pickup" ? "Preuzimanje" : "Dostava",
    d.totals.deliveryPara === 0 ? "bez naknade" : rsd(d.totals.deliveryPara),
  ]);
  rows.push(["Ukupno sa PDV-om", rsd(d.totals.totalPara), { strong: true }]);
  rows.push(["U tome PDV", rsd(d.totals.vatPara)]);
  return rows;
}

function deliveryFacts(d: OrderEmailData): FactRow[] {
  return [
    ["Dostava", d.delivery.label],
    ...(d.delivery.address ? ([["Adresa", d.delivery.address]] as FactRow[]) : []),
    ["Plaćanje", d.payment.label],
    ...(d.company ? ([["Firma", `${d.company.name} · PIB ${d.company.pib}`]] as FactRow[]) : []),
  ];
}

function orderBody(d: OrderEmailData): Block {
  return linesBlock(d.lines, d.moreLines, totalsRows(d));
}

function statusButton(d: OrderEmailData): Block {
  return button("Pogledajte status porudžbine", d.statusUrl);
}

function questions(ctx: EmailContext): Block {
  return paragraph(`Pitanja? ${contactSentence(ctx)}`, { muted: true });
}

function whatsappText(d: OrderEmailData): string {
  return `Porudžbina ${d.number}`;
}

function bankBlock(d: OrderEmailData): Block {
  if (!d.bank) return join();
  const accounts = d.bank.accounts;
  const rows: FactRow[] = [
    ["Primalac", d.bank.recipient],
    ...accounts.map(
      (a, i) =>
        [
          accounts.length > 1 ? `Račun ${i + 1}` : "Račun",
          `${a.account} (${a.bank})`,
          { mono: true },
        ] as FactRow,
    ),
    ["Iznos", rsd(d.bank.amountPara), { strong: true }],
    ["Poziv na broj", d.bank.reference, { mono: true }],
    ["Svrha uplate", `Uplata po predračunu ${d.number}`],
  ];
  return join(
    subheading("Podaci za uplatu"),
    accounts.length === 0
      ? notice(
          "warning",
          "Broj računa šaljemo odvojeno",
          "Podaci za uplatu još nisu upisani u sistem; javićemo vam ih telefonom ili e-poštom.",
        )
      : facts(rows),
    d.proformaUrl ? linkLine("Predračun za štampu", d.proformaUrl) : null,
    paragraph(d.payment.instructions, { muted: true }),
  );
}

export function orderReceived(d: OrderEmailData, ctx: EmailContext): RenderedEmail {
  const body = join(
    heading("Porudžbina je primljena."),
    paragraph(
      `Primili smo porudžbinu **${d.number}**. Proveravamo stanje i javljamo se kad je potvrdimo. Ništa ne plaćate unapred.`,
    ),
    d.hasBackorder
      ? notice(
          "warning",
          "Deo stavki je po porudžbini",
          "Tačan rok isporuke za te stavke potvrđujemo zajedno sa porudžbinom.",
        )
      : null,
    orderBody(d),
    facts(deliveryFacts(d)),
    d.payment.method === "bank_transfer"
      ? notice(
          "info",
          "Predračun stiže uz potvrdu",
          "Podatke za uplatu šaljemo kad potvrdimo stanje.",
        )
      : paragraph(d.payment.instructions, { muted: true }),
    statusButton(d),
    questions(ctx),
  );
  return frame(ctx, {
    subject: `Porudžbina ${d.number} je primljena`,
    preheader: `Ukupno ${rsd(d.totals.totalPara)}. Javljamo se kad proverimo stanje i potvrdimo.`,
    reference: d.number,
    body,
    audience: "customer",
    whatsappText: whatsappText(d),
  });
}

export function orderConfirmed(d: OrderEmailData, ctx: EmailContext): RenderedEmail {
  const next =
    d.delivery.method === "pickup"
      ? "Javićemo vam kad bude spremna za preuzimanje."
      : "Šaljemo je kurirskom službom i javljamo broj pošiljke.";
  const preheader =
    d.payment.method === "bank_transfer"
      ? `Uplatite ${rsd(d.totals.totalPara)} sa pozivom na broj ${d.payment.reference}.`
      : next;
  const body = join(
    heading("Porudžbina je potvrđena."),
    paragraph(`Porudžbina **${d.number}** je potvrđena i delovi su rezervisani za vas. ${next}`),
    d.payment.method === "deferred" && d.payment.dueAt
      ? notice("info", `Rok plaćanja: ${date(d.payment.dueAt)}`, d.payment.instructions)
      : null,
    bankBlock(d),
    subheading("Stavke"),
    orderBody(d),
    facts(deliveryFacts(d)),
    statusButton(d),
    questions(ctx),
  );
  return frame(ctx, {
    subject: `Porudžbina ${d.number} je potvrđena`,
    preheader,
    reference: d.number,
    body,
    audience: "customer",
    whatsappText: whatsappText(d),
  });
}

export function orderBackordered(d: OrderEmailData, ctx: EmailContext): RenderedEmail {
  const waiting = d.lines.filter((l) => l.availabilityNote);
  const body = join(
    heading("Čekamo deo za vašu porudžbinu."),
    paragraph(
      `Deo stavki iz porudžbine **${d.number}** trenutno nije na stanju i naručili smo ga. Javljamo se čim stigne — porudžbina ostaje rezervisana za vas.`,
    ),
    waiting.length
      ? bullets(waiting.map((l) => `**${l.name}** — ${l.availabilityNote ?? "po porudžbini"}`))
      : null,
    paragraph(
      "Ako vam deo treba hitno ili želite zamenu drugog proizvođača, javite se — proverićemo šta je odmah dostupno.",
    ),
    statusButton(d),
    questions(ctx),
  );
  return frame(ctx, {
    subject: `Porudžbina ${d.number} čeka deo`,
    preheader: "Deo stavki smo naručili; javljamo se čim stigne.",
    reference: d.number,
    body,
    audience: "customer",
    whatsappText: whatsappText(d),
  });
}

export function orderReadyPickup(d: OrderEmailData, ctx: EmailContext): RenderedEmail {
  const address = addressLine(ctx);
  const payNote =
    d.payment.method === "pickup_cash" || d.payment.method === "pickup_card"
      ? `Pri preuzimanju plaćate ${rsd(d.totals.totalPara)} (${d.payment.label.toLowerCase()}).`
      : d.payment.method === "deferred"
        ? "Plaćanje ide po dogovorenom roku."
        : "";
  const body = join(
    heading("Porudžbina je spremna za preuzimanje."),
    paragraph(
      `Porudžbina **${d.number}** vas čeka u radnji. Ponesite broj porudžbine ili pokažite ovu poruku.`,
    ),
    facts([
      [
        "Adresa",
        address ? (ctx.company.mapUrl ? `[${address}](${ctx.company.mapUrl})` : address) : "",
      ],
      ["Radno vreme", ctx.hoursText],
      ["Za plaćanje", payNote ? rsd(d.totals.totalPara) : "", { strong: true }],
    ]),
    payNote ? paragraph(payNote) : null,
    ctx.company.mapUrl ? button("Otvorite mapu", ctx.company.mapUrl) : statusButton(d),
    ctx.company.mapUrl ? linkLine("Status porudžbine", d.statusUrl) : null,
    questions(ctx),
  );
  return frame(ctx, {
    subject: `Porudžbina ${d.number} je spremna za preuzimanje`,
    preheader: address ? `Preuzimanje: ${address}.` : "Porudžbina vas čeka u radnji.",
    reference: d.number,
    body,
    audience: "customer",
    whatsappText: whatsappText(d),
  });
}

export function orderShipped(d: OrderEmailData, ctx: EmailContext): RenderedEmail {
  const tracking = d.delivery.trackingNumber;
  const body = join(
    heading("Porudžbina je poslata."),
    paragraph(
      `Porudžbinu **${d.number}** smo predali kurirskoj službi${d.delivery.courierName ? ` ${d.delivery.courierName}` : ""}. Kurir obično zove pre dostave.`,
    ),
    facts([
      ["Kurirska služba", d.delivery.courierName ?? ""],
      ["Broj pošiljke", tracking ?? "", { mono: true }],
      ["Adresa", d.delivery.address ?? ""],
      [
        d.payment.method === "cod" ? "Kuriru plaćate" : "Iznos",
        rsd(d.totals.totalPara),
        { strong: d.payment.method === "cod" },
      ],
    ]),
    d.delivery.trackingUrl ? button("Pratite pošiljku", d.delivery.trackingUrl) : statusButton(d),
    d.delivery.trackingUrl ? linkLine("Status porudžbine", d.statusUrl) : null,
    questions(ctx),
  );
  return frame(ctx, {
    subject: `Porudžbina ${d.number} je poslata`,
    preheader: tracking
      ? `Broj pošiljke ${tracking}${d.delivery.courierName ? ` (${d.delivery.courierName})` : ""}.`
      : "Porudžbina je kod kurirske službe.",
    reference: d.number,
    body,
    audience: "customer",
    whatsappText: whatsappText(d),
  });
}

export function orderDelivered(d: OrderEmailData, ctx: EmailContext): RenderedEmail {
  const pickedUp = d.status === "preuzeta";
  const consumer = !d.company && d.customerType !== "mechanic";
  const body = join(
    heading(pickedUp ? "Porudžbina je preuzeta." : "Porudžbina je isporučena."),
    paragraph(
      `Porudžbina **${d.number}** je ${pickedUp ? "preuzeta" : "isporučena"}. Hvala što ste poručili kod nas.`,
    ),
    subheading("Ako nešto ne odgovara"),
    bullets([
      "Proverite deo pre ugradnje: broj na delu, priključke i dimenzije. Ugrađen deo teško vraćamo.",
      "Ako deo ne odgovara ili ima grešku, javite se sa brojem porudžbine — dogovaramo zamenu ili povraćaj.",
      ...(consumer
        ? [
            `Kao potrošač možete da odustanete od kupovine u roku od 14 dana od prijema, bez navođenja razloga. Uslovi i obrazac su na stranici [Reklamacije i povrat](${d.complaintsUrl}).`,
          ]
        : [`Uslovi reklamacije su na stranici [Reklamacije i povrat](${d.complaintsUrl}).`]),
    ]),
    statusButton(d),
    questions(ctx),
  );
  return frame(ctx, {
    subject: `Porudžbina ${d.number} je ${pickedUp ? "preuzeta" : "isporučena"}`,
    preheader: "Proverite deo pre ugradnje; reklamacije i povrat — uslovi u poruci.",
    reference: d.number,
    body,
    audience: "customer",
    whatsappText: whatsappText(d),
  });
}

export function orderCancelled(d: OrderEmailData, ctx: EmailContext): RenderedEmail {
  const body = join(
    heading("Porudžbina je otkazana."),
    paragraph(`Porudžbina **${d.number}** je otkazana.`),
    facts([["Razlog", d.cancelReason ?? ""]]),
    d.payment.method === "bank_transfer"
      ? paragraph(
          "Ako ste već uplatili, javite se — vraćamo novac na račun sa kog je uplata stigla.",
        )
      : null,
    paragraph(
      `Ako je otkazivanje greška ili vam treba zamenski deo, ${contactSentence(ctx).charAt(0).toLowerCase()}${contactSentence(ctx).slice(1)}`,
    ),
    linkLine("Status porudžbine", d.statusUrl),
  );
  return frame(ctx, {
    subject: `Porudžbina ${d.number} je otkazana`,
    preheader: d.cancelReason ? `Razlog: ${d.cancelReason}` : "Porudžbina je otkazana.",
    reference: d.number,
    body,
    audience: "customer",
    whatsappText: whatsappText(d),
  });
}
