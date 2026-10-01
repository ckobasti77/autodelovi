/** cart-mechanic-overlays: VIS-09 predračun on phones (stacked lines) vs sm / print (table); FLOW-05 404 status. */
import { BASE, launch, newContext, shot } from "../audit/kit.mjs";
const TOKEN = process.env.ORDER_TOKEN ?? "GVl2SHwvba1nbEDG8VWTGcg0IPXAbHGNXGpzjHnowJw";
const browser = await launch();
try {
  for (const w of [390, 768]) {
    const ctx = await newContext(browser, { width: w, height: 844, tag: "fix-pr" });
    const page = await ctx.newPage();
    const res = await page.goto(`${BASE}/porudzbina/${TOKEN}/predracun`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const ul = document.querySelector('ul[aria-label="Stavke"]');
      const table = document.querySelector("table");
      const li = ul?.querySelector("li");
      return {
        list: ul ? getComputedStyle(ul).display : null,
        table: table ? getComputedStyle(table).display : null,
        firstLineH: li ? Math.round(li.getBoundingClientRect().height) : null,
        nameW: li ? Math.round(li.firstElementChild.getBoundingClientRect().width) : null,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    await page.emulateMedia({ media: "print" });
    const printTable = await page.evaluate(() => getComputedStyle(document.querySelector("table")).display);
    await page.emulateMedia({ media: "screen" });
    console.log(JSON.stringify({ w, status: res.status(), ...m, printTable }));
    await shot(page, `../fix/cart-mechanic-overlays/vis09-predracun-${w}`, { fullPage: true });
    await ctx.close();
  }
} finally {
  await browser.close();
}
