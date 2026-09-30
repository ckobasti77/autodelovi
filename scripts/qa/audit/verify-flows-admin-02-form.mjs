// Verify flows-admin-02 scope: the public /upit form at 390 allows Viber/WhatsApp with phone only (e-mail optional).
import { writeFileSync } from "node:fs";
import { launch, newContext, shot, BASE } from "./kit.mjs";
const browser = await launch();
try {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "vfa02f" });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/upit`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await p.waitForTimeout(3000);
  await p.getByRole("radiogroup", { name: "Kako da vam odgovorimo?" }).getByRole("radio", { name: "Viber" }).click();
  await p.waitForTimeout(500);
  const email = p.locator("#iq-email");
  await email.scrollIntoViewIfNeeded();
  const labels = await p.evaluate(() =>
    [...document.querySelectorAll("label")].map((l) => (l.textContent ?? "").replace(/\s+/g, " ").trim()).filter((t) => /E-po|Telefon|odgovor/i.test(t)),
  );
  console.log(JSON.stringify(labels));
  await shot(p, "verify/flows-admin/flows-admin-02-reproduce-390-upit-viber");
  writeFileSync("docs/qa/audit/verify/flows-admin/flows-admin-02-reproduce-390-upit-viber.json", JSON.stringify({ labels, emailRequired: await email.evaluate((e) => e.required) }, null, 2));
} finally {
  await browser.close();
}
