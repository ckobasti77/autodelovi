// vis-commerce: cart (empty, filled), cart drawer, checkout steps incl. company fields and errors,
// at the widths passed on argv (default all 8). Never submits the order.
import { BASE, WIDTHS, launch, newContext, watch, scrollThrough, revealCheck, shot, axe } from "./kit.mjs";
import { cartState, probe, save, settle , harden } from "./vis-commerce-lib.mjs";

const want = process.argv.slice(2);
const widths = want.length ? WIDTHS.filter((w) => want.includes(w.tag)) : WIDTHS;
const doAxe = (tag) => tag === "390" || tag === "1440";

async function advance(page, stepId) {
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(600);
    await page.getByTestId("checkout-next").click();
    try {
      await page.getByTestId(`checkout-step-${stepId}`).waitFor({ timeout: 8000 });
      return;
    } catch {}
  }
  throw new Error(`could not reach ${stepId}`);
}
const browser = await launch();
const results = {};

for (const w of widths) {
  const r = (results[w.tag] = {});
  const T = (n) => `vis-commerce/cart-checkout/${w.tag}-${n}`;

  // ---------- empty cart
  {
    const ctx = await newContext(browser, { width: w.width, height: w.height, tag: `viscom-empty-${w.tag}` });
    const page = harden(await ctx.newPage());
    const log = watch(page);
    await page.goto(`${BASE}/korpa`, { waitUntil: "load", timeout: 90000 });
    await settle(page, 2000);
    await shot(page, T("cart-empty"));
    r.cartEmpty = { probe: await probe(page), reveal: await revealCheck(page), log };
    await page.goto(`${BASE}/porudzbina`, { waitUntil: "load", timeout: 90000 });
    await settle(page, 2000);
    await shot(page, T("checkout-empty"));
    await ctx.close();
  }

  // ---------- filled cart
  const ctx = await browser.newContext({
    ...(await (async () => ({}))()),
    storageState: cartState(),
    viewport: { width: w.width, height: w.height },
    isMobile: w.mobile,
    hasTouch: w.mobile,
    locale: "sr-Latn-RS",
    timezoneId: "Europe/Belgrade",
    userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 SklopAudit-viscom-${w.tag}/${Date.now()}`,
  });
  // storageState carries the consent cookie from setup (rejected), so the banner stays closed.
  const page = harden(await ctx.newPage());
  const log = watch(page);
  await page.goto(`${BASE}/korpa`, { waitUntil: "load", timeout: 90000 });
  await page.getByTestId("cart-line").first().waitFor({ timeout: 30000 });
  await settle(page, 1500);
  await shot(page, T("cart-filled"));
  await scrollThrough(page);
  await shot(page, T("cart-filled-full"), { fullPage: true });
  r.cart = { probe: await probe(page), reveal: await revealCheck(page) };
  if (doAxe(w.tag)) r.cart.axe = await axe(page);

  // drawer
  await page.evaluate(() => window.scrollTo(0, 0));
  let drawerOk = false;
  for (let i = 0; i < 3 && !drawerOk; i++) {
    await page.getByTestId("cart-button").hover().catch(() => {});
    await page.waitForTimeout(800);
    await page.getByTestId("cart-button").click();
    drawerOk = await page.getByTestId("cart-drawer").waitFor({ timeout: 15000 }).then(() => true, () => false);
  }
  if (!drawerOk) console.log(w.tag, "drawer did not open");
  if (drawerOk) {
  await page.waitForTimeout(1200);
  await shot(page, T("drawer"));
  r.drawer = await page.evaluate(() => {
    const d = document.querySelector("[data-testid=cart-drawer]");
    const b = d.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height, scrollH: d.scrollHeight, clientH: d.clientHeight };
  });
  r.drawer.probe = await probe(page);
  if (doAxe(w.tag)) r.drawer.axe = await axe(page, { include: "[data-testid=cart-drawer]" });
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);

  // ---------- checkout
  await page.goto(`${BASE}/porudzbina`, { waitUntil: "load", timeout: 90000 });
  await page.getByTestId("checkout-step-contact").waitFor({ timeout: 30000 });
  await settle(page, 1500);
  await shot(page, T("co-1-contact"));
  r.contact = { probe: await probe(page) };
  if (doAxe(w.tag)) r.contact.axe = await axe(page);
  if (w.width < 1024) {
    await page.locator("form details summary").first().click();
    await page.waitForTimeout(400);
    await shot(page, T("co-1-summary-open"));
    await page.locator("form details summary").first().click();
  }
  // errors
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(900);
  await shot(page, T("co-1-errors"));
  await shot(page, T("co-1-errors-full"), { fullPage: true });
  r.contactErrors = await page.evaluate(() => ({
    active: document.activeElement?.outerHTML.slice(0, 160),
    invalid: [...document.querySelectorAll("[aria-invalid=true]")].map((e) => e.id),
  }));
  // fill + company with an invalid PIB
  await page.getByLabel("Ime", { exact: true }).fill("Dragan");
  await page.getByLabel("Prezime").fill("Petrović");
  await page.getByLabel("Telefon", { exact: true }).fill("064 123 4567");
  await page.getByLabel("E-pošta").fill(`audit-viscom-${w.tag}@primer.rs`);
  await page.getByRole("checkbox", { name: /Kupujem kao firma/ }).click();
  await page.getByLabel("Naziv firme").fill("Auto servis Petrović doo");
  await page.getByLabel("PIB").fill("123456789");
  await page.getByLabel("PIB").blur();
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(900);
  await shot(page, T("co-1-company-error"));
  await page.getByLabel("PIB").fill("154552870");
  await page.getByLabel("Matični broj").fill("64552872");
  await page.getByLabel("PIB").blur();
  await page.waitForTimeout(500);
  await page.getByLabel("Naziv firme").scrollIntoViewIfNeeded();
  await shot(page, T("co-1-company-filled"));
  await advance(page, "delivery");

  // delivery
  await page.waitForTimeout(900);
  await shot(page, T("co-2-delivery"));
  r.delivery = { probe: await probe(page) };
  await page.getByRole("radio", { name: /Kurirska služba/ }).click();
  await page.waitForTimeout(400);
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(900);
  await shot(page, T("co-2-courier-errors"));
  await shot(page, T("co-2-courier-errors-full"), { fullPage: true });
  if (doAxe(w.tag)) r.delivery.axeErrors = await axe(page);
  await page.getByLabel("Ulica i broj").fill("Bulevar oslobođenja 12");
  await page.getByLabel("Poštanski broj").fill("21000");
  await page.getByLabel("Mesto").fill("Novi Sad");
  await page.getByLabel("Mesto").blur();
  await advance(page, "payment");

  // payment
  await page.waitForTimeout(900);
  await shot(page, T("co-3-payment"));
  await shot(page, T("co-3-payment-full"), { fullPage: true });
  r.payment = { probe: await probe(page) };
  if (doAxe(w.tag)) r.payment.axe = await axe(page);
  await advance(page, "review");

  // review
  await page.waitForTimeout(900);
  await shot(page, T("co-4-review"));
  await page.getByTestId("checkout-submit").click();
  await page.waitForTimeout(900);
  await shot(page, T("co-4-review-errors"));
  await page.getByTestId("checkout-submit").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot(page, T("co-4-review-bottom"));
  await shot(page, T("co-4-review-full"), { fullPage: true });
  r.review = { probe: await probe(page) };
  if (doAxe(w.tag)) r.review.axe = await axe(page);
  r.log = log;
  await ctx.close();
  console.log(w.tag, "done", JSON.stringify(log).slice(0, 300));
}

save(`cart-checkout-${widths.map((w) => w.tag).join("_")}`, results);
await browser.close();
