/**
 * Step 21 audit (backend track): data-integrity checks on the dev deployment, read through the
 * owner's staff queries (read-only; the owner token stays in memory).
 *
 *  - orders: Σ lines = itemsPara, line = unit × qty, items + delivery = total, VAT, item counts,
 *    discount = retail − items, delivery price vs the free-over rule, numbering gaps/duplicates,
 *    stock commitment vs status.
 *  - stock movements: qtyAfter = qtyBefore + delta, chain continuity per product, last qtyAfter
 *    = current product stock.
 *  - products: category present, fitment generations exist in the public vehicle tree.
 *  - inquiries: numbering gaps/duplicates.
 * Output: docs/qa/audit/backend/integrity.json (numbers / SKUs only, no personal data).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";

const OUT = path.resolve("docs/qa/audit/backend");
mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const URL_ = env.NEXT_PUBLIC_CONVEX_URL;

async function signIn(email, password) {
  const c = new ConvexHttpClient(URL_);
  const res = await c.action(ref("auth:signIn"), { provider: "password", params: { email, password, flow: "signIn" } });
  const client = new ConvexHttpClient(URL_);
  client.setAuth(res.tokens.token);
  return client;
}

async function all(client, name, extra = {}) {
  const out = [];
  let cursor = null;
  for (let i = 0; i < 200; i++) {
    const r = await client.query(ref(name), { ...extra, paginationOpts: { numItems: 100, cursor } });
    out.push(...r.page);
    if (r.isDone) break;
    cursor = r.continueCursor;
  }
  return out;
}

const main = async () => {
  const owner = await signIn(process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD);
  const settings = await owner.query(ref("settings:getAdmin"), {});
  const vatBp = settings?.commerce?.vatRateBp ?? 2000;
  const delivery = settings?.deliveryMethods ?? [];
  const report = { orders: {}, stock: {}, products: {}, inquiries: {} };

  // ---------------------------------------------------------------- orders
  const list = await all(owner, "ordersAdmin:list");
  const problems = [];
  const bySeq = new Map();
  const stockIssues = [];
  let checked = 0;
  for (const row of list) {
    const d = await owner.query(ref("ordersAdmin:get"), { number: row.number });
    if (!d) {
      problems.push(`${row.number}: get returned null`);
      continue;
    }
    checked++;
    const o = d.order;
    const m = /^([A-Z]+)-(\d{4})-(\d{6})$/.exec(o.number);
    if (m) {
      const key = `${m[1]}-${m[2]}`;
      if (!bySeq.has(key)) bySeq.set(key, []);
      bySeq.get(key).push(Number(m[3]));
    } else problems.push(`${o.number}: number format`);
    let items = 0;
    let retail = 0;
    let qty = 0;
    for (const it of d.items) {
      if (it.lineTotalPara !== it.unitPricePara * it.quantity)
        problems.push(`${o.number}/${it.sku}: line ${it.lineTotalPara} ≠ ${it.unitPricePara}×${it.quantity}`);
      if (it.unitPricePara > it.unitRetailPara)
        problems.push(`${o.number}/${it.sku}: unit price ${it.unitPricePara} > retail ${it.unitRetailPara}`);
      items += it.lineTotalPara;
      retail += it.unitRetailPara * it.quantity;
      qty += it.quantity;
      if (o.status !== "nova" && o.status !== "otkazana" && !it.isCustomLine && it.productId && it.committedQty === null)
        stockIssues.push(`${o.number}/${it.sku}: status ${o.status} but committedQty null`);
    }
    if (items !== o.itemsPara) problems.push(`${o.number}: Σ lines ${items} ≠ itemsPara ${o.itemsPara}`);
    if (retail !== o.itemsRetailPara) problems.push(`${o.number}: Σ retail ${retail} ≠ itemsRetailPara ${o.itemsRetailPara}`);
    if (o.itemsRetailPara - o.itemsPara !== o.discountPara)
      problems.push(`${o.number}: discount ${o.discountPara} ≠ retail−items ${o.itemsRetailPara - o.itemsPara}`);
    if (o.itemsPara + o.deliveryPara !== o.totalPara)
      problems.push(`${o.number}: items ${o.itemsPara} + delivery ${o.deliveryPara} ≠ total ${o.totalPara}`);
    const vat = Math.round((o.totalPara * vatBp) / (10_000 + vatBp));
    if (o.vatPara !== undefined && o.vatPara !== vat) problems.push(`${o.number}: vat ${o.vatPara} ≠ ${vat}`);
    if (row.itemCount !== qty) problems.push(`${o.number}: itemCount ${row.itemCount} ≠ Σ qty ${qty}`);
    if (row.totalPara !== o.totalPara) problems.push(`${o.number}: list total ${row.totalPara} ≠ detail ${o.totalPara}`);
    const dm = delivery.find((x) => x.code === o.deliveryMethod);
    if (dm) {
      const expected = dm.freeOverPara !== undefined && o.itemsPara >= dm.freeOverPara ? 0 : dm.pricePara;
      if (expected !== o.deliveryPara)
        problems.push(`${o.number}: delivery ${o.deliveryPara} ≠ current rule ${expected} (${o.deliveryMethod}, items ${o.itemsPara}, source ${o.source}, demo ${o.isDemo})`);
    }
    if (o.paymentMethod === "deferred" && o.dueAt === null) problems.push(`${o.number}: deferred without dueAt`);
  }
  const numbering = {};
  for (const [key, seqs] of bySeq) {
    const sorted = [...seqs].sort((a, b) => a - b);
    const dup = sorted.filter((s, i) => i > 0 && s === sorted[i - 1]);
    const max = sorted.at(-1);
    const missing = [];
    for (let s = 1; s <= max; s++) if (!sorted.includes(s)) missing.push(s);
    numbering[key] = { count: sorted.length, min: sorted[0], max, duplicates: dup, missing: missing.slice(0, 50) };
  }
  report.orders = { listed: list.length, checked, problems, stockIssues: stockIssues.slice(0, 40), stockIssueCount: stockIssues.length, numbering };

  // ---------------------------------------------------------------- products + stock
  const products = await all(owner, "exportsAdmin:productsPage", { includeDemo: true });
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const adminTree = await owner.query(ref("catalog/vehiclesAdmin:tree"), {});
  const tree = [];
  for (const b of adminTree) for (const m of b.models) tree.push(...(await owner.query(ref("catalog/vehiclesAdmin:generations"), { modelId: m._id })).map((g) => ({ _id: g._id })));
  const genIds = new Set();
  const collect = (v) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(collect);
    for (const [k, val] of Object.entries(v)) {
      if ((k === "_id" || k === "generationId" || k === "id") && typeof val === "string") genIds.add(val);
      collect(val);
    }
  };
  collect(tree);
  const productProblems = [];
  for (const p of products) {
    if (!p.category) productProblems.push(`${p.sku}: no category`);
    if (p.retailPricePara <= 0 && p.active) productProblems.push(`${p.sku}: active with price ${p.retailPricePara}`);
    if (p.stockQty < 0) productProblems.push(`${p.sku}: negative stock ${p.stockQty}`);
    if (p.costNetPara !== null && p.costNetPara > p.retailPricePara)
      productProblems.push(`${p.sku}: cost net ${p.costNetPara} > retail gross ${p.retailPricePara}`);
    for (const f of p.fitments) if (genIds.size && !genIds.has(f.generationId)) productProblems.push(`${p.sku}: fitment → unknown generation ${f.generationId}`);
  }
  report.products = { count: products.length, active: products.filter((p) => p.active).length, demo: products.filter((p) => p.isDemo).length, generationIdsKnown: genIds.size, problems: productProblems.slice(0, 60), problemCount: productProblems.length };

  const moves = await all(owner, "stock:movements");
  const chains = new Map();
  const moveProblems = [];
  for (const mv of moves) {
    if (mv.qtyAfter !== mv.qtyBefore + mv.delta && !(mv.qtyAfter === 0 && mv.qtyBefore + mv.delta < 0))
      moveProblems.push(`${mv.sku} ${mv.reason} ${mv.refId ?? ""}: ${mv.qtyBefore} + ${mv.delta} ≠ ${mv.qtyAfter}`);
    if (!chains.has(mv.sku)) chains.set(mv.sku, []);
    chains.get(mv.sku).push(mv);
  }
  const chainProblems = [];
  for (const [sku, list2] of chains) {
    const s = [...list2].sort((a, b) => a.at - b.at);
    for (let i = 1; i < s.length; i++)
      if (s[i].qtyBefore !== s[i - 1].qtyAfter)
        chainProblems.push(`${sku}: gap ${s[i - 1].reason}→${s[i].reason} after ${s[i - 1].qtyAfter} next before ${s[i].qtyBefore}`);
    const p = bySku.get(sku);
    if (p && s.at(-1).qtyAfter !== p.stockQty)
      chainProblems.push(`${sku}: last movement qtyAfter ${s.at(-1).qtyAfter} ≠ product stock ${p.stockQty}`);
  }
  const noMovement = products.filter((p) => p.stockQty !== 0 && !chains.has(p.sku)).map((p) => `${p.sku} (${p.isDemo ? "demo" : "real"}, active ${p.active}, stock ${p.stockQty})`);
  const clamped = moves.filter((mv) => mv.qtyBefore + mv.delta < 0);
  report.stock = {
    movements: moves.length,
    products: chains.size,
    arithmeticProblems: moveProblems.slice(0, 40),
    chainProblems: chainProblems.slice(0, 60),
    chainProblemCount: chainProblems.length,
    clampedAtZero: clamped.map((mv) => `${mv.sku} ${mv.reason} ${mv.refId ?? ""}: ${mv.qtyBefore}${mv.delta} → ${mv.qtyAfter}`).slice(0, 20),
    stockWithoutAnyMovement: noMovement.slice(0, 60),
    stockWithoutAnyMovementCount: noMovement.length,
    byReason: moves.reduce((a, mv) => ((a[mv.reason] = (a[mv.reason] ?? 0) + 1), a), {}),
  };

  // ---------------------------------------------------------------- inquiries
  const inq = await all(owner, "inquiriesAdmin:list");
  const iseq = new Map();
  for (const i of inq) {
    const m = /^([A-Z]+)-(\d{4})-(\d{6})$/.exec(i.number);
    if (!m) continue;
    const key = `${m[1]}-${m[2]}`;
    if (!iseq.has(key)) iseq.set(key, []);
    iseq.get(key).push(Number(m[3]));
  }
  const inum = {};
  for (const [key, seqs] of iseq) {
    const sorted = [...seqs].sort((a, b) => a - b);
    const missing = [];
    for (let s = 1; s <= sorted.at(-1); s++) if (!sorted.includes(s)) missing.push(s);
    inum[key] = { count: sorted.length, max: sorted.at(-1), duplicates: sorted.filter((s, i) => i > 0 && s === sorted[i - 1]), missing };
  }
  report.inquiries = { count: inq.length, byStatus: inq.reduce((a, i) => ((a[i.status] = (a[i.status] ?? 0) + 1), a), {}), numbering: inum };

  try {
    await owner.action(ref("auth:signOut"), {});
  } catch {}
  writeFileSync(path.join(OUT, "integrity.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2).slice(0, 12000));
};

main().catch((e) => {
  console.error("integrity failed:", String(e?.message ?? e).slice(0, 500));
  process.exit(1);
});
