// verify track for perf-bundle-02/-04/-05: independent static attribution of first-load module JS.
// For each route: fetch the served HTML from BASE, take the module <script src> list (nomodule
// excluded), split every chunk into Turbopack module factories (vm sandbox, nothing executed),
// classify modules by content signatures and report raw / standalone gzip and the in-chunk gzip
// delta (gzip of the chunk's modules with vs without the group). Icons: in-chunk gzip delta of
// keeping only the "regular" entry of every Phosphor weight map.
//
//   node scripts/qa/audit/verify-perf-bundle-static.mjs > docs/qa/audit/verify/perf-bundle/perf-bundle-02-reproduce-static.txt
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import vm from "node:vm";
import { gzipSync } from "node:zlib";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const OUT = "docs/qa/audit/verify/perf-bundle";
mkdirSync(OUT, { recursive: true });
const ROUTES = [
  "/",
  "/delovi",
  "/delovi/kocioni-diskovi",
  "/deo/kocioni-disk-prednji-276-24-mm-demo-0004",
  "/pretraga?q=disk",
  "/vozila/volkswagen/golf/golf-7",
  "/ponuda/kocione-plocice-golf",
  "/za-majstore",
  "/upit",
  "/korpa",
  "/porudzbina",
  "/prijava",
];

const gz = (s) => gzipSync(Buffer.from(s), { level: 6 }).length;
const kb = (n) => (n / 1024).toFixed(1);

/** module id -> { id, chunk, code } ; chunk -> [ids in order] */
const modules = new Map();
const chunkMods = new Map();
function loadChunk(name) {
  if (chunkMods.has(name)) return;
  const src = readFileSync(`.next/static/chunks/${name}`, "utf8");
  const pushed = [];
  try {
    vm.runInNewContext(src, { TURBOPACK: { push: (a) => pushed.push(a) } }, { timeout: 2000 });
  } catch {
    chunkMods.set(name, null); // runtime / non-module chunk
    return;
  }
  const ids = [];
  for (const arr of pushed) {
    let id = null;
    for (const it of arr.slice(1)) {
      if (typeof it !== "function") {
        id = it;
        continue;
      }
      const key = `${name}#${id}`;
      modules.set(key, { id, chunk: name, code: it.toString() });
      ids.push(key);
    }
  }
  chunkMods.set(name, ids);
}

const GROUPS = {
  tooltip: (c) => c.includes('"TooltipProvider"'),
  popperFloatingUi: (c) => c.includes("createPopperScope"),
  gsapMerged: (c) => c.includes("ScrollTrigger") && c.includes("CustomEase") && c.length > 50000,
  // Dialog / Sheet stack (header sheets + search dialog)
  radixDialog: (c) => c.includes('"DialogTrigger"'),
  focusScope: (c) => c.includes("focusScope.autoFocusOnMount"),
  focusGuards: (c) => c.includes("data-radix-focus-guard"),
  removeScroll: (c) => c.includes("right-scroll-bar-position"),
  hideOthers: (c) => c.includes("in not contained inside"),
  uiSheet: (c) => c.includes("data-no-drag") && c.includes("Zatvori"),
  uiDialog: (c) => /"Dialog"/.test(c) && c.includes("items-center") && !c.includes('"DialogTrigger"'),
  overlayMotion: (c) => c.includes("useOverlayMotion"),
  // shared by Toast and Dialog
  dismissableLayer: (c) => c.includes("dismissableLayer.update"),
  presence: (c) => c.includes("useStateMachine") && c.includes('"Presence"'),
  // Toast
  radixToast: (c) => c.includes('"ToastProvider"'),
  toaster: (c) => c.includes('"Toaster"'),
  collection: (c) => c.includes('"CollectionProvider"'),
  // consent UI
  consentBanner: (c) => c.includes('"ConsentBanner"'),
  radixSwitch: (c) => c.includes('"SwitchProvider"'),
  // header sheets
  mobileNav: (c) => c.includes('"MobileNav"') && c.includes("Viber"),
  headerSearch: (c) => c.includes('"HeaderSearch"') && c.includes("keydown"),
  searchBox: (c) => c.includes('"SearchBox"') && c.includes("sk.recentSearches"),
  combobox: (c) => /"Combobox"/.test(c) && c.includes("nearest"),
  phosphor: (c) => c.includes('["bold",') && c.includes('["regular",') && c.includes('["thin",'),
};

/** Phosphor weight map reduced to its "regular" entry. */
function regularOnly(code) {
  let out = code;
  let from = 0;
  for (;;) {
    const start = out.indexOf("new Map([", from);
    if (start < 0) break;
    let i = start + "new Map(".length;
    let depth = 0;
    let q = null;
    for (; i < out.length; i++) {
      const ch = out[i];
      if (q) {
        if (ch === "\\") i++;
        else if (ch === q) q = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") q = ch;
      else if (ch === "[" || ch === "(" || ch === "{") depth++;
      else if (ch === "]" || ch === ")" || ch === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const map = out.slice(start, i + 1); // new Map([...])  (i at the closing ']' of the outer array)
    const r = map.indexOf('["regular",');
    const t = map.indexOf('["thin",');
    if (r < 0 || t < 0) {
      from = start + 9;
      continue;
    }
    const regularEntry = map.slice(r, t).replace(/,$/, "");
    const reduced = `new Map([${regularEntry}]`;
    out = out.slice(0, start) + reduced + out.slice(i + 1);
    from = start + reduced.length;
  }
  return out;
}

const lines = [];
const log = (s = "") => lines.push(s);
const summary = {};

for (const route of ROUTES) {
  const html = await (await fetch(BASE + route)).text();
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)]
    .map((m) => m[1])
    .filter((a) => /src="[^"]*\/_next\/static\/chunks\//.test(a) && !/\bnoModule\b|\bnomodule\b/i.test(a))
    .map((a) => /src="[^"]*\/_next\/static\/chunks\/([^"?]+)/.exec(a)[1]);
  const uniq = [...new Set(scripts)];
  let totalGz = 0;
  for (const s of uniq) {
    loadChunk(s);
    totalGz += gz(readFileSync(`.next/static/chunks/${s}`));
  }
  const keys = uniq.flatMap((s) => chunkMods.get(s) ?? []);
  log(`== ${route}  scripts ${uniq.length}  module JS ${kb(totalGz)} KB gz`);
  summary[route] = { scripts: uniq.length, jsGzKB: +kb(totalGz), groups: {} };

  for (const [g, test] of Object.entries(GROUPS)) {
    const hits = keys.filter((k) => test(modules.get(k).code));
    if (!hits.length) {
      log(`  ${g.padEnd(18)} -`);
      summary[route].groups[g] = null;
      continue;
    }
    const raw = hits.reduce((n, k) => n + modules.get(k).code.length, 0);
    const sgz = hits.reduce((n, k) => n + gz(modules.get(k).code), 0);
    // in-chunk delta
    let delta = 0;
    const chunks = new Set(hits.map((k) => modules.get(k).chunk));
    for (const c of chunks) {
      const ids = chunkMods.get(c);
      const all = ids.map((k) => modules.get(k).code).join("\n");
      const without = ids.filter((k) => !hits.includes(k)).map((k) => modules.get(k).code).join("\n");
      delta += gz(all) - gz(without);
    }
    log(
      `  ${g.padEnd(18)} n=${String(hits.length).padStart(2)} raw ${kb(raw).padStart(6)} KB  gz(standalone) ${kb(sgz).padStart(5)} KB  gz(in-chunk delta) ${kb(delta).padStart(5)} KB  ${[...chunks].join(",")}  ${hits.map((k) => "#" + modules.get(k).id).join(" ")}`,
    );
    summary[route].groups[g] = { n: hits.length, rawKB: +kb(raw), gzStandaloneKB: +kb(sgz), gzDeltaKB: +kb(delta), chunks: [...chunks] };
  }

  // Phosphor: savings of keeping only the regular weight, measured in chunk context.
  const iconKeys = keys.filter((k) => GROUPS.phosphor(modules.get(k).code));
  const names = iconKeys.map((k) => /e\.s\(\["([A-Za-z]+Icon)"/.exec(modules.get(k).code)?.[1] ?? `#${modules.get(k).id}`);
  let rawAll = 0;
  let rawReg = 0;
  let gzSave = 0;
  for (const k of iconKeys) {
    rawAll += modules.get(k).code.length;
    rawReg += regularOnly(modules.get(k).code).length;
  }
  const iconChunks = new Set(iconKeys.map((k) => modules.get(k).chunk));
  for (const c of iconChunks) {
    const ids = chunkMods.get(c);
    const all = ids.map((k) => modules.get(k).code).join("\n");
    const reduced = ids.map((k) => (iconKeys.includes(k) ? regularOnly(modules.get(k).code) : modules.get(k).code)).join("\n");
    gzSave += gz(all) - gz(reduced);
  }
  const dupNames = names.filter((n, i) => names.indexOf(n) !== i);
  log(
    `  phosphor icons: ${iconKeys.length} modules (${new Set(names).size} distinct) raw ${kb(rawAll)} KB -> regular-only raw ${kb(rawReg)} KB; in-chunk gzip saving ${kb(gzSave)} KB; duplicates: ${dupNames.join(",") || "none"}`,
  );
  log(`    ${names.join(" ")}`);
  summary[route].icons = { modules: iconKeys.length, distinct: new Set(names).size, rawKB: +kb(rawAll), regularRawKB: +kb(rawReg), gzSaveKB: +kb(gzSave), dup: dupNames };
  log();
}

writeFileSync(`${OUT}/perf-bundle-02-reproduce-static.json`, JSON.stringify(summary, null, 2));
writeFileSync(`${OUT}/perf-bundle-02-reproduce-static.txt`, lines.join("\n"));
console.log(lines.join("\n"));
