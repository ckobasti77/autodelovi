/**
 * Step 21 audit (backend track): live authorization probe against the dev deployment.
 *
 * - Signs in owner / customer / mechanic through the Convex Auth password flow (tokens stay in
 *   memory, never written anywhere) and calls every staff/owner/user **query** as anonymous,
 *   customer and mechanic. Args are generated from `convex function-spec`; ids come from the
 *   owner's own staff-query results (trial against the validator, queries only).
 * - Every call must be rejected with UNAUTHENTICATED / FORBIDDEN (or return nothing sensitive);
 *   an owner call with the same args proves the args were valid (so the rejection is authz).
 * - Scans every public query payload (anonymous) for sensitive keys.
 * Output: docs/qa/audit/backend/authz-probe.json (no tokens, no PII values).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const OUT = path.resolve("docs/qa/audit/backend");
mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const URL_ = env.NEXT_PUBLIC_CONVEX_URL;
const accounts = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));

const spec = JSON.parse(
  execFileSync(process.execPath, [path.resolve("node_modules/convex/bin/main.js"), "function-spec"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }),
);
const scan = JSON.parse(readFileSync(path.join(OUT, "function-scan.json"), "utf8"));
const builderOf = new Map(
  scan.results.map((r) => [r.file.replace(/^convex\//, "").replace(/\.ts$/, "") + ":" + r.name, r.builder]),
);
const fns = spec.functions
  .filter((f) => f.identifier && f.visibility?.kind === "public")
  .map((f) => ({ ...f, name: f.identifier.replace(/\.js:/, ":") }));

const ref = (name, kind) => makeFunctionReference(name);

async function signIn(email, password) {
  const c = new ConvexHttpClient(URL_);
  const res = await c.action(ref("auth:signIn"), {
    provider: "password",
    params: { email, password, flow: "signIn" },
  });
  const token = res?.tokens?.token;
  if (!token) throw new Error(`sign-in failed for ${email.replace(/@.*/, "@…")}`);
  const client = new ConvexHttpClient(URL_);
  client.setAuth(token);
  return client;
}

const idPool = new Map(); // table -> Set(ids)
const unknownIds = new Set();
function harvest(value, keyHint) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) return value.forEach((v) => harvest(v, keyHint));
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) harvest(v, k);
    return;
  }
  if (typeof value === "string" && /^[a-z0-9]{31,32}$/.test(value)) unknownIds.add(value);
}

function gen(t, idFor, pathName) {
  switch (t.type) {
    case "string":
      return "x";
    case "number":
      return 1;
    case "boolean":
      return false;
    case "null":
      return null;
    case "literal":
      return t.value;
    case "id":
      return idFor(t.tableName, pathName);
    case "array":
      return [];
    case "record":
      return {};
    case "any":
      return null;
    case "union": {
      const nonNull = t.value.find((m) => m.type === "null");
      if (nonNull && pathName === "cursor") return null;
      return gen(t.value[0], idFor, pathName);
    }
    case "object": {
      const o = {};
      for (const [k, f] of Object.entries(t.value)) {
        if (f.optional) continue;
        o[k] = k === "numItems" ? 5 : gen(f.fieldType, idFor, k);
      }
      return o;
    }
    case "bytes":
      return new ArrayBuffer(1);
    case "int64":
      return 1n;
    default:
      return null;
  }
}

function needsIds(t, acc = []) {
  if (!t) return acc;
  if (t.type === "id") acc.push(t.tableName);
  if (t.type === "object") for (const f of Object.values(t.value)) if (!f.optional) needsIds(f.fieldType, acc);
  if (t.type === "union") needsIds(t.value[0], acc);
  return acc;
}

function errInfo(e) {
  const data = e?.data;
  if (data && typeof data === "object" && data.code) return { kind: "convex", code: data.code };
  const msg = String(e?.message ?? e);
  if (/ArgumentValidationError|does not match validator|Object is missing the required field|Value does not match/i.test(msg))
    return { kind: "args", msg: msg.slice(0, 240) };
  return { kind: "error", msg: msg.slice(0, 240) };
}

const SENSITIVE = /cost|margin|tokenHash|publicTokenHash|guestTokenHash|password|secret|personalRules|creditLimit|capiContext|ipHash|userAgent|^ip$|uploaderKey|resetCode|inviteToken/i;
const PII = /^(email|phone|pib|mb|address|street)$/i;
function sensitiveKeys(value, trail = "", out = new Set()) {
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    value.slice(0, 50).forEach((v) => sensitiveKeys(v, trail + "[]", out));
    return out;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE.test(k) || PII.test(k)) out.add(`${trail}.${k}`);
      sensitiveKeys(v, `${trail}.${k}`, out);
    }
  }
  return out;
}

const main = async () => {
  const anon = new ConvexHttpClient(URL_);
  const owner = await signIn(process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD);
  const customer = await signIn(accounts.customer.email, accounts.customer.password);
  const mechanic = await signIn(accounts.mechanic.email, accounts.mechanic.password);
  const who = {
    owner: (await owner.query(ref("users:viewer"), {}))?.role,
    customer: (await customer.query(ref("users:viewer"), {}))?.role,
    mechanic: (await mechanic.query(ref("users:viewer"), {}))?.role,
  };

  const queries = fns.filter((f) => f.functionType === "Query");
  const protectedQ = queries.filter((f) =>
    ["staffQuery", "ownerQuery", "userQuery"].includes(builderOf.get(f.name)),
  );

  // Pass 1: owner calls without ids to harvest id candidates.
  for (const f of protectedQ) {
    if (needsIds(f.args).length) continue;
    try {
      const r = await owner.query(ref(f.name), gen(f.args, () => null));
      harvest(r);
    } catch {}
  }
  // Public catalogue ids too.
  for (const [n, a] of [
    ["catalog/categories:tree", {}],
    ["catalog/manufacturers:list", {}],
    ["catalog/vehicles:brands", {}],
    ["catalog/products:bySlug", { slug: "kocioni-disk-prednji-276-24-mm-demo-0004" }],
  ]) {
    try {
      harvest(await anon.query(ref(n), a));
    } catch {}
  }
  const tableOfId = new Map();
  const pool = [...unknownIds];
  const results = [];

  // Resolve args for id-taking queries by trial as owner (queries are read-only).
  async function argsFor(f) {
    const tables = needsIds(f.args);
    if (tables.length === 0) return { args: gen(f.args, () => null), ok: true };
    const chosen = {};
    for (const table of new Set(tables)) {
      const known = [...tableOfId.entries()].find(([, t]) => t === table)?.[0];
      if (known) {
        chosen[table] = known;
        continue;
      }
      for (const id of pool) {
        if (tableOfId.has(id)) continue;
        const trial = gen(f.args, (t) => (t === table ? id : chosen[t] ?? pool[0]));
        try {
          await owner.query(ref(f.name), trial);
          tableOfId.set(id, table);
          chosen[table] = id;
          break;
        } catch (e) {
          const info = errInfo(e);
          const mismatchThis = info.kind === "args" && info.msg.includes(`v.id("${table}")`);
          if (!mismatchThis) {
            tableOfId.set(id, table);
            chosen[table] = id;
            break;
          }
        }
      }
      if (!chosen[table]) return { args: null, ok: false, missing: table };
    }
    return { args: gen(f.args, (t) => chosen[t]), ok: true };
  }

  for (const f of protectedQ) {
    const builder = builderOf.get(f.name);
    const { args, ok, missing } = await argsFor(f);
    const row = { fn: f.name, builder, argsResolved: ok, ...(missing ? { missingIdTable: missing } : {}) };
    if (!ok) {
      results.push(row);
      continue;
    }
    for (const [label, client] of [
      ["owner", owner],
      ["anonymous", anon],
      ["customer", customer],
      ["mechanic", mechanic],
    ]) {
      try {
        const r = await client.query(ref(f.name), args);
        row[label] = { allowed: true, empty: r === null || (Array.isArray(r) && r.length === 0) };
      } catch (e) {
        row[label] = { allowed: false, ...errInfo(e) };
      }
    }
    const expectDenied =
      builder === "userQuery" ? ["anonymous"] : ["anonymous", "customer", "mechanic"];
    row.violation = expectDenied.filter((l) => row[l]?.allowed);
    row.conclusive = row.owner?.allowed || row.owner?.kind === "convex";
    results.push(row);
  }

  // Public queries: anonymous payload scan.
  const publicSamples = {
    "catalog/products:bySlug": { slug: "kocioni-disk-prednji-276-24-mm-demo-0004" },
    "catalog/products:listByCategory": { categorySlug: "kocioni-diskovi" },
    "catalog/categories:bySlug": { slug: "kocioni-diskovi" },
    "catalog/codes:lookup": { code: "5Q0615505R" },
    "search:run": { q: "disk" },
    "search:suggest": { q: "disk" },
    "seo:landing": { categorySlug: "kocioni-diskovi", brandSlug: "volkswagen" },
    "seo:adLanding": { slug: "kocione-plocice-golf" },
    "catalog/vehicles:models": { brandSlug: "volkswagen" },
    "settings:getPublic": {},
    "settings:getTracking": {},
    "pricing:publicTiers": {},
    "seo:sitemapData": {},
    "seo:feedProducts": {},
    "seo:sitemapProducts": {},
    "catalog/vehicles:tree": {},
    "content:faqs": {},
  };
  const publicScan = [];
  for (const f of queries.filter((q) => builderOf.get(q.name) === "publicQuery")) {
    let args = publicSamples[f.name];
    if (!args) args = gen(f.args, (t) => [...tableOfId.entries()].find(([, tt]) => tt === t)?.[0] ?? pool[0]);
    try {
      const r = await anon.query(ref(f.name), args);
      publicScan.push({ fn: f.name, ok: true, sensitiveKeys: [...sensitiveKeys(r)], size: JSON.stringify(r ?? null).length });
    } catch (e) {
      publicScan.push({ fn: f.name, ok: false, ...errInfo(e) });
    }
  }

  // Price visibility: forProducts anonymous vs mechanic.
  const pid = [...tableOfId.entries()].find(([, t]) => t === "products")?.[0];
  const priceCheck = {};
  if (pid) {
    priceCheck.anonymous = await anon.query(ref("pricing:forProducts"), { productIds: [pid] });
    priceCheck.customer = await customer.query(ref("pricing:forProducts"), { productIds: [pid] });
    priceCheck.mechanic = await mechanic.query(ref("pricing:forProducts"), { productIds: [pid] });
  }

  // Cross-account: customer asks for someone else's order by number; wrong tokens.
  const cross = {};
  const tryQ = async (client, n, a) => {
    try {
      const r = await client.query(ref(n), a);
      return r === null ? "null" : Array.isArray(r) ? `array(${r.length})` : "OBJECT RETURNED";
    } catch (e) {
      return JSON.stringify(errInfo(e));
    }
  };
  cross.customerMyOrderForeign = await tryQ(customer, "orders:myOrder", { number: "SK-2026-000092" });
  cross.mechanicMyOrderForeign = await tryQ(mechanic, "orders:myOrder", { number: "SK-2026-000092" });
  cross.orderWrongToken = await tryQ(anon, "orders:getByToken", { token: "A".repeat(43) });
  cross.orderShortToken = await tryQ(anon, "orders:getByToken", { token: "abc" });
  cross.inquiryWrongToken = await tryQ(anon, "inquiries:getByToken", { token: "B".repeat(43) });
  cross.inviteWrongToken = await tryQ(anon, "staff:inviteInfo", { token: "C".repeat(43) });

  for (const c of [owner, customer, mechanic]) {
    try {
      await c.action(ref("auth:signOut"), {});
    } catch {}
  }

  const violations = results.filter((r) => r.violation?.length);
  const summary = {
    viewers: who,
    protectedQueries: protectedQ.length,
    argsResolved: results.filter((r) => r.argsResolved).length,
    conclusive: results.filter((r) => r.conclusive).length,
    violations: violations.map((r) => `${r.fn}: ${r.violation.join(",")}`),
    publicQueries: publicScan.length,
    publicWithSensitiveKeys: publicScan.filter((p) => p.sensitiveKeys?.length).map((p) => `${p.fn}: ${p.sensitiveKeys.join(" ")}`),
    publicErrors: publicScan.filter((p) => !p.ok).map((p) => `${p.fn}: ${p.code ?? p.msg}`),
    priceCheck,
    cross,
  };
  writeFileSync(path.join(OUT, "authz-probe.json"), JSON.stringify({ summary, results, publicScan }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
};

main().catch((e) => {
  console.error("probe failed:", String(e?.message ?? e).slice(0, 400));
  process.exit(1);
});
