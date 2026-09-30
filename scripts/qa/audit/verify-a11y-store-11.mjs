/**
 * verify a11y-store-11: stray space before the colon in accessible names built from a visible
 * label + an sr-only ": <name>" suffix. Compares Playwright's ariaSnapshot (its own accname
 * implementation) with Chromium's native accessibility tree (CDP Accessibility.getFullAXTree).
 *   node scripts/qa/audit/verify-a11y-store-11.mjs <width> [engine]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { launch, newContext, shot, BASE, loginWith } from "./kit.mjs";

const width = Number(process.argv[2] ?? 1440);
const engine = process.argv[3] ?? "chromium";
const height = width < 1024 ? 844 : 900;
const OUT = "docs/qa/audit/verify/a11y-store";
mkdirSync(OUT, { recursive: true });
const rec = {};
const note = (k, v) => {
  rec[k] = v;
  console.log("--", k, JSON.stringify(v).slice(0, 900));
};

/** Chrome native names of every button/link whose name contains a colon. */
async function nativeNames(page) {
  if (engine !== "chromium") return "n/a (no native AX access outside Chromium)";
  const client = await page.context().newCDPSession(page);
  await client.send("Accessibility.enable");
  const { nodes } = await client.send("Accessibility.getFullAXTree");
  await client.detach();
  return nodes
    .filter((n) => ["button", "link"].includes(n.role?.value) && /:/.test(n.name?.value ?? ""))
    .map((n) => `${n.role.value} "${n.name.value}"`)
    .filter((s) => /Dodaj u korpu|U korpu|Poruči|Obavesti me|Izmeni|omiljen/.test(s));
}
/** Playwright ariaSnapshot lines for the same controls. */
async function pwNames(page, scope = "body") {
  const snap = await page.locator(scope).first().ariaSnapshot();
  return snap
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /Dodaj u korpu|U korpu|Poruči|Obavesti me|Izmeni|omiljen/.test(l) && /:/.test(l));
}
/** Computed display/position of the sr-only suffix spans. */
const srInfo = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("button > span.sr-only, a > span.sr-only, button span.sr-only, a span.sr-only")]
      .filter((s) => s.textContent.trim().startsWith(":"))
      .slice(0, 4)
      .map((s) => {
        const cs = getComputedStyle(s);
        const p = getComputedStyle(s.parentElement);
        return `"${s.textContent.slice(0, 30)}" display=${cs.display} position=${cs.position} parentDisplay=${p.display} parentTag=${s.parentElement.tagName}`;
      }),
  );

const browser = await launch(engine);
const ctx = await newContext(browser, { width, height, tag: `v11-${engine}-${width}`, engine });
const page = await ctx.newPage();

// 1. Product page buy box (in stock)
await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load", timeout: 180000 });
await page.waitForTimeout(2500);
note("product pw", await pwNames(page, "main"));
note("product native", await nativeNames(page));
note("product srInfo", await srInfo(page));
const buy = page.getByTestId("product-add-to-cart").first();
note("product button innerText", await buy.evaluate((b) => b.innerText));
note("product button textContent", await buy.evaluate((b) => b.textContent));
await buy.scrollIntoViewIfNeeded();
await shot(page, `verify/a11y-store/a11y-store-11-reproduce-product-${engine}-${width}`, { locator: buy });

// 2. Out-of-stock product: „Obavesti me“ link (only rendered on cards; PDP uses its own form)
await page.goto(BASE + "/deo/kocione-plocice-prednje-demo-0012", { waitUntil: "load", timeout: 180000 });
await page.waitForTimeout(2000);
note("oos pdp pw", await pwNames(page, "main"));
note("oos pdp native", await nativeNames(page));

// 3. Listing cards
await page.goto(BASE + "/delovi/kocioni-diskovi", { waitUntil: "load", timeout: 180000 });
await page.waitForTimeout(2500);
note("listing pw", (await pwNames(page, "main")).slice(0, 4));
note("listing native", engine === "chromium" ? (await nativeNames(page)).slice(0, 4) : "n/a");

// 4. Checkout stepper (steps 1 → 2 → 3; the order is never submitted)
if (engine === "chromium") {
  await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(2000);
  await page.getByTestId("product-add-to-cart").first().click();
  await page.waitForTimeout(2000);
  await page.goto(BASE + "/porudzbina", { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.locator("#co-firstName").fill("Petar");
  await page.locator("#co-lastName").fill("Petrović");
  await page.locator("#co-phone").fill("064 123 4567");
  await page.locator("#co-email").fill(`audit-verify-a11y-store-${width}-${Date.now()}@primer.rs`);
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(1500);
  const street = page.locator("#co-street");
  if ((await street.count()) && (await street.isVisible())) {
    await street.fill("Bulevar oslobođenja 12");
    await page.locator("#co-postalCode").fill("21000").catch(() => {});
    await page.locator("#co-city").fill("Novi Sad").catch(() => {});
  }
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(1500);
  const nav = page.locator("nav[aria-label='Koraci porudžbine']").first();
  note("stepper pw", await nav.ariaSnapshot().catch((e) => String(e).slice(0, 200)));
  note("stepper native", await nativeNames(page));
  note("stepper srInfo", await srInfo(page));
  await nav.scrollIntoViewIfNeeded().catch(() => {});
  await shot(page, `verify/a11y-store/a11y-store-11-reproduce-stepper-${width}`, { locator: nav }).catch((e) => note("shot err", String(e).slice(0, 120)));
}

// 5. Mechanic favourites
if (engine === "chromium") {
  const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
  const mctx = await newContext(browser, { width, height, tag: `v11m-${width}` });
  const mp = await mctx.newPage();
  await loginWith(mp, acc.mechanic.email, acc.mechanic.password, "/deo/kocioni-disk-prednji-276-24-mm-demo-0004");
  await mp.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load", timeout: 180000 });
  await mp.waitForTimeout(3000);
  note("mechanic pdp pw", await pwNames(mp, "main"));
  note("mechanic pdp native", await nativeNames(mp));
  await mctx.close();
}

writeFileSync(`${OUT}/a11y-store-11-reproduce-${engine}-${width}.json`, JSON.stringify(rec, null, 1));
await browser.close();
