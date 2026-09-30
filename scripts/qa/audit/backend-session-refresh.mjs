/**
 * Step 21 audit (backend): does every signed-in page request rotate the Convex Auth session?
 * Signs in the shared customer on :3100, then loads 6 pages ~3 s apart and records whether the
 * JWT / refresh-token cookies change between requests (values are never printed or stored —
 * only a short SHA-256 fingerprint to compare them).
 * Output: docs/qa/audit/backend/session-refresh.json
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { BASE, launch, loginWith, newContext } from "./kit.mjs";

const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const fp = (v) => (v ? createHash("sha256").update(v).digest("hex").slice(0, 10) : null);

const browser = await launch("chromium");
const context = await newContext(browser, { width: 1440, height: 900, tag: "backend-session" });
const page = await context.newPage();
const rows = [];
const snap = async (label) => {
  const cookies = await context.cookies(BASE);
  const jwt = cookies.find((c) => /convexAuthJWT/.test(c.name));
  const refresh = cookies.find((c) => /convexAuthRefreshToken/.test(c.name));
  rows.push({
    label,
    at: new Date().toISOString(),
    jwt: fp(jwt?.value),
    refresh: fp(refresh?.value),
    jwtExpires: jwt?.expires ? new Date(jwt.expires * 1000).toISOString() : null,
    cookieNames: cookies.map((c) => c.name).filter((n) => /convex/i.test(n)),
  });
};
try {
  await loginWith(page, acc.customer.email, acc.customer.password, "/nalog");
  await snap("after sign-in");
  for (const path of ["/nalog", "/delovi", "/nalog/porudzbine", "/korpa", "/", "/nalog"]) {
    await new Promise((r) => setTimeout(r, 3000));
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await snap(`GET ${path}`);
  }
} finally {
  await browser.close();
}
let jwtChanges = 0;
let refreshChanges = 0;
for (let i = 1; i < rows.length; i++) {
  if (rows[i].jwt !== rows[i - 1].jwt) jwtChanges++;
  if (rows[i].refresh !== rows[i - 1].refresh) refreshChanges++;
}
const out = { requests: rows.length - 1, jwtChanges, refreshChanges, rows };
writeFileSync("docs/qa/audit/backend/session-refresh.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
