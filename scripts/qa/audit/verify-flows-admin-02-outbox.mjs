// Verify flows-admin-02: which outbox rows exist for an inquiry number (customer vs staff).
import { writeFileSync } from "node:fs";
import { launch, shot } from "./kit.mjs";
import { ownerCtx, go } from "./flows-admin-lib2.mjs";
const [NUM] = process.argv.slice(2);
const browser = await launch();
try {
  const ctx = await ownerCtx(browser, { tag: "vfa02o" });
  const p = await go(ctx, `/admin/mejlovi`);
  await new Promise((r) => setTimeout(r, 2000));
  const rows = await p.evaluate((num) =>
    [...document.querySelectorAll("main tr, main li")]
      .map((r) => (r.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter((t) => t.includes(num)),
  NUM);
  console.log(JSON.stringify(rows, null, 1));
  const row = p.locator("main tr", { hasText: NUM }).first();
  if (await row.count()) await row.scrollIntoViewIfNeeded();
  await shot(p, `verify/flows-admin/flows-admin-02-reproduce-outbox`);
  writeFileSync("docs/qa/audit/verify/flows-admin/flows-admin-02-reproduce-outbox.json", JSON.stringify({ NUM, rows }, null, 2));
} finally {
  await browser.close();
}
