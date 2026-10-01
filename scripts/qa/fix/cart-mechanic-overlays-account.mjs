/** cart-mechanic-overlays: VIS-24 / VIS-28 / A11Y-21 on /nalog at 390, plus text-reveal and axe on /nalog/porudzbine and /korpa. */
import { BASE, launch, newContext, shot, scrollThrough, revealCheck, axe } from "../audit/kit.mjs";
import { ACCOUNTS, login } from "../audit/flows-import-mech-lib.mjs";
const browser = await launch();
try {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "fix-acc" });
  const page = await ctx.newPage();
  await login(page, ACCOUNTS.customer.email, ACCOUNTS.customer.password, "/nalog");
  for (const path of ["/nalog/porudzbine", "/nalog/upiti", "/nalog/vozila", "/nalog/profil"]) {
    await page.goto(BASE + path, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => {
      const h2 = [...document.querySelectorAll("main h2")].map((h) => h.textContent.trim()).slice(0, 2);
      const so = [...document.querySelectorAll("button")].filter((b) => /Odjavi se/.test(b.textContent) && b.getClientRects().length);
      const nav = document.querySelector('nav[aria-label="Nalog"]');
      const chip = document.querySelector("main ul li a [class*='rounded']");
      return {
        h2,
        signOutVisible: so.length,
        signOutBelowContent: so[0] && nav ? so[0].getBoundingClientRect().top > nav.getBoundingClientRect().bottom + 100 : null,
        chipW: chip ? Math.round(chip.getBoundingClientRect().width) : null,
      };
    });
    await scrollThrough(page);
    console.log(path, JSON.stringify(info), JSON.stringify(await revealCheck(page)));
    if (path === "/nalog/porudzbine") {
      const a = await axe(page);
      console.log("axe violations", JSON.stringify(a.violations?.map((v) => v.id) ?? a));
      await shot(page, "../fix/cart-mechanic-overlays/account-orders-390");
    }
  }
  await ctx.close();
} finally {
  await browser.close();
}
