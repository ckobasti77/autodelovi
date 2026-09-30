/**
 * Step 21 audit (flows-import-mech): read-only dump of admin screens needed to verify mechanic
 * prices and notifications (tiers, the audit mechanic's terms, sales settings, presets, history).
 *   node scripts/qa/audit/flows-import-mech-admin-dump.mjs [path ...]
 */
import { writeFileSync } from "node:fs";

import { BASE, launch, newContext, shot, watch } from "./kit.mjs";
import { ACCOUNTS, loginAdminSafe } from "./flows-import-mech-lib.mjs";

const T = "flows-import-mech";
const paths = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "/admin/cenovni-razredi",
      `/admin/majstori/${ACCOUNTS.mechanic.approval.profileId}`,
      "/admin/podesavanja?tab=prodaja",
      "/admin/uvoz/istorija",
    ];
const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "fim-dump" });
const page = await ctx.newPage();
const log = watch(page);
await loginAdminSafe(page);
const out = {};
for (const p of paths) {
  await page.goto(`${BASE}${p}`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(5000);
  out[p] = await page.locator("main").innerText().catch(() => "");
  await shot(page, `${T}/dump-${p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "")}-1440`, { fullPage: true });
}
out.log = log;
const name = process.env.DUMP_NAME ?? "admin-dump";
writeFileSync(`docs/qa/audit/${T}/${name}.json`, JSON.stringify(out, null, 2));
for (const [k, v] of Object.entries(out)) console.log(`=== ${k}\n${typeof v === "string" ? v.slice(0, 5000) : JSON.stringify(v)}`);
await browser.close();
