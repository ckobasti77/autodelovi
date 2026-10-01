/** cart-mechanic-overlays: A11Y-14 — focused controls on /majstor/cenovnik must not sit under the sticky download bar. */
import { BASE, launch, newContext, shot } from "../audit/kit.mjs";
import { loginMechanic } from "../audit/flows-import-mech-lib.mjs";
const browser = await launch();
try {
  for (const [w, h] of [[360, 844], [390, 844], [768, 1024], [1440, 900]]) {
    const ctx = await newContext(browser, { width: w, height: h, tag: "fix-pl" });
    const page = await ctx.newPage();
    await loginMechanic(page, "/majstor");
    await page.goto(`${BASE}/majstor/cenovnik`, { waitUntil: "load" });
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(2000);
    await page.locator("h1").first().click();
    let stops = 0, hidden = 0, partly = 0;
    const names = [];
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press("Tab");
      const r = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body || !a.closest("main")) return null;
        const b = [...document.querySelectorAll("div.sticky")].find((d) => d.textContent.includes("Preuzmi cenovnik"));
        if (!b || b.contains(a)) return null;
        const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        const ov = Math.max(0, Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top));
        return { frac: ar.height ? ov / ar.height : 0, name: a.getAttribute("aria-label") ?? a.textContent.trim().slice(0, 30), barH: Math.round(br.height) };
      });
      if (!r) continue;
      stops++;
      if (r.frac >= 0.99) { hidden++; names.push(r.name); } else if (r.frac > 0) partly++;
      if (i === 79) console.log("bar height", r.barH);
    }
    console.log(JSON.stringify({ w, stops, hidden, partly, names, spb: await page.evaluate(() => document.documentElement.style.scrollPaddingBottom) }));
    if (w === 390) await shot(page, "../fix/cart-mechanic-overlays/a11y14-pricelist-390-focus");
    await ctx.close();
  }
} finally {
  await browser.close();
}
