// COPY-06: server HTML of the admin 403 for a signed-in customer (status, <title>, body text).
import { readFileSync } from "node:fs";
import { BASE, launch, newContext, loginWith } from "../audit/kit.mjs";
const accounts = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const browser = await launch();
try {
  const ctx = await newContext(browser, { width: 1440, tag: "fix-403html" });
  const p = await ctx.newPage();
  await loginWith(p, accounts.customer.email, accounts.customer.password, "/nalog");
  for (const route of process.argv.slice(2).length ? process.argv.slice(2) : ["/admin", "/admin/korisnici"]) {
    const r = await ctx.request.get(BASE + route, { maxRedirects: 0 });
    const html = await r.text();
    const titles = [...html.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]);
    const body = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    console.log(route, r.status(), JSON.stringify(titles), "| h1:", /<h1/.test(html.replace(/<script[\s\S]*?<\/script>/g, "")), "| body:", body.slice(0, 160));
  }
  await ctx.close();
} finally {
  await browser.close();
}
