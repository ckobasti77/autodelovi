/**
 * a11y-store: inquiry form errors by keyboard, login paste/accessible auth, back-in-stock form,
 * product page media + header / buy box / price / stock aria snapshots (guest + mechanic),
 * 3D hero controls by keyboard.
 *   node scripts/qa/audit/a11y-store-forms.mjs [inquiry|auth|product|mechanic|hero]...
 */
import { readFileSync, writeFileSync } from "node:fs";
import { launch, newContext, watch, shot, axe, loginWith, BASE } from "./kit.mjs";

const want = process.argv.slice(2);
const run = (k) => !want.length || want.includes(k);
const rec = {};
const note = (k, v) => {
  rec[k] = v;
  console.log("--", k, JSON.stringify(v).slice(0, 1600));
};
const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    const r = el.getBoundingClientRect();
    return `${el.tagName.toLowerCase()}${el.getAttribute("role") ? "[" + el.getAttribute("role") + "]" : ""}#${el.id || ""} "${(el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50)}" top=${Math.round(r.top)}`;
  });
const fields = (page, scope = "form") =>
  page.evaluate((scope) =>
    [...document.querySelectorAll(`${scope} input:not([type=hidden]), ${scope} textarea, ${scope} select`)]
      .filter((e) => e.getBoundingClientRect().height > 0 || e.type === "file")
      .map((e) => `${e.id || e.name}(${e.type}): label="${(e.labels?.[0]?.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 40)}" req=${e.required || e.getAttribute("aria-required") || "-"} invalid=${e.getAttribute("aria-invalid") || "-"} ac=${e.getAttribute("autocomplete") || "-"} ph="${e.placeholder || ""}" desc="${(e.getAttribute("aria-describedby") || "").split(" ").map((id) => document.getElementById(id)?.textContent?.trim()).join(" | ").slice(0, 80)}"`),
  scope);
const browser = await launch();

if (run("inquiry")) {
  for (const width of [1440, 390]) {
    const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: `a11yinq${width}` });
    const page = await ctx.newPage();
    await page.goto(BASE + "/upit", { waitUntil: "load", timeout: 180000 });
    await page.waitForTimeout(2500);
    note(`inq${width} fields`, await fields(page));
    const submit = page.locator("form button[type=submit]").last();
    note(`inq${width} submit name`, await submit.textContent());
    await submit.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    const f1 = await act(page);
    await page.waitForTimeout(1200);
    note(`inq${width} focus after empty submit`, [f1, await act(page)]);
    note(`inq${width} fields after`, await fields(page));
    note(`inq${width} alerts`, await page.evaluate(() => [...document.querySelectorAll("[role=alert],[aria-live]")].map((a) => `${a.getAttribute("role") || a.getAttribute("aria-live")}: ${a.textContent.trim().slice(0, 160)}`).filter((t) => t.length > 12)));
    note(`inq${width} axe errors`, await axe(page));
    await shot(page, `a11y-store/inquiry-errors-${width}`);
    await ctx.close();
  }
}

if (run("auth")) {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "a11yauth" });
  const page = await ctx.newPage();
  for (const route of ["/prijava", "/registracija", "/za-majstore/registracija", "/zaboravljena-lozinka"]) {
    await page.goto(BASE + route, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(1500);
    note(`auth ${route} fields`, await fields(page, "main"));
  }
  await page.goto(BASE + "/prijava", { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(1500);
  // paste into password: is it prevented?
  note("auth paste", await page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll("main input")) {
      const dt = new DataTransfer();
      dt.setData("text/plain", "x");
      const ev = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      out[el.id || el.name || el.type] = { prevented: ev.defaultPrevented, type: el.type, ac: el.autocomplete };
    }
    return out;
  }));
  note("auth show-password", await page.locator("main button").allTextContents());
  note("auth captcha/cognitive", await page.evaluate(() => /captcha|koliko je|zbir|reši/i.test(document.body.innerText)));
  // wrong password error association
  await page.getByTestId("auth-email").fill("nepostoji@primer.rs");
  await page.getByTestId("auth-password").fill("pogresna-lozinka-123");
  await page.getByTestId("auth-submit").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3500);
  note("auth wrong pw focus", await act(page));
  note("auth wrong pw alerts", await page.evaluate(() => [...document.querySelectorAll("[role=alert],[aria-live]")].map((a) => `${a.getAttribute("role") || a.getAttribute("aria-live")}: ${a.textContent.trim().slice(0, 160)}`).filter((t) => t.length > 12)));
  note("auth wrong pw fields", await fields(page, "main"));
  await shot(page, "a11y-store/login-wrong-password-1440");
  await ctx.close();
}

if (run("product")) {
  for (const width of [1440, 390]) {
    const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: `a11yprod${width}` });
    const page = await ctx.newPage();
    await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load", timeout: 180000 });
    await page.waitForTimeout(2500);
    note(`prod${width} header aria`, (await page.locator("header").first().ariaSnapshot()).slice(0, 1800));
    note(`prod${width} media`, await page.evaluate(() => [...document.querySelectorAll("main img, main picture, main svg[role=img], main figure")].slice(0, 8).map((i) => `${i.tagName} alt="${i.getAttribute("alt") ?? i.getAttribute("aria-label") ?? ""}" ${Math.round(i.getBoundingClientRect().width)}x${Math.round(i.getBoundingClientRect().height)}`)));
    note(`prod${width} media buttons`, await page.evaluate(() => [...document.querySelectorAll("main button")].map((b) => (b.getAttribute("aria-label") || b.textContent).trim().slice(0, 50)).slice(0, 30)));
    note(`prod${width} main aria (top)`, (await page.locator("main").ariaSnapshot()).slice(0, 3500));
    await ctx.close();
  }
  // out of stock product: back-in-stock form
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "a11yoos" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/deo/kocione-plocice-prednje-demo-0012", { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(2500);
  note("oos buybox fields", await fields(page, "main"));
  const bis = page.locator("main form").first();
  note("oos form aria", (await bis.ariaSnapshot().catch((e) => String(e))).slice(0, 1200));
  const btn = bis.locator("button[type=submit]").first();
  if (await btn.count()) {
    await btn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
    note("oos after empty submit focus", await act(page));
    note("oos after empty submit fields", await fields(page, "main"));
    await shot(page, "a11y-store/oos-form-errors-1440", { locator: bis });
  }
  await ctx.close();
}

if (run("mechanic")) {
  const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
  const m = acc.mechanic ?? acc.mechanicAccount ?? Object.values(acc).find((a) => /mehan|majstor|mech/i.test(JSON.stringify(a)));
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "a11ymech" });
  const page = await ctx.newPage();
  await loginWith(page, m.email, m.password, "/");
  await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(3500);
  const buy = page.getByTestId("product-add-to-cart").first().locator("xpath=ancestor::*[.//*[contains(text(),'RSD')]][1]");
  note("mech buybox aria", (await buy.ariaSnapshot().catch((e) => String(e))).slice(0, 2500));
  note("mech price nodes", await page.evaluate(() => [...document.querySelectorAll("main *")].filter((e) => /Vaša cena|Maloprodajna|MP cena/i.test(e.textContent) && e.children.length < 4).slice(0, 6).map((e) => `${e.tagName} ${e.getAttribute("aria-label") || ""} | ${e.textContent.replace(/\s+/g, " ").trim().slice(0, 120)}`)));
  await shot(page, "a11y-store/mech-buybox-1440", { clip: { x: 0, y: 60, width: 1440, height: 760 } });
  await page.goto(BASE + "/delovi/kocioni-diskovi", { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(3000);
  note("mech card aria", (await page.locator("main li, main article").filter({ hasText: "RSD" }).first().ariaSnapshot().catch((e) => String(e))).slice(0, 1500));
  await ctx.close();
}

if (run("hero")) {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "a11yhero" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(6000);
  const seq = [];
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(80);
    seq.push(await act(page));
  }
  note("hero tab seq", seq);
  const stage = page.getByRole("button", { name: /Sledeća faza/ }).first();
  note("hero stage btn", await stage.count());
  if (await stage.count()) {
    await stage.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2500);
    note("hero after next stage focus", await act(page));
    note("hero lives", await page.evaluate(() => [...document.querySelectorAll("[aria-live],[role=status]")].map((a) => `${a.getAttribute("aria-live") || a.getAttribute("role")}: ${a.textContent.trim().slice(0, 140)}`).filter((t) => t.length > 12)));
    note("hero stage nav aria", (await page.locator("nav[aria-label='Faze rasklapanja']").ariaSnapshot().catch((e) => String(e))).slice(0, 1500));
    await shot(page, "a11y-store/hero-stage-kbd-1440");
  }
  note("hero canvas", await page.evaluate(() => [...document.querySelectorAll("canvas")].map((c) => `aria-hidden=${c.getAttribute("aria-hidden")} role=${c.getAttribute("role")} label=${c.getAttribute("aria-label")} parentHidden=${!!c.closest("[aria-hidden=true]")}`)));
  note("hero axe", await axe(page));
  await ctx.close();
}

writeFileSync(`docs/qa/audit/a11y-store/forms-${want.join("-") || "all"}.json`, JSON.stringify(rec, null, 1));
await browser.close();
