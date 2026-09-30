// Independent verification of vis-admin-04 (command palette widening on phones).
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, loginAdmin, shot } from "./kit.mjs";
const out = {};
const browser = await launch("chromium");
const measure = (page) => page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  if (!d) return { noDialog: true };
  const r = d.getBoundingClientRect();
  const close = [...d.querySelectorAll("button")].find((x) => /zatvori/i.test(x.getAttribute("aria-label") || ""));
  const cr = close?.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const opts = [...d.querySelectorAll('[role="option"]')];
  const widest = opts.map((o) => ({ t: o.textContent.trim().slice(0, 70), sw: o.scrollWidth, right: Math.round(o.getBoundingClientRect().right) })).sort((a, b) => b.right - a.right).slice(0, 3);
  return {
    vw, innerWidth, vv: visualViewport.width,
    dialog: { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) },
    close: cr ? { left: Math.round(cr.left), right: Math.round(cr.right), onScreen: cr.right <= vw } : null,
    options: opts.length, widest,
  };
});
for (const s of [{ tag: "390", width: 390, height: 844 }, { tag: "360", width: 360, height: 780 }, { tag: "768", width: 768, height: 1024 }]) {
  const ctx = await newContext(browser, { width: s.width, height: s.height, tag: `ver-va04-${s.tag}` });
  const page = await ctx.newPage();
  for (let i = 0; i < 3; i++) { try { await loginAdmin(page); break; } catch (e) { console.log("login retry", i); } }
  out[s.tag] = {};
  for (const q of ["SK-2026-000092", "Golf"]) {
    await page.goto(`${BASE}/admin/porudzbine`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    // search trigger in the top bar (icon button on phones, field-like button on tablets)
    const trig = page.locator("header").getByRole("button", { name: /pretra|broj porud/i }).first();
    await trig.click();
    await page.waitForSelector('[role="dialog"]');
    await page.waitForTimeout(700);
    const before = await measure(page);
    await page.keyboard.type(q);
    await page.waitForTimeout(3000);
    const after = await measure(page);
    out[s.tag][q] = { before, after };
    console.log(s.tag, q, "before", JSON.stringify(before.dialog), "after", JSON.stringify(after.dialog), "close", JSON.stringify(after.close), "vw", after.vw, "inner", after.innerWidth, "opts", after.options);
    if (s.tag !== "768" || q === "SK-2026-000092") await shot(page, `verify/vis-admin/vis-admin-04-reproduce-${s.tag}-${q.replace(/[^a-z0-9]/gi, "")}`);
    await page.keyboard.press("Escape");
  }
  await ctx.close();
}
writeFileSync("docs/qa/audit/verify/vis-admin/vis-admin-04-reproduce.json", JSON.stringify(out, null, 2));
await browser.close();
