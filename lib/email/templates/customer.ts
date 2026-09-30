/** Customer inquiry / quote / back-in-stock e-mails, mechanic account and auth e-mails. */
import { contactSentence, type EmailContext } from "../context";
import {
  bullets,
  button,
  code,
  facts,
  heading,
  join,
  linkLine,
  notice,
  paragraph,
  subheading,
  type RenderedEmail,
} from "../html";
import type {
  BackInStockEmailData,
  InquiryEmailData,
  MechanicEmailData,
  PasswordResetEmailData,
  StaffInviteEmailData,
} from "../types";
import { CHANNEL_LABEL, dateTime, date, frame, linesBlock, rsd } from "./shared";

function questions(ctx: EmailContext) {
  return paragraph(`Pitanja? ${contactSentence(ctx)}`, { muted: true });
}

// Inquiries and quotes -----------------------------------------------------------------

export function inquiryReceived(d: InquiryEmailData, ctx: EmailContext): RenderedEmail {
  const body = join(
    heading("Upit je primljen."),
    paragraph(
      `Upit **${d.number}** je kod nas. Tražimo deo po podacima koje ste poslali i javljamo vam ponudu sa cenom i rokom ${CHANNEL_LABEL[d.preferredChannel]}.`,
    ),
    facts([
      ["Vozilo", d.vehicleLabel ?? ""],
      ["Broj šasije (VIN)", d.vin ?? "", { mono: true }],
      ["Traženi brojevi", d.requestedCodes.slice(0, 10).join(", "), { mono: true }],
      ["Fotografije", d.photoCount > 0 ? String(d.photoCount) : ""],
      ["Poruka", d.messageExcerpt],
    ]),
    button("Status upita", d.statusUrl),
    questions(ctx),
  );
  return frame(ctx, {
    subject: `Upit ${d.number} je primljen`,
    preheader: `Javljamo ponudu sa cenom i rokom ${CHANNEL_LABEL[d.preferredChannel]}.`,
    reference: d.number,
    body,
    audience: "customer",
    whatsappText: `Upit ${d.number}`,
  });
}

export function quoteReady(d: InquiryEmailData, ctx: EmailContext): RenderedEmail {
  const q = d.quote;
  const body = join(
    heading("Ponuda je spremna."),
    paragraph(
      `Za upit **${d.number}**${d.vehicleLabel ? ` (${d.vehicleLabel})` : ""} našli smo sledeće. Cene su sa PDV-om.`,
    ),
    q ? linesBlock(q.lines, 0, [["Ukupno sa PDV-om", rsd(q.totalPara), { strong: true }]]) : null,
    q ? facts([["Ponuda važi do", dateTime(q.validUntil)]]) : null,
    q?.deliveryNote ? paragraph(q.deliveryNote) : null,
    button("Pogledajte i prihvatite ponudu", d.statusUrl),
    paragraph(
      "Kad prihvatite ponudu, pravimo porudžbinu po ovim cenama. Plaćate pouzećem, pri preuzimanju ili virmanom — ništa unapred preko sajta.",
      { muted: true },
    ),
    questions(ctx),
  );
  return frame(ctx, {
    subject: `Ponuda za upit ${d.number} je spremna`,
    preheader: q
      ? `Ukupno ${rsd(q.totalPara)}, važi do ${date(q.validUntil)}.`
      : "Ponuda je na stranici upita.",
    reference: d.number,
    body,
    audience: "customer",
    whatsappText: `Upit ${d.number}`,
  });
}

export function quoteExpiring(d: InquiryEmailData, ctx: EmailContext): RenderedEmail {
  const until = d.quote ? dateTime(d.quote.validUntil) : "";
  const body = join(
    heading("Ponuda uskoro ističe."),
    paragraph(
      `Ponuda za upit **${d.number}** važi do **${until}**. Posle toga cene i rok moramo ponovo da proverimo kod dobavljača.`,
    ),
    d.quote
      ? facts([
          ["Ukupno sa PDV-om", rsd(d.quote.totalPara), { strong: true }],
          ["Stavki", String(d.quote.lines.length)],
        ])
      : null,
    button("Pogledajte ponudu", d.statusUrl),
    questions(ctx),
  );
  return frame(ctx, {
    subject: `Ponuda za upit ${d.number} ističe ${d.quote ? date(d.quote.validUntil) : ""}`.trim(),
    preheader: `Ponuda važi do ${until}.`,
    reference: d.number,
    body,
    audience: "customer",
    whatsappText: `Upit ${d.number}`,
  });
}

export function backInStock(d: BackInStockEmailData, ctx: EmailContext): RenderedEmail {
  const body = join(
    heading("Stiglo je."),
    paragraph(`Artikal koji ste tražili je ponovo na stanju.`),
    facts([
      ["Artikal", `**${d.productName}**`],
      ["Šifra", d.sku, { mono: true }],
      ["Proizvođač", d.manufacturer],
      ["Cena sa PDV-om", rsd(d.pricePara), { strong: true }],
      ["Stanje", d.stockLabel],
    ]),
    button("Pogledajte artikal", d.productUrl),
    paragraph(
      "Količine su ograničene i ne rezervišemo ih bez porudžbine. Ovo obaveštenje šaljemo samo jednom.",
      { muted: true },
    ),
  );
  return frame(ctx, {
    subject: `Stiglo je: ${d.productName}`,
    preheader: `${d.productName} je ponovo na stanju. Cena ${rsd(d.pricePara)}.`,
    body,
    audience: "customer",
    reason: "Ovu poruku ste dobili jer ste tražili da vam javimo kad artikal stigne.",
    manageLink: { label: "Odjavite sva obaveštenja o dolasku robe.", href: d.unsubscribeUrl },
  });
}

// Mechanics -----------------------------------------------------------------------------

export function mechanicRegistrationReceived(
  d: MechanicEmailData,
  ctx: EmailContext,
): RenderedEmail {
  const body = join(
    heading("Registracija je primljena."),
    paragraph(
      `Proveravamo podatke servisa **${d.companyName}**. Kad odobrimo nalog, stiže vam e-mail i od tada na celom sajtu vidite svoje cene.`,
    ),
    facts([
      ["Servis", d.companyName],
      ["Kontakt osoba", d.contactPerson],
      ["E-pošta naloga", d.email],
    ]),
    paragraph("Do odobrenja možete da poručujete po maloprodajnim cenama."),
    button("Status registracije", d.portalUrl),
    questions(ctx),
  );
  return frame(ctx, {
    subject: "Registracija servisa je primljena",
    preheader: "Proveravamo podatke; javljamo se kad odobrimo nalog.",
    body,
    audience: "account",
  });
}

export function mechanicApproved(d: MechanicEmailData, ctx: EmailContext): RenderedEmail {
  const tier = d.tierName ? `${d.tierName}${d.discountLabel ? ` (${d.discountLabel})` : ""}` : "";
  const body = join(
    heading("Nalog je odobren."),
    paragraph(
      "Od sada na celom sajtu vidite svoje cene: maloprodajna je precrtana, a pored nje piše „Vaša cena“.",
    ),
    facts([
      ["Servis", d.companyName],
      ["Razred", tier],
      [
        "Odloženo plaćanje",
        d.creditEnabled ? `odobreno, rok ${d.paymentTermsDays ?? 15} dana` : "",
      ],
    ]),
    subheading("Šta dobijate u portalu"),
    bullets([
      "**Brza porudžbina** — nalepite listu OEM brojeva sa količinama, sistem nalazi delove.",
      "**Istorija i „Poruči ponovo“** — ista porudžbina u dva klika.",
      "**Vozila mušterija** — VIN, tablice i beleške na jednom mestu.",
      "**Cenovnik u Excelu** — sa vašim cenama za izabrane kategorije.",
    ]),
    button("Otvorite portal za majstore", d.portalUrl),
    paragraph(
      `Prijavljujete se adresom ${d.email} i lozinkom koju ste izabrali pri registraciji. [Prijava](${d.loginUrl})`,
      { muted: true },
    ),
  );
  return frame(ctx, {
    subject: tier ? `Nalog je odobren — ${tier}` : "Nalog je odobren",
    preheader: "Od sada na sajtu vidite svoje cene.",
    body,
    audience: "account",
  });
}

export function mechanicRejected(d: MechanicEmailData, ctx: EmailContext): RenderedEmail {
  const body = join(
    heading("Registracija nije odobrena."),
    paragraph(`Registraciju servisa **${d.companyName}** ovog puta nismo odobrili.`),
    facts([["Razlog", d.reason ?? ""]]),
    paragraph(
      `Ako su se podaci promenili ili mislite da je greška, ${contactSentence(ctx).charAt(0).toLowerCase()}${contactSentence(ctx).slice(1)}`,
    ),
    paragraph("Nalog i dalje možete da koristite za poručivanje po maloprodajnim cenama.", {
      muted: true,
    }),
  );
  return frame(ctx, {
    subject: "Registracija nije odobrena",
    preheader: d.reason ? `Razlog: ${d.reason}` : "Registracija servisa nije odobrena.",
    body,
    audience: "account",
  });
}

export function mechanicSuspended(d: MechanicEmailData, ctx: EmailContext): RenderedEmail {
  const body = join(
    heading("Majstorski nalog je pauziran."),
    paragraph(
      `Nalog servisa **${d.companyName}** je privremeno pauziran. Do ponovne aktivacije vidite maloprodajne cene i odloženo plaćanje nije dostupno.`,
    ),
    facts([["Razlog", d.reason ?? ""]]),
    questions(ctx),
  );
  return frame(ctx, {
    subject: "Majstorski nalog je pauziran",
    preheader: "Do ponovne aktivacije vidite maloprodajne cene.",
    body,
    audience: "account",
  });
}

// Account ---------------------------------------------------------------------------------

export function passwordResetCode(d: PasswordResetEmailData, ctx: EmailContext): RenderedEmail {
  const body = join(
    heading("Kod za novu lozinku"),
    paragraph("Upišite ovaj kod na stranici na kojoj ste zatražili novu lozinku."),
    code(d.code, "Kod"),
    paragraph(`Kod važi 15 minuta, do ${dateTime(d.expiresAt)}.`),
    linkLine("Stranica za novu lozinku", d.resetUrl),
    notice(
      "info",
      "Niste vi tražili?",
      "Ignorišite ovu poruku — lozinka ostaje ista. Kod ne šaljite nikome, ni nama.",
    ),
  );
  return frame(ctx, {
    subject: "Kod za novu lozinku",
    preheader: "Kod važi 15 minuta.",
    body,
    audience: "account",
    reason: `Ovu poruku ste dobili jer je za ovu adresu zatražena nova lozinka na sajtu ${ctx.brandName}.`,
  });
}

export function staffInvite(d: StaffInviteEmailData, ctx: EmailContext): RenderedEmail {
  const role = d.role === "owner" ? "vlasnik" : "zaposleni";
  const body = join(
    heading("Pozivnica za administraciju"),
    paragraph(
      `Dobili ste pristup administraciji sajta ${ctx.brandName} (uloga: **${role}**).${d.invitedBy ? ` Pozivnicu šalje: ${d.invitedBy}.` : ""}`,
    ),
    button("Prihvatite pozivnicu", d.inviteUrl),
    paragraph(
      `Link važi do ${dateTime(d.expiresAt)}. Prijavite se ili napravite nalog sa ovom e-adresom — pozivnica važi samo za nju.`,
      { muted: true },
    ),
  );
  return frame(ctx, {
    subject: `Pozivnica za administraciju — ${ctx.brandName}`,
    preheader: `Uloga: ${role}. Link važi 7 dana.`,
    body,
    audience: "account",
    reason: `Ovu poruku ste dobili jer je za vašu adresu napravljena pozivnica u administraciju sajta ${ctx.brandName}.`,
  });
}
