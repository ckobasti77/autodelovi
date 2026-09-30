// Copy track: what a signed-in non-staff user sees on admin URLs (forbidden()) and a guest on account/admin URLs.
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, loginWith, shot } from "./kit.mjs";
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const b = await launch();
const res = {};
for (const w of [1440, 390]) {
  const ctx = await newContext(b, { width: w, height: w < 800 ? 844 : 900, tag: `copy-forbidden-${w}` });
  const page = await ctx.newPage();
  if (w === 1440) {
    for (const u of ["/admin", "/majstor", "/nalog"]) {
      const r = await page.goto(`${BASE}${u}`, { waitUntil: "networkidle" });
      res[`guest ${u}`] = { status: r.status(), url: page.url(), title: await page.title(), text: (await page.evaluate(() => document.body.innerText)).slice(0, 600) };
    }
  }
  await loginWith(page, acc.customer.email, acc.customer.password, "/nalog");
  for (const u of ["/admin", "/admin/porudzbine", "/majstor"]) {
    const r = await page.goto(`${BASE}${u}`, { waitUntil: "networkidle" });
    res[`customer ${w} ${u}`] = { status: r.status(), url: page.url(), title: await page.title(), text: (await page.evaluate(() => document.body.innerText)).slice(0, 900) };
    await shot(page, `copy/forbidden-${u.replaceAll("/", "_")}-${w}`);
  }
  await ctx.close();
}
writeFileSync("docs/qa/audit/copy/forbidden.json", JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
await b.close();
