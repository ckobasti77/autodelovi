// vis-commerce (2nd reviewer): public-page checks at real scroll positions (no full-page artefacts).
//   node scripts/qa/audit/vis-commerce-public.mjs
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot, scrollThrough, revealCheck } from "./kit.mjs";
import { OUT, harden, settle } from "./vis-commerce-lib.mjs";

const res = {};
const browser = await launch();

// 1. /za-majstore bottom at 390: walk viewport by viewport near the end
{
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "viscom2-zm" });
  const page = harden(await ctx.newPage());
  const log = watch(page);
  await page.goto(`${BASE}/za-majstore`);
  await settle(page, 1500);
  await scrollThrough(page);
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  res.zm = { H, sections: [] };
  for (const y of [H - 844 * 3, H - 844 * 2, H - 844]) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(1800);
    await shot(page, `vis-commerce/v2/390-za-majstore-y${Math.round(y)}`);
  }
  res.zm.reveal = await revealCheck(page);
  res.zm.blocks = await page.evaluate(() =>
    [...document.querySelectorAll("main > *, main section")].map((e) => {
      const r = e.getBoundingClientRect();
      return `${e.tagName.toLowerCase()} ${Math.round(r.top + scrollY)}-${Math.round(r.bottom + scrollY)} "${(e.textContent || "").trim().slice(0, 40)}"`;
    }).slice(0, 30));
  res.zm.log = log;
  await ctx.close();
}

// 2. /upit — which input renders under 16 px, and the photo-upload area
{
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "viscom2-upit" });
  const page = harden(await ctx.newPage());
  await page.goto(`${BASE}/upit`);
  await settle(page, 1500);
  res.upit = await page.evaluate(() =>
    [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select")]
      .map((e) => `${e.tagName.toLowerCase()} type=${e.type} id=${e.id} name=${e.name} fs=${getComputedStyle(e).fontSize} h=${Math.round(e.getBoundingClientRect().height)} w=${Math.round(e.getBoundingClientRect().width)} label="${(e.labels?.[0]?.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 40)}"`));
  await ctx.close();
}

// 3. mobile cart: is the checkout CTA / total in the first viewport with 1, 2, 3 lines?
{
  res.cart = {};
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "viscom2-cart" });
  const page = harden(await ctx.newPage());
  for (const [i, slug] of ["kocioni-disk-prednji-276-24-mm-demo-0004"].entries()) {
    await page.goto(`${BASE}/deo/${slug}`);
    await settle(page, 1500);
    await page.getByTestId("add-to-cart").first().click().catch(async () => {
      await page.getByRole("button", { name: /Dodaj u korpu/i }).first().click();
    });
    await page.waitForTimeout(1500);
  }
  await page.goto(`${BASE}/korpa`);
  await settle(page, 1500);
  res.cart.one = await page.evaluate(() => {
    const cta = [...document.querySelectorAll("a,button")].find((e) => /Nastavi na porudžbinu/.test(e.textContent));
    const r = cta?.getBoundingClientRect();
    const sticky = [...document.querySelectorAll("main *")].filter((e) => ["sticky", "fixed"].includes(getComputedStyle(e).position)).map((e) => e.className.toString().slice(0, 60));
    return { ctaTop: r && Math.round(r.top), vh: innerHeight, sticky };
  });
  await shot(page, "vis-commerce/v2/390-cart-one-line");
  await ctx.close();
}
writeFileSync(`${OUT}/v2-public.json`, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 1).slice(0, 5000));
await browser.close();
