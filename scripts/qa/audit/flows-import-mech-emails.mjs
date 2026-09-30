/**
 * Step 21 audit (flows-import-mech): /admin/mejlovi (log mode) — message sheet of the latest mechanic
 * order e-mail, links inside the HTML, plain-text part; template gallery (telefon / tekst); test send;
 * staff bell. Writes emails.json.
 *   node scripts/qa/audit/flows-import-mech-emails.mjs [orderNumber]
 */
import { writeFileSync } from "node:fs";

import { BASE, axe, launch, newContext, shot, watch } from "./kit.mjs";
import { loginAdminSafe } from "./flows-import-mech-lib.mjs";

const T = "flows-import-mech";
const number = process.argv[2] ?? "SK-2026-000131";
const out = { number };
const save = () => writeFileSync(`docs/qa/audit/${T}/emails.json`, JSON.stringify(out, null, 2));
const text = async (loc) => ((await loc.innerText().catch(() => "")) || "").replace(/\n{2,}/g, "\n").slice(0, 4000);

const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "fim-emails" });
const page = await ctx.newPage();
const log = watch(page);
await loginAdminSafe(page);

await page.goto(`${BASE}/admin/mejlovi`, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(6000);
out.list = (await text(page.locator("main"))).slice(0, 2500);
await shot(page, `${T}/emails-outbox-1440`);
out.outboxAxe = await axe(page);

const row = page.getByRole("row").filter({ hasText: number }).filter({ hasText: /primljena/i }).first();
if (await row.count()) {
  await row.click();
  await page.waitForTimeout(3500);
  const dlg = page.getByRole("dialog").first();
  out.sheet = await text(dlg);
  out.sheetLinks = await dlg.evaluate((d) => {
    const links = [...d.querySelectorAll("a[href]")].map((a) => a.href);
    const frames = [...d.querySelectorAll("iframe")].map((f) => {
      try {
        const doc = f.contentDocument;
        return {
          srcdoc: !!f.getAttribute("srcdoc"),
          sandbox: f.getAttribute("sandbox"),
          title: f.getAttribute("title"),
          links: doc ? [...doc.querySelectorAll("a[href]")].map((a) => `${a.textContent.trim().slice(0, 40)} -> ${a.getAttribute("href")}`) : null,
          text: doc ? doc.body.innerText.slice(0, 1800) : null,
        };
      } catch (e) {
        return { err: String(e) };
      }
    });
    return { links, frames };
  });
  await shot(page, `${T}/emails-sheet-order-received-1440`);
  // plain-text tab if present
  const tekst = dlg.getByRole("radio", { name: /Tekst/i }).or(dlg.getByRole("tab", { name: /Tekst/i })).first();
  if (await tekst.count()) {
    await tekst.click();
    await page.waitForTimeout(1200);
    out.sheetText = await text(dlg);
    await shot(page, `${T}/emails-sheet-order-received-text-1440`);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
} else out.sheet = "row not found";
save();

for (const [key, view] of [
  ["order_received", "telefon"],
  ["order_received", "tekst"],
  ["mechanic_approved", "telefon"],
  ["staff_order_new", "tekst"],
]) {
  await page.goto(`${BASE}/admin/mejlovi/sabloni?sablon=${key}&prikaz=${view}`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(5000);
  const sec = page.getByTestId("template-preview");
  const info = await sec.evaluate((s) => {
    const f = s.querySelector("iframe");
    let inner = null;
    try {
      const doc = f?.contentDocument;
      inner = doc
        ? {
            text: doc.body.innerText.slice(0, 1500),
            links: [...doc.querySelectorAll("a[href]")].map((a) => `${a.textContent.trim().slice(0, 30)} -> ${a.getAttribute("href")}`),
            scrollW: doc.documentElement.scrollWidth,
            clientW: doc.documentElement.clientWidth,
          }
        : null;
    } catch {}
    return { frameW: f?.getBoundingClientRect().width ?? null, frameH: f?.getBoundingClientRect().height ?? null, inner, pre: s.querySelector("pre")?.textContent?.slice(0, 1800) ?? null };
  }).catch((e) => ({ err: String(e) }));
  out[`tpl_${key}_${view}`] = { head: (await text(sec)).slice(0, 600), ...info };
  await shot(page, `${T}/emails-template-${key}-${view}-1440`);
}
save();

// test send (log mode)
await page.goto(`${BASE}/admin/mejlovi/sabloni?sablon=order_received&prikaz=telefon`, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(5000);
const testBtn = page.getByRole("button", { name: /test/i }).first();
out.testBtn = await testBtn.textContent().catch(() => null);
if (await testBtn.count()) {
  await testBtn.click();
  await page.waitForTimeout(3000);
  out.afterTest = (await text(page.locator("body"))).slice(-1200);
  await shot(page, `${T}/emails-test-send-1440`);
}
save();

// bell
const bell = page.getByTestId("admin-notification-bell").first();
if (await bell.count()) {
  out.bellLabel = await bell.getAttribute("aria-label");
  await bell.click();
  await page.waitForTimeout(2500);
  const panel = page.getByRole("dialog").or(page.locator("[role=menu]")).first();
  out.bell = (await text(panel)).slice(0, 2500);
  await shot(page, `${T}/emails-bell-1440`);
}
out.log = log;
save();
console.log(JSON.stringify(out, null, 1).slice(0, 16000));
await browser.close();
