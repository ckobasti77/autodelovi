// motion-3d: overlays opened from the keyboard — does Escape (and the close button) return focus to
// the opener? Also records how the overlay enters (GSAP inline transform/opacity during the tween).
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";

const browser = await launch();
const results = [];
const describe = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return "BODY";
    return `${a.tagName.toLowerCase()}[${a.getAttribute("data-testid") ?? ""}] "${(a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 40)}"`;
  });

async function probe(page, name, openerLocator, { closeWith = "Escape", tag }) {
  const opener = openerLocator.first();
  if (!(await opener.isVisible().catch(() => false))) {
    results.push({ tag, name, skipped: "opener not visible" });
    return;
  }
  await opener.focus();
  const openerDesc = await describe(page);
  await page.keyboard.press("Enter");
  // Sample the dialog panel style 60 ms in (GSAP inline styles while entering).
  await page.waitForTimeout(60);
  const entering = await page.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].filter((e) => e.getBoundingClientRect().width > 0).pop();
    return d ? { style: d.getAttribute("style")?.slice(0, 120), opacity: getComputedStyle(d).opacity } : null;
  });
  await page.waitForTimeout(700);
  const open = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].some((e) => e.getBoundingClientRect().width > 0 && !e.closest("[data-consent]")));
  const inside = await describe(page);
  if (closeWith === "Escape") await page.keyboard.press("Escape");
  else {
    await page.locator('[role="dialog"] button[aria-label="Zatvori"]').last().click();
  }
  await page.waitForTimeout(800);
  const after = await describe(page);
  const returned = await opener.evaluate((el) => el === document.activeElement).catch(() => false);
  results.push({ tag, name, closeWith, openerDesc, open, entering, focusInside: inside, focusAfter: after, returnedToOpener: returned });
  console.log(`${returned ? "ok  " : "FAIL"} ${tag} ${name} (${closeWith}) open=${open} inside=${inside} after=${after}`);
}

for (const vp of [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "390", width: 390, height: 844 },
].filter((v) => !process.env.VP || v.tag === process.env.VP)) {
  const ctx = await newContext(browser, { width: vp.width, height: vp.height, tag: `m3d-focus-${vp.tag}` });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(1500);
  const hdr = page.locator("header");
  await probe(page, "header search", hdr.getByRole("button", { name: /Broj dela ili naziv|Pretraga|Pretraži/ }), { tag: vp.tag });
  await probe(page, "header vehicle picker", hdr.getByRole("button", { name: /Izaberite vozilo|vozilo/i }), { tag: vp.tag });
  await probe(page, "mobile menu", hdr.getByRole("button", { name: /Meni|meni|Otvori meni/ }), { tag: vp.tag });
  await probe(page, "cart drawer", hdr.getByRole("button", { name: /Korpa/ }), { tag: vp.tag });
  await probe(page, "cart drawer (close button)", hdr.getByRole("button", { name: /Korpa/ }), { tag: vp.tag, closeWith: "button" });
  await probe(page, "hero vehicle field", page.locator("#hero-copy").getByRole("button", { name: /Izaberite vozilo/ }), { tag: vp.tag });
  await probe(page, "parts list", page.getByTestId("parts-list-trigger"), { tag: vp.tag });
  await probe(page, "parts list (close button)", page.getByTestId("parts-list-trigger"), { tag: vp.tag, closeWith: "button" });
  // Category listing filter sheet (mobile) / filters.
  await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(1200);
  await probe(page, "catalog filters", page.getByRole("button", { name: /Filteri|Filtriraj/ }), { tag: vp.tag });
  await probe(page, "header search (catalog page)", page.locator("header").getByRole("button", { name: /Broj dela ili naziv|Pretraga|Pretraži/ }), { tag: vp.tag });
  results.push({ tag: vp.tag, log });
  await ctx.close();
}
await browser.close();
writeFileSync(`docs/qa/audit/motion-3d/focus-return-${process.env.VP ?? "all"}.json`, JSON.stringify(results, null, 2));
