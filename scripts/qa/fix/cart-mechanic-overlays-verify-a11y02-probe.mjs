import { BASE, launch, newContext } from "../audit/kit.mjs";
const browser = await launch("chromium");
try {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "probe" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/delovi/kocioni-diskovi", { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(3000);
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    const el = document.querySelector("[data-testid=cart-button]");
    for (const [name, opts] of [["focus()", undefined], ["focus({preventScroll:true})", { preventScroll: true }]]) {
      document.activeElement?.blur();
      window.scrollTo(0, 1200); await wait(300);
      const y0 = Math.round(scrollY);
      el.focus(opts); await wait(300);
      out[name] = { y0, y1: Math.round(scrollY), top: Math.round(el.getBoundingClientRect().top) };
    }
    document.activeElement?.blur();
    document.documentElement.style.scrollPaddingTop = "0px";
    window.scrollTo(0, 1200); await wait(300);
    el.focus(); await wait(300);
    out["focus() with scroll-padding-top 0"] = { y0: 1200, y1: Math.round(scrollY) };
    document.documentElement.style.scrollPaddingTop = "";
    out.scrollPaddingTop = getComputedStyle(document.documentElement).scrollPaddingTop;
    return out;
  });
  console.log(JSON.stringify(r));
} finally { await browser.close(); }
