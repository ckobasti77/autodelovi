// vis-commerce: /za-majstore + registration (8 widths), auth pages, static/legal, ads landing,
// unsubscribe (invalid token), cookie banner (+ settings), customer account.
import { readFileSync } from "node:fs";
import { BASE, WIDTHS, launch, newContext, watch, scrollThrough, revealCheck, shot, axe } from "./kit.mjs";
import { probe, save, settle, login , harden } from "./vis-commerce-lib.mjs";

const mode = process.argv[2] ?? "all"; // majstore | static | banner | account | all
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8")).customer;
const FOUR = WIDTHS.filter((w) => ["360", "768", "1440", "2560"].includes(w.tag));
const browser = await launch();
const results = {};

async function capture(page, w, dir, name, url, { full = true, axeIt = false } = {}) {
  await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 90000 });
  await settle(page, 1800);
  await shot(page, `vis-commerce/${dir}/${w.tag}-${name}`);
  let out = {};
  if (full) {
    await scrollThrough(page);
    await shot(page, `vis-commerce/${dir}/${w.tag}-${name}-full`, { fullPage: true });
  }
  out.probe = await probe(page);
  out.reveal = await revealCheck(page);
  if (axeIt) out.axe = await axe(page);
  return out;
}

if (mode === "all" || mode === "majstore") {
  const r = (results.majstore = {});
  for (const w of WIDTHS.filter((x) => !process.env.W || process.env.W.split(",").includes(x.tag))) {
    const ctx = await newContext(browser, { width: w.width, height: w.height, tag: `viscom-zm-${w.tag}` });
    const page = harden(await ctx.newPage());
    const log = watch(page);
    const a = w.tag === "390" || w.tag === "1440";
    r[w.tag] = {
      landing: await capture(page, w, "majstore", "za-majstore", "/za-majstore", { axeIt: a }),
      reg: await capture(page, w, "majstore", "registracija", "/za-majstore/registracija", { axeIt: a }),
    };
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByTestId("mechanic-reg-submit").click();
    await page.waitForTimeout(1200);
    await shot(page, `vis-commerce/majstore/${w.tag}-registracija-errors`);
    await shot(page, `vis-commerce/majstore/${w.tag}-registracija-errors-full`, { fullPage: true });
    r[w.tag].regErrors = await page.evaluate(() => ({
      active: document.activeElement?.outerHTML.slice(0, 160),
      invalid: [...document.querySelectorAll("[aria-invalid=true]")].map((e) => e.id || e.name),
    }));
    r[w.tag].log = log;
    await ctx.close();
    console.log("majstore", w.tag, JSON.stringify(log).slice(0, 200));
  }
}

if (mode === "all" || mode === "static") {
  const r = (results.static = {});
  const pages = [
    ["prijava", "/prijava"],
    ["registracija", "/registracija"],
    ["zaboravljena", "/zaboravljena-lozinka"],
    ["o-nama", "/o-nama"],
    ["kontakt", "/kontakt"],
    ["dostava", "/dostava-i-placanje"],
    ["reklamacije", "/reklamacije-i-povrat"],
    ["uslovi", "/uslovi-koriscenja"],
    ["privatnost", "/politika-privatnosti"],
    ["kolacici", "/kolacici"],
    ["ponuda", "/ponuda/kocione-plocice-golf"],
    ["odjava", "/obavestenja/odjava/nevazeci-token-123"],
  ];
  for (const w of FOUR) {
    const ctx = await newContext(browser, { width: w.width, height: w.height, tag: `viscom-st-${w.tag}` });
    const page = harden(await ctx.newPage());
    const log = watch(page);
    r[w.tag] = {};
    for (const [name, url] of pages) {
      r[w.tag][name] = await capture(page, w, "static", name, url, { axeIt: w.tag === "360" && ["prijava", "registracija", "ponuda", "kontakt"].includes(name) });
    }
    // auth error states
    for (const [name, url] of [["prijava", "/prijava"], ["registracija", "/registracija"], ["zaboravljena", "/zaboravljena-lozinka"]]) {
      await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 90000 });
      await settle(page, 1500);
      const submit = page.locator('main form button[type="submit"]').first();
      if (await submit.count()) {
        await submit.click();
        await page.waitForTimeout(1200);
        await shot(page, `vis-commerce/static/${w.tag}-${name}-errors`);
      }
      if (name === "prijava") {
        await page.getByTestId("auth-email").fill("nepostoji@primer.rs");
        await page.getByTestId("auth-password").fill("pogresnaLozinka1");
        await page.getByTestId("auth-submit").click();
        await page.waitForTimeout(4000);
        await shot(page, `vis-commerce/static/${w.tag}-prijava-wrong`);
      }
    }
    r[w.tag].log = log;
    await ctx.close();
    console.log("static", w.tag, JSON.stringify(log).slice(0, 300));
  }
}

if (mode === "all" || mode === "banner") {
  const r = (results.banner = {});
  for (const w of FOUR) {
    const ctx = await newContext(browser, { width: w.width, height: w.height, consent: false, tag: `viscom-bn-${w.tag}` });
    const page = harden(await ctx.newPage());
    const log = watch(page);
    await page.goto(`${BASE}/dostava-i-placanje`, { waitUntil: "load", timeout: 90000 });
    await settle(page, 2000);
    await shot(page, `vis-commerce/banner/${w.tag}-banner`);
    const geo = await page.evaluate(() => {
      const b = document.querySelector("[data-testid=consent-banner]")?.getBoundingClientRect();
      return b ? { top: b.top, h: b.height, w: b.width, vh: window.innerHeight, share: +(b.height / window.innerHeight).toFixed(2) } : null;
    });
    r[w.tag] = { geo, probe: await probe(page) };
    if (w.tag === "360" || w.tag === "1440") r[w.tag].axe = await axe(page, { include: "[data-testid=consent-banner]" });
    const settings = page.getByTestId("consent-banner").getByRole("button", { name: /Podešavanja/ });
    if (await settings.count()) {
      await settings.click();
      await page.waitForTimeout(900);
      await shot(page, `vis-commerce/banner/${w.tag}-banner-settings`);
      r[w.tag].geoSettings = await page.evaluate(() => {
        const b = document.querySelector("[data-testid=consent-banner]")?.getBoundingClientRect();
        return b ? { top: b.top, h: b.height, vh: window.innerHeight, share: +(b.height / window.innerHeight).toFixed(2) } : null;
      });
    }
    // keyboard: first Tab from the top
    await page.goto(`${BASE}/dostava-i-placanje`, { waitUntil: "load", timeout: 90000 });
    await settle(page, 1500);
    const order = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      order.push(await page.evaluate(() => (document.activeElement?.textContent || document.activeElement?.getAttribute("aria-label") || "").trim().slice(0, 40)));
    }
    r[w.tag].tabOrder = order;
    r[w.tag].log = log;
    await ctx.close();
  }
}

if (mode === "all" || mode === "account") {
  const r = (results.account = {});
  const ctx0 = await newContext(browser, { width: 1440, height: 900, tag: "viscom-acc-login" });
  const p0 = harden(await ctx0.newPage());
  await login(p0, BASE, acc.email, acc.password, "/nalog");
  const state = await ctx0.storageState();
  await ctx0.close();
  const pages = ["/nalog", "/nalog/porudzbine", "/nalog/upiti", "/nalog/vozila", "/nalog/profil"];
  for (const w of FOUR) {
    const ctx = await browser.newContext({
      storageState: state,
      viewport: { width: w.width, height: w.height },
      isMobile: w.mobile,
      hasTouch: w.mobile,
      locale: "sr-Latn-RS",
      timezoneId: "Europe/Belgrade",
      userAgent: `Mozilla/5.0 Chrome/140.0 SklopAudit-viscom-acc-${w.tag}/${Date.now()}`,
    });
    const page = harden(await ctx.newPage());
    const log = watch(page);
    r[w.tag] = {};
    for (const url of pages) {
      const name = url.replaceAll("/", "_").replace(/^_/, "");
      r[w.tag][name] = await capture(page, w, "account", name, url, { axeIt: w.tag === "360" || w.tag === "1440" });
    }
    r[w.tag].log = log;
    await ctx.close();
    console.log("account", w.tag, JSON.stringify(log).slice(0, 300));
  }
}

save(`secondary-${mode}${process.env.W ? "-" + process.env.W.replaceAll(",", "_") : ""}`, results);
await browser.close();
