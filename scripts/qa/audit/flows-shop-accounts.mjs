/**
 * flows-shop: signed-in checkout — audit customer (retail) and approved mechanic (Majstor Plus,
 * deferred payment). Also: guest cart → sign-in merge. Evidence under docs/qa/audit/flows-shop/.
 */
import { BASE, launch, newContext, shot, watch } from "./kit.mjs";
import { ACCOUNTS, P, addToCart, cartLines, checkout, probeOrder, saveJson, signIn as loginWith } from "./flows-shop-lib.mjs";

const only = process.argv[2]?.split(",");
const cases = [
  { id: "C1", who: "customer", w: 390, merge: true, items: [[P.cheap, 1]], delivery: "pickup", payment: /Gotovinom pri preuzimanju/ },
  { id: "C2", who: "customer", w: 1440, items: [[P.disc256, 1]], delivery: "courier", payment: /Pouzećem/ },
  { id: "C3", who: "customer", w: 390, items: [[P.abs, 1]], delivery: "courier", payment: /Virmanom uz predračun/, company: true },
  { id: "M1", who: "mechanic", w: 390, items: [[P.disc256, 1]], delivery: "courier", payment: /Odloženo plaćanje/ },
  { id: "M2", who: "mechanic", w: 1440, items: [[P.caliper, 1]], delivery: "pickup", payment: /Odloženo plaćanje/ },
  { id: "M3", who: "mechanic", w: 1440, items: [[P.abs, 2]], delivery: "courier", payment: /Virmanom uz predračun/ },
  { id: "M4", who: "mechanic", w: 390, items: [[P.cheap, 1]], delivery: "pickup", payment: /Karticom pri preuzimanju/ },
];


const browser = await launch();
const results = [];
for (const c of cases) {
  if (only && !only.includes(c.id)) continue;
  const ctx = await newContext(browser, { width: c.w, height: c.w < 1024 ? 844 : 900, tag: `flows-${c.id}` });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(120_000);
  const log = watch(page);
  const acct = ACCOUNTS[c.who];
  const r = { id: c.id, who: c.who, width: c.w };
  try {
    if (c.merge) {
      // guest adds first, then signs in: the guest line must merge into the account cart
      await addToCart(page, c.items[0][0], c.items[0][1]);
      r.guestCart = await cartLines(page);
      await loginWith(page, acct.email, acct.password, "/nalog");
      await page.waitForTimeout(2500);
      r.cartAfterLogin = await cartLines(page);
      await shot(page, `flows-shop/${c.id}-cart-after-merge-${c.w}`);
    } else {
      await loginWith(page, acct.email, acct.password, c.who === "mechanic" ? "/majstor" : "/nalog");
      r.preexistingCart = await cartLines(page);
      for (const [slug, qty] of c.items) await addToCart(page, slug, qty);
    }
    r.cartBefore = await cartLines(page);
    if (c.who === "mechanic") await shot(page, `flows-shop/${c.id}-cart-${c.w}`);
    const res = await checkout(page, {
      // keep prefilled values for signed-in users; fill phone only if empty
      company: c.company ? { name: "Kupac Firma d.o.o.", pib: ACCOUNTS.pib, mb: ACCOUNTS.mb } : c.who === "mechanic" ? "keep" : null,
      phone: c.who === "customer" ? "064 555 0101" : undefined,
      delivery: c.delivery,
      address: { street: "Radnička 7", postalCode: "11000", city: "Beograd" },
      payment: c.payment,
      beforeSubmit: async (p) => {
        await shot(p, `flows-shop/${c.id}-review-${c.w}`);
        if (c.w < 1024) {
          await p.locator("details summary").first().click();
          await p.waitForTimeout(300);
          await shot(p, `flows-shop/${c.id}-summary-${c.w}`, { locator: p.locator("details").first() });
        } else {
          await shot(p, `flows-shop/${c.id}-summary-${c.w}`, { locator: p.locator('aside[aria-label="Pregled porudžbine"]') });
        }
        r.prefill = await p.evaluate(() => sessionStorage.getItem("sk.checkout.v1"));
      },
    });
    Object.assign(r, res);
    r.probe = probeOrder(res.number);
    await page.waitForTimeout(1200);
    r.thanksText = (await page.locator("main").innerText()).slice(0, 1800);
    await shot(page, `flows-shop/${c.id}-thanks-${c.w}`);
    await page.goto(`${BASE}/porudzbina/${res.token}/predracun`, { waitUntil: "load" });
    r.proformaText = (await page.locator("main").innerText().catch(() => page.locator("body").innerText())).slice(0, 1800);
    await shot(page, `flows-shop/${c.id}-predracun-${c.w}`, { fullPage: true });
  } catch (e) {
    r.error = String(e).slice(0, 600);
    await shot(page, `flows-shop/${c.id}-error-${c.w}`).catch(() => {});
  }
  r.log = log;
  results.push(r);
  console.log(c.id, r.number, r.total, r.error ?? "", JSON.stringify(r.probe));
  await ctx.close();
}
await browser.close();
saveJson(`account-orders${only ? "-" + only.join("_") : ""}`, results);
