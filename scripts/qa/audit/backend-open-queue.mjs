import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const c0 = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
const r = await c0.action(ref("auth:signIn"), { provider: "password", params: { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD, flow: "signIn" } });
const c = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL); c.setAuth(r.tokens.token);
const nova = [];
let cursor = null;
for (;;) { const p = await c.query(ref("ordersAdmin:list"), { status: "nova", paginationOpts: { numItems: 100, cursor } }); nova.push(...p.page); if (p.isDone) break; cursor = p.continueCursor; }
const inq = [];
cursor = null;
for (;;) { const p = await c.query(ref("inquiriesAdmin:list"), { status: "nov", paginationOpts: { numItems: 100, cursor } }); inq.push(...p.page); if (p.isDone) break; cursor = p.continueCursor; }
console.log(JSON.stringify({ novaOrders: nova.length, novaDemo: nova.filter((o) => o.isDemo).length, novInquiries: inq.length, novDemo: inq.filter((i) => i.isDemo).length, sample062: nova.find((o) => o.number === "SK-2026-000062")?.isDemo }));
await c.action(ref("auth:signOut"), {}).catch(() => {});
