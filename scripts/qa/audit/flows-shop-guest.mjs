/**
 * flows-shop: every delivery × payment combination a guest can pick, submitted through the UI,
 * verified with testing:orderProbe and the confirmation / status / predračun pages.
 */
import { BASE, launch, newContext, shot, watch } from "./kit.mjs";
import { P, addToCart, checkout, probeOrder, saveJson, ACCOUNTS } from "./flows-shop-lib.mjs";

const stamp = Date.now();
const cases = [
  { id: "G1", w: 390, items: [[P.cheap, 1]], delivery: "pickup", payment: /Gotovinom pri preuzimanju/, expectTotal: "1.490" },
  { id: "G2", w: 1440, items: [[P.abs, 1]], delivery: "pickup", payment: /Karticom pri preuzimanju/, expectTotal: "2.590" },
  { id: "G3", w: 390, items: [[P.disc256, 1]], delivery: "courier", payment: /Pouzećem/, expectTotal: "4.440" },
  { id: "G4", w: 1440, items: [[P.caliper, 1]], delivery: "courier", payment: /Pouzećem/, expectTotal: "11.900" },
  { id: "G5", w: 390, items: [[P.cheap, 2]], delivery: "pickup", payment: /Virmanom uz predračun/, company: true, expectTotal: "2.980" },
  { id: "G6", w: 1440, items: [[P.disc256, 1]], delivery: "courier", payment: /Virmanom uz predračun/, company: true, expectTotal: "4.440" },
];
const only = process.argv[2]?.split(",");

const browser = await launch();
const results = [];
for (const c of cases) {
  if (only && !only.includes(c.id)) continue;
  const ctx = await newContext(browser, { width: c.w, height: c.w < 1024 ? 844 : 900, tag: `flows-${c.id}` });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(120_000);
  const log = watch(page);
  const r = { id: c.id, width: c.w };
  try {
    for (const [slug, qty] of c.items) await addToCart(page, slug, qty);
    const res = await checkout(page, {
      firstName: "Marko",
      lastName: "Petrović",
      phone: "064 123 4567",
      email: `audit-flows-${c.id.toLowerCase()}-${stamp}@primer.rs`,
      company: c.company ? { name: "Radionica Test d.o.o.", pib: ACCOUNTS.pib, mb: ACCOUNTS.mb } : null,
      delivery: c.delivery,
      address: { street: "Bulevar oslobođenja 12", postalCode: "21000", city: "Novi Sad" },
      payment: c.payment,
      beforeSubmit: async (p) => {
        await shot(p, `flows-shop/${c.id}-review-${c.w}`);
      },
    });
    Object.assign(r, res);
    await page.waitForTimeout(1500);
    await shot(page, `flows-shop/${c.id}-thanks-${c.w}`);
    r.thanksText = (await page.locator("main").innerText()).slice(0, 1500);
    r.probe = probeOrder(res.number);
    // status page
    await page.goto(`${BASE}/porudzbina/${res.token}`, { waitUntil: "load" });
    r.statusText = (await page.locator("main").innerText()).slice(0, 2500);
    await shot(page, `flows-shop/${c.id}-status-${c.w}`, { fullPage: true });
    const pr = await page.goto(`${BASE}/porudzbina/${res.token}/predracun`, { waitUntil: "load" });
    r.proformaStatus = pr?.status();
    r.proformaText = (await page.locator("body").innerText()).slice(0, 2500);
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
saveJson(`guest-orders${only ? "-" + only.join("_") : ""}`, results);
