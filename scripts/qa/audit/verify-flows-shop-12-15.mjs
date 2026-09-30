// Independent verification of flows-shop-12..15 (step 21 audit).
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, scrollThrough, shot } from "./kit.mjs";

const OUT = "verify/flows-shop";
const only = process.argv[2] ?? "all";
const res = {};
const browser = await launch("chromium");

const toasts = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[role="region"] ol > li')].map((li) => ({
      text: li.innerText.replace(/\s+/g, " ").trim(),
      state: li.getAttribute("data-state"),
    })),
  );

async function fixedAndContact(page) {
  return page.evaluate(() => {
    const vh = innerHeight;
    const fixed = [...document.querySelectorAll("body *")]
      .filter((e) => {
        const cs = getComputedStyle(e);
        if (cs.position !== "fixed" && cs.position !== "sticky") return false;
        const r = e.getBoundingClientRect();
        return (
          r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && cs.visibility !== "hidden" && cs.display !== "none"
        );
      })
      .map((e) => {
        const r = e.getBoundingClientRect();
        const tid = e.getAttribute("data-testid");
        return `${e.tagName.toLowerCase()}${tid ? "[" + tid + "]" : ""} pos=${getComputedStyle(e).position} top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} h=${Math.round(r.height)} text="${(e.innerText || "").replace(/\s+/g, " ").slice(0, 60)}"`;
      });
    const links = [
      ...document.querySelectorAll('a[href^="tel:"], a[href^="viber:"], a[href*="wa.me"]'),
    ].map((a) => a.getAttribute("href"));
    const bottomControls = [...document.querySelectorAll("a, button")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.top >= vh - 90 && r.bottom <= vh + 1;
      })
      .map((e) => (e.innerText || e.getAttribute("aria-label") || "").replace(/\s+/g, " ").slice(0, 40));
    return { fixed, contactLinks: links, bottomControls };
  });
}

if (only === "all" || only === "12") {
  const routes = {
    home: "/",
    product: "/deo/kocioni-disk-prednji-276-24-mm-demo-0004",
    category: "/delovi/kocioni-diskovi",
    landing: "/ponuda/kocione-plocice-golf",
    inquiry: "/upit",
  };
  res["12"] = {};
  for (const w of [
    { width: 390, height: 844 },
    { width: 360, height: 780 },
    { width: 768, height: 1024 },
  ]) {
    const ctx = await newContext(browser, { ...w, tag: "vfs12" });
    const page = await ctx.newPage();
    for (const [k, r] of Object.entries(routes)) {
      if (w.width !== 390 && !["product", "landing"].includes(k)) continue;
      await page.goto(BASE + r, { waitUntil: "networkidle", timeout: 90_000 });
      await scrollThrough(page, { stepMs: 80 });
      await page.mouse.wheel(0, 2200);
      await page.waitForTimeout(700);
      await page.mouse.wheel(0, -500);
      await page.waitForTimeout(900);
      const info = await fixedAndContact(page);
      info.scrollY = await page.evaluate(() => scrollY);
      res["12"][`${k}-${w.width}`] = info;
      if (w.width === 390 || k === "product") await shot(page, `${OUT}/flows-shop-12-reproduce-${k}-${w.width}`);
    }
    await ctx.close();
  }
}

if (only === "all" || only === "13") {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "vfs13" });
  const page = await ctx.newPage();
  const log = watch(page);
  const r = {};
  await page.goto(BASE + "/deo/kocioni-disk-zadnji-272-10-mm-puni-demo-0003", {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  const buy = page.getByRole("button", { name: /Dodaj u korpu/ }).first();
  await buy.scrollIntoViewIfNeeded();
  r.stepper = await page.evaluate(() => {
    const i = document.querySelector('input[type="number"][aria-label="Količina"]');
    return i ? { value: i.value, max: i.max } : null;
  });
  await buy.click();
  await page.waitForTimeout(2500);
  r.toastsAfterFirst = await toasts(page);
  await page.waitForTimeout(6000);
  r.toastsBeforeSecond = await toasts(page);
  await buy.click();
  await page.waitForTimeout(2500);
  r.toastsAfterSecond = await toasts(page);
  r.buttonAfterSecond = await buy.evaluate((b) => ({
    text: b.innerText.trim(),
    disabled: b.disabled,
    ariaDisabled: b.getAttribute("aria-disabled"),
  }));
  await shot(page, `${OUT}/flows-shop-13-reproduce-second-add-390`);
  const input = page.locator('input[type="number"][aria-label="Količina"]').first();
  await input.fill("5");
  await page.waitForTimeout(300);
  r.productStepperTyped5 = await input.inputValue();

  await page.goto(BASE + "/deo/abs-senzor-prednji-demo-0022", { waitUntil: "networkidle", timeout: 90_000 });
  const buy2 = page.getByRole("button", { name: /Dodaj u korpu/ }).first();
  await buy2.scrollIntoViewIfNeeded();
  await buy2.click();
  await page.waitForTimeout(2500);
  await page.goto(BASE + "/korpa", { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(1500);
  const line = page.getByTestId("cart-line").filter({ hasText: "ABS senzor prednji" }).first();
  const qty = line.locator('input[type="number"]');
  r.cartBefore = await qty.inputValue();
  await qty.click();
  await qty.fill("99");
  await qty.press("Enter");
  await page.waitForTimeout(2500);
  r.cartAfter99 = await qty.inputValue();
  r.cartLineText = (await line.innerText()).replace(/\s+/g, " ");
  r.cartToasts = await toasts(page);
  r.cartLive = await page.evaluate(() =>
    [...document.querySelectorAll('[role="status"],[aria-live]')]
      .map((e) => (e.textContent || "").trim())
      .filter(Boolean)
      .slice(0, 10),
  );
  await line.scrollIntoViewIfNeeded();
  await shot(page, `${OUT}/flows-shop-13-reproduce-cart-qty99-390`);
  r.log = log;
  res["13"] = r;
  await ctx.close();
}

if (only === "all" || only === "14") {
  const r = {};
  for (const w of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const ctx = await newContext(browser, { ...w, tag: "vfs14" });
    const page = await ctx.newPage();
    for (const [k, p] of Object.entries({
      order: "/porudzbina/nevazeci-token",
      thanks: "/porudzbina/hvala/nevazeci-token",
      proforma: "/porudzbina/nevazeci-token/predracun",
      inquiry: "/upit/nevazeci-token",
      inquiryThanks: "/upit/hvala/nevazeci-token",
      truncated: "/porudzbina/GVl2SHwvba1nbEDG8VWTGcg0IPXAbHGNXGp",
    })) {
      const resp = await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 90_000 });
      const d = await page.evaluate(() => ({
        title: document.title,
        h1: document.querySelector("h1")?.innerText.trim(),
        p: document.querySelector("main p")?.innerText.trim(),
        robots: document.querySelector('meta[name="robots"]')?.content,
        mentionsOrderOrLink: /porud|upit\b|link/i.test(document.querySelector("main h1, main p")?.innerText ?? ""),
      }));
      r[`${k}-${w.width}`] = { status: resp?.status(), ...d };
      if (k === "order" || k === "inquiry") await shot(page, `${OUT}/flows-shop-14-reproduce-${k}-${w.width}`);
    }
    await ctx.close();
  }
  res["14"] = r;
}

if (only === "all" || only === "15") {
  const r = {};
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "vfs15" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/upit", { waitUntil: "networkidle", timeout: 90_000 });
  const input = page.getByTestId("inquiry-photo-input");
  r.accept = await input.getAttribute("accept");
  const notice = async () =>
    page.evaluate(() => {
      const el = [...document.querySelectorAll('p[role="status"]')].find((e) =>
        /Fotograf|Najviše/.test(e.textContent || ""),
      );
      return el ? el.textContent.trim() : null;
    });
  await input.setInputFiles({
    name: "racun.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%fake\n"),
  });
  await page.waitForTimeout(600);
  r.wrongType = await notice();
  await input.evaluate((e) => e.closest("label")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(400);
  await shot(page, `${OUT}/flows-shop-15-reproduce-wrong-type-390`);
  const big = Buffer.alloc(9 * 1024 * 1024, 0);
  big[0] = 0xff;
  big[1] = 0xd8;
  big[2] = 0xff;
  await input.setInputFiles({ name: "velika.jpg", mimeType: "image/jpeg", buffer: big });
  await page.waitForTimeout(600);
  r.tooBig = await notice();
  await shot(page, `${OUT}/flows-shop-15-reproduce-too-big-390`);
  r.photosAdded = await page.getByTestId("inquiry-photo").count();
  res["15"] = r;
  await ctx.close();
}

await browser.close();
mkdirSync(`docs/qa/audit/${OUT}`, { recursive: true });
const file = `docs/qa/audit/${OUT}/verify-12-15-${only}.json`;
writeFileSync(file, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
