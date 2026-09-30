// perf-bundle track: identifies which libraries sit in which .next/static chunk (string
// signatures in the minified output) and which of them are in the first-load set of each template.
//
//   node scripts/qa/audit/perf-bundle-signatures.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const DIR = path.resolve(".next/static/chunks");
const OUT = path.resolve("docs/qa/audit/perf-bundle");

const SIGS = {
  "react-dom": [/__reactContainer\$|__reactFiber\$/],
  "next app router": [/next-router-state-tree/],
  "core-js polyfills (nomodule)": [/trimStart"in String\.prototype/],
  "convex client": [/ConvexReactClient/],
  "@convex-dev/auth": [/__convexAuthJWT|convexAuthNextjs|ConvexAuthActionsContext|__convexAuthRefreshToken/],
  "gsap core": [/GSAP target|_gsap|gsap\.registerPlugin|\.registerPlugin\(/],
  ScrollTrigger: [/ScrollTrigger/],
  ScrollToPlugin: [/name:"scrollTo"|scrollTo:\{/],
  CustomEase: [/CustomEase/],
  Draggable: [/Draggable/],
  InertiaPlugin: [/InertiaPlugin|name:"inertia"/],
  "@gsap/react useGSAP": [/useGSAP/],
  "radix Dialog": [/DialogContent|DialogPortal|"Dialog"/],
  "radix DismissableLayer/FocusScope": [/DismissableLayer|FocusScope|focusScope\.autoFocusOnMount/],
  "radix Popover": [/PopoverContent|"Popover"/],
  "radix Tooltip": [/TooltipContent|"Tooltip"|TooltipProvider/],
  "radix DropdownMenu/Menu": [/DropdownMenu|MenuContent|"Menu"/],
  "radix Tabs": [/TabsContent|"Tabs"/],
  "radix Toast": [/ToastViewport|"Toast"/],
  "radix Switch/Checkbox/Radio": [/"Switch"|"Checkbox"|"RadioGroup"/],
  "radix ScrollArea": [/ScrollArea/],
  "react-remove-scroll": [/RemoveScroll|react-remove-scroll|data-scroll-locked/],
  "floating-ui": [/computePosition|floating-ui|autoUpdate/],
  zod: [/ZodError|\$ZodType|_zod/],
  "react-hook-form": [/shouldUnregister|useFormContext|RHF/],
  zustand: [/zustand|getInitialState/],
  three: [/WebGLRenderer|WebGL2RenderingContext|THREE\.|"three"/],
  "@react-three/fiber": [/R3F|__r3f|useFrame/],
  "three-mesh-bvh": [/MeshBVH|acceleratedRaycast/],
  meshopt: [/MeshoptDecoder|meshopt/],
  "@tanstack/react-table": [/getCoreRowModel/],
  cmdk: [/cmdk/],
  "xlsx (SheetJS)": [/SheetJS|XLSX\.|sheet_to_json/],
  "@phosphor-icons": [/IconBase|duotone/],
  "analytics adapters (gtag/fbq)": [/gtag|fbq|googletagmanager|fbevents/],
  "text reveal": [/reveal-word|data-reveal-state/],
  "consent banner": [/consent-banner|sk_consent/],
  "vehicle picker": [/vehicle-picker/],
  "cart drawer": [/cart-drawer|CartDrawer/],
  "mobile nav": [/mobile-nav|MobileNav/],
};

const files = readdirSync(DIR).filter((f) => f.endsWith(".js"));
const table = {};
for (const f of files) {
  const b = readFileSync(path.join(DIR, f));
  const s = b.toString("utf8");
  const hits = Object.entries(SIGS)
    .filter(([, res]) => res.some((re) => re.test(s)))
    .map(([k]) => k);
  table[f] = { raw: b.length, gz: gzipSync(b).length, hits };
}
writeFileSync(path.join(OUT, "chunk-signatures.json"), JSON.stringify(table, null, 2));

const tpl = JSON.parse(readFileSync(path.join(OUT, "templates.json"), "utf8"));
const kb = (n) => (n / 1024).toFixed(1);
for (const name of ["home", "product", "upit", "porudzbina", "prijava"]) {
  console.log(`\n== ${name} first-load scripts (module only)`);
  let tot = 0;
  for (const j of tpl[name].js) {
    if (/noModule/.test(j.attrs)) continue;
    const f = path.basename(j.src);
    const t = table[f];
    tot += t?.gz ?? 0;
    console.log(`  ${kb(t?.gz ?? 0).padStart(6)} gz  ${f.padEnd(24)} ${t?.hits.join(", ")}`);
  }
  console.log(`  total module JS: ${kb(tot)} KB gz`);
}

// Which chunks (anywhere) contain each library, to spot lazy vs eager and duplicates.
console.log("\n== library -> chunks (gz KB)");
for (const k of Object.keys(SIGS)) {
  const where = Object.entries(table)
    .filter(([, v]) => v.hits.includes(k))
    .map(([f, v]) => `${f}(${kb(v.gz)})`);
  console.log(`${k.padEnd(36)} ${where.length}: ${where.slice(0, 14).join(" ")}${where.length > 14 ? " …" : ""}`);
}
