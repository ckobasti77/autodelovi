// Copy track: plain-text view of every e-mail template from the admin gallery (sample data + current settings).
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, loginAdmin, shot } from "./kit.mjs";
const KEYS = ["order_received","order_confirmed","order_backordered","order_ready_pickup","order_shipped","order_delivered","order_cancelled","inquiry_received","quote_ready","quote_expiring","back_in_stock","mechanic_registration_received","mechanic_approved","mechanic_rejected","mechanic_suspended","password_reset_code","staff_invite","staff_order_new","staff_inquiry_new","staff_mechanic_new","staff_quote_accepted","staff_quote_renewal","staff_low_stock","staff_daily_digest","staff_reminder"];
const b = await launch();
const ctx = await newContext(b, { width: 1440, height: 900, tag: "copy-emails" });
const page = await ctx.newPage();
await loginAdmin(page);
let out = "";
for (const k of KEYS) {
  await page.goto(`${BASE}/admin/mejlovi/sabloni?sablon=${k}&prikaz=tekst`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const t = await page.evaluate(() => {
    const pre = [...document.querySelectorAll("pre")].map((p) => p.innerText).join("\n");
    const f = document.querySelector("iframe[srcdoc]");
    let html = "";
    if (f) html = new DOMParser().parseFromString(f.getAttribute("srcdoc"), "text/html").body.textContent;
    const head = [...document.querySelectorAll("main dl, main dt, main dd")].slice(0, 6).map((e) => e.innerText).join(" | ");
    return { pre, html, head };
  });
  out += `\n\n######## ${k}\n${t.head}\n${t.pre || t.html}`;
  if (["order_confirmed", "mechanic_approved", "staff_daily_digest"].includes(k)) {
    await page.goto(`${BASE}/admin/mejlovi/sabloni?sablon=${k}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    await shot(page, `copy/email-${k}`);
  }
}
writeFileSync("docs/qa/audit/copy/emails-text.txt", out);
console.log(out.length);
await b.close();
