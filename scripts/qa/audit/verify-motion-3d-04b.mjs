import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";
const out = { strip: [], phone: [] };
const browser = await launch();
const readState = (page) =>
  page.evaluate(() => {
    const s = window.__sklop3d?.getState();
    const cur = document.querySelector('[aria-current="step"]');
    return { scrollY: window.scrollY, progress: s?.progress, stage: s?.stage, status: s?.status, ariaCurrent: cur?.getAttribute("aria-label") ?? null };
  });
for (const n of [1, 2, 3, 4, 5, 6, 7]) {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: `v04b-${n}` });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  await page.locator("nav ol li button").nth(n).focus();
  await page.keyboard.press("Enter");
  const samples = [];
  for (let t = 0; t < 5; t++) { await page.waitForTimeout(1000); samples.push(await readState(page)); }
  out.strip.push({ button: n, samples: samples.map((s) => `${s.scrollY}/${s.progress}/st${s.stage}`) , final: samples.at(-1) });
  if (n === 3) await shot(page, "verify/motion-3d/motion-3d-04-reproduce-strip03-1440");
  await ctx.close();
}
// phone: go next twice, then next (expect 03), then prev from 04
{
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "v04b-phone" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  const next = page.getByRole("button", { name: "Sledeća faza" });
  const prev = page.getByRole("button", { name: "Prethodna faza" });
  for (const [label, btn] of [["next", next], ["next", next], ["next", next], ["prev", prev], ["prev", prev], ["prev", prev]]) {
    await btn.click();
    await page.waitForTimeout(3000);
    const s = await readState(page);
    const lbl = await page.locator("nav + div p").first().textContent();
    out.phone.push({ press: label, ...s, label: lbl });
    if (out.phone.length === 3) await shot(page, "verify/motion-3d/motion-3d-04-reproduce-phone-next-390");
    if (out.phone.length === 4) await shot(page, "verify/motion-3d/motion-3d-04-reproduce-phone-prev-390");
  }
  await ctx.close();
}
await browser.close();
writeFileSync("docs/qa/audit/verify/motion-3d/motion-3d-04-reproduce-b.json", JSON.stringify(out, null, 1));
for (const s of out.strip) console.log("strip", s.button, s.samples.join("  "), s.final.ariaCurrent);
for (const p of out.phone) console.log(p.press, p.scrollY, p.progress, "st", p.stage, "|", p.label);
