/** Step 21 audit (backend): reads the shared mechanic's credit terms (no tokens persisted). */
import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const c0 = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
const r = await c0.action(ref("auth:signIn"), { provider: "password", params: { email: acc.mechanic.email, password: acc.mechanic.password, flow: "signIn" } });
const c = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL); c.setAuth(r.tokens.token);
const p = await c.query(ref("mechanics:myProfile"), {});
const o = await c.query(ref("mechanicPortal:overview"), {});
console.log(JSON.stringify({ status: p?.status, tier: p?.tierName ?? p?.tier, creditEnabled: p?.creditEnabled, paymentTermsDays: p?.paymentTermsDays, credit: o?.credit }, null, 1));
await c.action(ref("auth:signOut"), {}).catch(() => {});
