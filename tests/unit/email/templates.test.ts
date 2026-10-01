import { describe, expect, it } from "vitest";

import { adminLink, emailContext, siteLink, type EmailSettingsLike } from "@/lib/email/context";
import { escapeHtml, inlineHtml, inlineText, safeHref } from "@/lib/email/html";
import { renderSample, renderTemplate, TEMPLATE_KEYS, TEMPLATES } from "@/lib/email/registry";
import { SAMPLES } from "@/lib/email/samples";

const SITE = "https://sklop.test";

const FULL: EmailSettingsLike = {
  brand: { name: "SKLOP" },
  company: {
    legalName: "Primer d.o.o.",
    pib: "101234567",
    mb: "21234567",
    address: { street: "Autoput 12", city: "Beograd", postalCode: "11000" },
    phones: [{ label: "Prodaja", e164: "+381641234567" }],
    viber: "+381641234567",
    whatsapp: "+381641234567",
    email: "prodaja@primer.rs",
    bankAccounts: [{ bank: "Banka", account: "160-0000000000000-00" }],
    mapUrl: "https://maps.example/sklop",
  },
  hours: [
    { day: 1, open: "08:00", close: "17:00", closed: false },
    { day: 2, open: "08:00", close: "17:00", closed: false },
    { day: 3, open: "08:00", close: "17:00", closed: false },
    { day: 4, open: "08:00", close: "17:00", closed: false },
    { day: 5, open: "08:00", close: "17:00", closed: false },
    { day: 6, open: "08:00", close: "14:00", closed: false },
    { day: 0, open: "00:00", close: "00:00", closed: true },
  ],
};

const EMPTY: EmailSettingsLike = {
  brand: { name: "SKLOP" },
  company: {
    legalName: "",
    address: { street: "", city: "", postalCode: "" },
    phones: [],
    bankAccounts: [],
  },
  hours: [],
};

const ctx = emailContext(FULL, SITE);
const emptyCtx = emailContext(EMPTY, SITE);

describe("html helpers", () => {
  it("escapes markup and keeps only safe link schemes", () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe(
      "&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;",
    );
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(safeHref("viber://chat?number=%2B381")).toBe("viber://chat?number=%2B381");
    expect(inlineHtml("**<b>**")).toContain("&lt;b&gt;");
    expect(inlineHtml("[x](javascript:alert(1))")).toContain('href="#"');
    expect(inlineText("Vidi [status](https://a.test/x) i **ovo**")).toBe(
      "Vidi status: https://a.test/x i ovo",
    );
  });
});

describe("every template", () => {
  it.each(TEMPLATE_KEYS)("%s renders a complete, safe message", (key) => {
    const r = renderSample(key, ctx);
    expect(r.subject.length).toBeGreaterThan(5);
    expect(r.subject).not.toMatch(/undefined|null|NaN|!/);
    expect(r.preheader.length).toBeGreaterThan(5);
    expect(r.html).toContain('<html lang="sr-Latn-RS"');
    expect(r.html).toContain('name="color-scheme"');
    expect(r.html).toContain("prefers-color-scheme: dark");
    expect(r.html).toContain(escapeHtml(r.preheader).slice(0, 20));
    expect(r.html).not.toMatch(/undefined|NaN|\[object Object\]/);
    expect(r.text).not.toMatch(/undefined|NaN|\[object Object\]|<[a-z]/);
    expect(r.text.length).toBeGreaterThan(60);
    // No lorem, no visible TODO, no emojis.
    expect(`${r.html}${r.text}`).not.toMatch(/lorem|TODO|\p{Extended_Pictographic}/iu);
  });

  it.each(TEMPLATE_KEYS)("%s stays empty-safe without company data", (key) => {
    const r = renderSample(key, emptyCtx);
    expect(r.html).not.toMatch(/Telefon:|Viber:|Radno vreme:|PIB  |undefined/);
    expect(r.text).not.toMatch(/undefined/);
  });

  it("customer links carry UTM, admin links do not", () => {
    expect(siteLink(ctx, "/porudzbina/abc", "order_received")).toBe(
      "https://sklop.test/porudzbina/abc?utm_source=email&utm_medium=transactional&utm_campaign=order_received",
    );
    expect(siteLink(ctx, "/deo/x?a=1", "back_in_stock")).toContain("?a=1&utm_source=email");
    expect(adminLink(ctx, "/admin/porudzbine/SK-2026-000187")).toBe(
      "https://sklop.test/admin/porudzbine/SK-2026-000187",
    );
    expect(renderSample("staff_order_new", ctx).html).not.toContain("utm_source");
  });

  it("footer offers click-to-chat from settings", () => {
    const r = renderSample("order_shipped", ctx);
    expect(r.html).toContain("viber://chat?number=%2B381641234567");
    expect(r.html).toContain("https://wa.me/381641234567?text=Porud%C5%BEbina%20SK-2026-000187");
    expect(r.html).toContain("tel:+381641234567");
  });
});

describe("content rules", () => {
  it("bank transfer confirmation carries the predračun data", () => {
    const r = renderTemplate("order_confirmed", SAMPLES.orderBankTransfer(SITE), ctx);
    expect(r.text).toContain("Poziv na broj: 97 2026000187");
    expect(r.text).toContain("Iznos: 33.260 RSD");
    expect(r.text).toContain("Predračun za štampu");
  });

  it("bank transfer without accounts says the data follows", () => {
    const data = {
      ...SAMPLES.orderBankTransfer(SITE),
      bank: { ...SAMPLES.orderBankTransfer(SITE).bank!, accounts: [] },
    };
    expect(renderTemplate("order_confirmed", data, ctx).text).toContain(
      "Broj računa šaljemo odvojeno",
    );
  });

  it("FLOW-35: a deferred-payment order states its due date and term", () => {
    const base = SAMPLES.orderCourierCod(SITE);
    const data = {
      ...base,
      payment: {
        ...base.payment,
        method: "deferred" as const,
        label: "Odloženo plaćanje",
        dueAt: base.createdAt + 15 * 86_400_000,
      },
    };
    const text = renderTemplate("order_received", data, ctx).text;
    expect(text).toMatch(/Rok plaćanja: \d{2}\.\d{2}\.\d{4}\. \(15 dana\)/);
  });

  it("FLOW-34: phone, e-mail and Viber links print their value once in plain text", () => {
    expect(
      inlineText(
        "Pozovite [+381 64 123 4567](tel:+381641234567) ili pišite na [Viber](viber://chat?number=%2B381641234567).",
      ),
    ).toBe("Pozovite +381 64 123 4567 ili pišite na Viber.");
    // formatPhone keeps the groups together with no-break spaces.
    expect(
      inlineText("Pišite na [Viber](viber://chat?number=%2B381601234567).").replace(/ /g, " "),
    ).toBe("Pišite na Viber (+381 60 123 4567).");
    expect(inlineText("[prodaja@primer.rs](mailto:prodaja@primer.rs)")).toBe("prodaja@primer.rs");
    expect(inlineText("[Odjava.](https://a.test/o)")).toBe("Odjava. https://a.test/o");
  });

  it("consumers get the 14-day withdrawal note, companies and mechanics do not", () => {
    const consumer = renderTemplate("order_delivered", SAMPLES.orderDelivered(SITE), ctx);
    expect(consumer.text).toContain("14 dana");
    const company = renderTemplate(
      "order_delivered",
      { ...SAMPLES.orderDelivered(SITE), company: { name: "Primer d.o.o.", pib: "101234567" } },
      ctx,
    );
    expect(company.text).not.toContain("14 dana");
    const picked = renderTemplate(
      "order_delivered",
      { ...SAMPLES.orderDelivered(SITE), status: "preuzeta" },
      ctx,
    );
    expect(picked.subject).toBe("Porudžbina SK-2026-000187 je preuzeta");
  });

  it("subjects follow the design system (§11.6)", () => {
    expect(renderSample("order_received", ctx).subject).toBe(
      "Porudžbina SK-2026-000187 je primljena",
    );
    expect(renderSample("staff_order_new", ctx).subject).toBe(
      "Nova porudžbina SK-2026-000187 — 33.260 RSD",
    );
    expect(renderSample("staff_inquiry_new", ctx).subject).toBe(
      "Novi upit UP-2026-000045 — Golf VII, turbina",
    );
    expect(renderSample("mechanic_approved", ctx).subject).toBe(
      "Nalog je odobren — Majstor Plus (15 %)",
    );
    expect(renderSample("back_in_stock", ctx).subject).toBe("Stiglo je: Kočione pločice prednje");
    expect(renderSample("staff_low_stock", ctx).subject).toBe("Malo na stanju: 3 artikla");
    expect(renderSample("staff_daily_digest", ctx).subject).toBe(
      "Pregled za 28.09.2026. — 7 porudžbina, 2 upita bez odgovora",
    );
  });

  it("user text is escaped", () => {
    const data = { ...SAMPLES.inquiry(SITE), messageExcerpt: `<script>alert("x")</script>` };
    const r = renderTemplate("inquiry_received", data, ctx);
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("registry keys match their definitions", () => {
    for (const key of TEMPLATE_KEYS) expect(TEMPLATES[key].key).toBe(key);
  });
});

describe("snapshots", () => {
  it.each(TEMPLATE_KEYS)("%s plain text", (key) => {
    const r = renderSample(key, ctx);
    expect({ subject: r.subject, preheader: r.preheader, text: r.text }).toMatchSnapshot();
  });

  it.each(["order_received", "order_confirmed", "staff_order_new", "back_in_stock"] as const)(
    "%s HTML",
    (key) => {
      expect(renderSample(key, ctx).html).toMatchSnapshot();
    },
  );
});
