/** Step 21 audit (backend): owner's in-app notifications grouped by type (reminders on demo records). */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const c0 = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
const r = await c0.action(ref("auth:signIn"), { provider: "password", params: { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD, flow: "signIn" } });
const c = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL); c.setAuth(r.tokens.token);
const mine = await c.query(ref("notifications:mine"), { paginationOpts: { numItems: 200, cursor: null } });
const rows = Array.isArray(mine) ? mine : mine.page ?? mine.items ?? [];
const byType = {};
for (const n of rows) { const k = n.type ?? n.kind ?? "?"; byType[k] = (byType[k] ?? 0) + 1; }
const reminders = rows.filter((n) => /reminder|podsetnik/i.test(JSON.stringify(n))).slice(0, 8).map((n) => ({ type: n.type, title: n.title, body: (n.body ?? "").slice(0, 120), at: n.createdAt ?? n._creationTime }));
const kpis = await c.query(ref("dashboard:kpis"), {}).catch((e) => String(e.message).slice(0, 100));
const out = { total: rows.length, byType, reminders, sampleKeys: Object.keys(rows[0] ?? {}), kpis };
writeFileSync("docs/qa/audit/backend/notifications-owner.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 3000));
await c.action(ref("auth:signOut"), {}).catch(() => {});
