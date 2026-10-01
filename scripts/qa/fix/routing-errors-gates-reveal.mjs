// Text-reveal contract on the new status pages: nothing left hidden, no pending/split words.
import { BASE, launch, newContext, scrollThrough, revealCheck } from "../audit/kit.mjs";
const browser = await launch();
try {
  for (const route of ["/ovo-ne-postoji", "/upit/losToken123"]) {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: "fix-reveal" });
    const p = await ctx.newPage();
    await p.goto(BASE + route, { waitUntil: "networkidle", timeout: 180000 });
    await p.waitForTimeout(1500);
    await scrollThrough(p);
    await p.waitForTimeout(1500);
    console.log(route, JSON.stringify(await revealCheck(p)), "h1:", await p.locator("h1").first().innerText().catch(() => null));
    await ctx.close();
  }
} finally {
  await browser.close();
}
