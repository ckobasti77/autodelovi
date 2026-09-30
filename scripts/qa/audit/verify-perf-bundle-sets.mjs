// verify track perf-bundle-04: in-chunk gzip delta of deferring whole module sets per route.
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";
import { gzipSync } from "node:zlib";
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const gz = (s) => gzipSync(Buffer.from(s), { level: 6 }).length;
const kb = (n) => (n / 1024).toFixed(1);
const ROUTES = ["/", "/delovi", "/delovi/kocioni-diskovi", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", "/pretraga?q=disk", "/ponuda/kocione-plocice-golf", "/korpa", "/prijava"];
const mods = new Map(), chunkMods = new Map();
function load(name) {
  if (chunkMods.has(name)) return;
  const pushed = [];
  try { vm.runInNewContext(readFileSync(`.next/static/chunks/${name}`, "utf8"), { TURBOPACK: { push: (a) => pushed.push(a) } }, { timeout: 2000 }); } catch { chunkMods.set(name, []); return; }
  const ids = [];
  for (const arr of pushed) { let id = null; for (const it of arr.slice(1)) { if (typeof it !== "function") { id = it; continue; } const k = `${name}#${id}`; mods.set(k, it.toString()); ids.push(k); } }
  chunkMods.set(name, ids);
}
const T = {
  radixDialog: (c) => c.includes('"DialogTrigger"'), focusScope: (c) => c.includes("focusScope.autoFocusOnMount"), focusGuards: (c) => c.includes("data-radix-focus-guard"),
  removeScroll: (c) => c.includes("right-scroll-bar-position"), hideOthers: (c) => c.includes("in not contained inside"), uiSheet: (c) => c.includes("data-no-drag") && c.includes("Zatvori"),
  uiDialog: (c) => /"Dialog"/.test(c) && c.includes("items-center") && !c.includes('"DialogTrigger"'), overlayMotionHook: (c) => c.includes('"useOverlayMotion"') && c.length < 3000,
  dismissableLayer: (c) => c.includes("dismissableLayer.update"), presence: (c) => c.includes("useStateMachine") && c.includes('"Presence"'),
  toast: (c) => c.includes('"ToastProvider"'), collection: (c) => c.includes('"CollectionProvider"'),
  consentBanner: (c) => c.includes('"ConsentBanner"'), radixSwitch: (c) => c.includes('"SwitchProvider"'),
  mobileNav: (c) => c.includes('"MobileNav"') && c.includes("Viber"), headerSearch: (c) => c.includes('"HeaderSearch"') && c.includes("keydown"),
  searchBox: (c) => c.includes('"SearchBox"') && c.includes("sk.recentSearches"), combobox: (c) => /"Combobox"/.test(c) && c.includes("nearest"),
  catalogControls: (c) => c.includes('"CatalogControls"'),
};
const dialogStack = ["radixDialog", "focusScope", "focusGuards", "removeScroll", "hideOthers", "uiSheet", "uiDialog", "overlayMotionHook"];
const SETS = {
  "A claimed: overlays+toast+consent+header sheets+search": [...dialogStack, "dismissableLayer", "presence", "toast", "collection", "consentBanner", "radixSwitch", "mobileNav", "headerSearch", "searchBox", "combobox"],
  "B same without SearchBox/Combobox (needed inline on / and /pretraga)": [...dialogStack, "dismissableLayer", "presence", "toast", "collection", "consentBanner", "radixSwitch", "mobileNav", "headerSearch"],
  "C dialog/sheet stack only (keeps Toast)": dialogStack,
  "D toast only (keeps overlays)": ["toast", "collection"],
  "E consent banner + Switch": ["consentBanner", "radixSwitch"],
};
const lines = [];
for (const route of ROUTES) {
  const html = await (await fetch(BASE + route)).text();
  const chunks = [...new Set([...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]).filter((a) => /\/_next\/static\/chunks\//.test(a) && !/nomodule/i.test(a)).map((a) => /chunks\/([^"?]+)/.exec(a)[1]))];
  chunks.forEach(load);
  const keys = chunks.flatMap((c) => chunkMods.get(c));
  const total = chunks.reduce((n, c) => n + gz(readFileSync(`.next/static/chunks/${c}`)), 0);
  lines.push(`== ${route}  module JS ${kb(total)} KB gz; CatalogControls in first load: ${keys.some((k) => T.catalogControls(mods.get(k)))}; Sheet importers present: ${keys.filter((k) => T.uiSheet(mods.get(k))).length}`);
  for (const [name, groups] of Object.entries(SETS)) {
    const hit = new Set(keys.filter((k) => groups.some((g) => T[g](mods.get(k)))));
    let delta = 0, raw = 0;
    for (const c of chunks) {
      const ids = chunkMods.get(c);
      if (!ids.some((k) => hit.has(k))) continue;
      delta += gz(ids.map((k) => mods.get(k)).join("\n")) - gz(ids.filter((k) => !hit.has(k)).map((k) => mods.get(k)).join("\n"));
    }
    for (const k of hit) raw += mods.get(k).length;
    lines.push(`  ${name.padEnd(72)} modules ${String(hit.size).padStart(2)}  raw ${kb(raw).padStart(5)} KB  in-chunk gz ${kb(delta).padStart(5)} KB`);
  }
}
writeFileSync("docs/qa/audit/verify/perf-bundle/perf-bundle-04-reproduce-sets.txt", lines.join("\n") + "\n");
console.log(lines.join("\n"));
