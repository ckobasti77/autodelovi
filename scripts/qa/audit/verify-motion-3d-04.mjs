import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";

const out = { runs: [] };
const browser = await launch();
const readState = (page) =>
  page.evaluate(() => {
    const s = window.__sklop3d?.getState();
    const cur = document.querySelector('[aria-current="step"]');
    const phone = document.querySelector("nav + div p");
    return {
      scrollY: window.scrollY,
      progress: s?.progress,
      stage: s?.stage,
      status: s?.status,
      selected: s?.selected,
      timeline: s?.timeline,
      ariaCurrent: cur?.getAttribute("aria-label") ?? null,
      phoneLabel: phone?.textContent ?? null,
      panelHeading: document.querySelector('[data-testid="part-panel"] h2, [role="dialog"] h2, aside h2')?.textContent ?? null,
    };
  });

async function deeplink(slug, width, height, reducedMotion = "no-preference") {
  const ctx = await newContext(browser, { width, height, tag: `v04-${slug}-${width}`, reducedMotion });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?deo=${slug}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__sklop3d?.getState().selected, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const s = await readState(page);
  out.runs.push({ kind: "deeplink", slug, width, reducedMotion, ...s });
  if (width === 1440 && slug === "kocioni-diskovi" && reducedMotion === "no-preference")
    await shot(page, "verify/motion-3d/motion-3d-04-reproduce-deeplink-1440");
  if (width === 390 && slug === "kocioni-diskovi")
    await shot(page, "verify/motion-3d/motion-3d-04-reproduce-deeplink-390");
  await ctx.close();
}

for (const slug of ["kocioni-diskovi", "abs-senzori", "amortizeri-opruge"]) await deeplink(slug, 1440, 900);
await deeplink("kocioni-diskovi", 1440, 900, "reduce");
await deeplink("kocioni-diskovi", 390, 844);
await deeplink("kocioni-diskovi", 1280, 800);
// a stage-1 and stage-2 category for comparison
for (const slug of ["farovi", "interkuler", "motor", "menjac", "auspuh"]) await deeplink(slug, 1440, 900);

// Stage index buttons on / (normal motion) 1440
{
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "v04-strip" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
    const btn = page.locator(`nav ol li button`).nth(n);
    await btn.focus();
    await page.keyboard.press("Enter");
    const samples = [];
    for (const t of [1200, 2000, 3500]) {
      await page.waitForTimeout(t - (samples.length ? [0, 1200, 2000][samples.length] : 0));
      samples.push({ t, ...(await readState(page)) });
    }
    out.runs.push({ kind: "strip", button: n, samples });
    if (n === 3) await shot(page, "verify/motion-3d/motion-3d-04-reproduce-strip03-1440");
  }
  await ctx.close();
}
// Phone next-button: from stage 2 end press next
{
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "v04-phone" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const seq = [];
  const next = page.getByRole("button", { name: /Sledeća faza|sledeć/i }).first();
  for (let i = 0; i < 7; i++) {
    await next.click().catch((e) => seq.push({ err: String(e).slice(0, 120) }));
    await page.waitForTimeout(2500);
    seq.push(await readState(page));
  }
  out.runs.push({ kind: "phone-next", seq });
  await ctx.close();
}
await browser.close();
writeFileSync("docs/qa/audit/verify/motion-3d/motion-3d-04-reproduce.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
