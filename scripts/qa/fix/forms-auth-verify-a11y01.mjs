/**
 * Step 22 re-verification of A11Y-01 (forms-auth package): the checkout error summary takes
 * focus only on a failed „Dalje“ / „Pošalji porudžbinu“, never on blur/change revalidation.
 * Same steps as scripts/qa/audit/verify-a11y-store-01.mjs plus regression checks (second failed
 * attempt with an unchanged error count, successful Dalje, terms step), evidence under
 * docs/qa/fix/forms-auth/verify/.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/forms-auth-verify-a11y01.mjs <width> [engine] [reduce]
 */
import { writeFileSync } from "node:fs";
import { launch, newContext, shot, watch, BASE } from "../audit/kit.mjs";

const width = Number(process.argv[2] ?? 1440);
const engine = process.argv[3] ?? "chromium";
const reduced = process.argv[4] === "reduce";
const height = width < 1024 ? 844 : 900;
const tag = `a11y01-${width}-${engine}${reduced ? "-reduce" : ""}`;
const rec = { width, engine, reducedMotion: reduced };
const note = (k, v) => {
  rec[k] = v;
  console.log("--", k, JSON.stringify(v).slice(0, 500));
};
const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    return `${el.tagName.toLowerCase()}${el.getAttribute("role") ? "[" + el.getAttribute("role") + "]" : ""}#${el.id || ""} "${(el.textContent || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 40)}"`;
  });
const vals = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      ["co-firstName", "co-lastName", "co-phone", "co-email"].map((id) => [
        id,
        document.getElementById(id)?.value,
      ]),
    ),
  );
const summary = (page) =>
  page.evaluate(
    () =>
      document.querySelector("form [role=alert]")?.querySelector("p")?.textContent?.trim() ?? null,
  );

const browser = await launch(engine);
try {
  const ctx = await newContext(browser, {
    width,
    height,
    tag,
    engine,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", {
    waitUntil: "load",
    timeout: 180000,
  });
  await page.waitForTimeout(2000);
  await page.getByTestId("product-add-to-cart").first().click();
  await page.waitForTimeout(2000);
  await page.goto(BASE + "/porudzbina", { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.locator("#co-firstName").waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => sessionStorage.removeItem("sk.checkout.v1"));

  // S0: no submit yet, Tab through the empty Ime (blur revalidation only).
  await page.locator("#co-firstName").focus();
  await page.keyboard.press("Tab");
  await page.waitForTimeout(700);
  note("S0 after Tab through empty Ime, no submit (expect #co-lastName)", await act(page));
  note("S0 summary", await summary(page));

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#co-firstName").waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);

  // A: keyboard (reviewer steps).
  await page.getByTestId("checkout-next").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  note("A1 after empty Dalje (expect summary)", await act(page));
  note("A1 summary", await summary(page));
  await page.locator("#co-firstName").focus();
  await page.keyboard.type("Petar", { delay: 40 });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(800);
  note("A3 after Tab from fixed Ime (expect #co-lastName)", await act(page));
  note("A3 summary", await summary(page));
  await page.keyboard.type("Petrović", { delay: 40 });
  await page.waitForTimeout(300);
  note("A4 values after typing (expect lastName Petrović)", await vals(page));
  await shot(page, `../fix/forms-auth/verify/a11y01-kbd-${tag}`);

  // B: mouse; per-keystroke focus while typing into a touched field.
  await page.locator("#co-lastName").click();
  await page.keyboard.press("End");
  for (let i = 0; i < 8; i++) await page.keyboard.press("Backspace");
  const typedLog = [];
  for (const ch of "Petrovic") {
    await page.keyboard.type(ch);
    await page.waitForTimeout(120);
    typedLog.push(`${ch}:${(await act(page)).slice(0, 22)}`);
  }
  note("B1 per-keystroke focus while typing Prezime (expect input#co-lastName)", typedLog);
  await page.locator("#co-phone").click();
  await page.waitForTimeout(800);
  note("B2 after click Telefon (expect #co-phone)", await act(page));
  await page.keyboard.type("0641234567", { delay: 30 });
  await page.waitForTimeout(300);
  note("B3 values", await vals(page));
  note("B3 summary", await summary(page));
  await shot(page, `../fix/forms-auth/verify/a11y01-mouse-${tag}`);

  // C: second failed Dalje with an unchanged error count → the summary takes focus again.
  await page.locator("#co-email").click();
  await page.locator("#co-phone").click();
  await page.waitForTimeout(400);
  const before = await summary(page);
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(900);
  note("C second failed Dalje (summary before / after)", { before, after: await summary(page) });
  note("C focus (expect summary)", await act(page));
  // Fix e-mail, Tab away: focus stays where the user put it; the summary disappears.
  await page.locator("#co-email").fill(`verify-a11y01-${Date.now()}@primer.rs`);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(700);
  note("C after fixing e-mail and Tab (expect not the summary)", await act(page));
  note("C summary after fix (expect null)", await summary(page));

  // D: successful Dalje → step heading, not a stale summary.
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(1200);
  note("D after successful Dalje (expect h2#step-title)", await act(page));

  // E: continue to the terms step, submit without terms.
  for (let i = 0; i < 4; i++) {
    if (await page.getByTestId("checkout-submit").count()) break;
    await page.getByTestId("checkout-next").click();
    await page.waitForTimeout(1200);
  }
  note("E on terms step", Boolean(await page.getByTestId("checkout-submit").count()));
  await page.getByTestId("checkout-submit").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  note("E after submit without terms (expect summary)", await act(page));
  note("E summary", await summary(page));
  await page.locator("#co-terms").focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(600);
  note("E after checking terms (expect #co-terms)", await act(page));
  note("E summary after checking terms (expect null)", await summary(page));
  // Uncheck again: a new error from change revalidation must not move focus either.
  await page.keyboard.press("Space");
  await page.waitForTimeout(600);
  note("E after unchecking terms (expect #co-terms)", await act(page));
  await page.keyboard.press("Space");
  await page.keyboard.press("Shift+Tab");
  await page.waitForTimeout(600);
  note("E checked again + Shift+Tab: focus (expect not the summary)", await act(page));
  note("E summary after blur of the checked box (expect null)", await summary(page));
  await shot(page, `../fix/forms-auth/verify/a11y01-terms-${tag}`);
  note("console/page errors", { console: log.console, pageErrors: log.pageErrors });
  await ctx.close();
} finally {
  await browser.close();
}
writeFileSync(`docs/qa/fix/forms-auth/verify/a11y01-${tag}.json`, JSON.stringify(rec, null, 1));
