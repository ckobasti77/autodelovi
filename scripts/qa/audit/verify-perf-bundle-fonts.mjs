// verify track (perf-bundle-08): which font files are preloaded (Link header), which faces the
// first viewport actually paints (CDP CSS.getPlatformFontsForNode — the real font used), the LCP
// element, and whether the non-preloaded Archivo Expanded 600 arrives after first contentful paint
// under a throttled mobile network (ordering only, 3 runs).
//   node scripts/qa/audit/verify-perf-bundle-fonts.mjs
import { writeFileSync } from "node:fs";
import { launch, newContext, BASE } from "./kit.mjs";

const pages = [
  ["home", "/"],
  ["category", "/delovi/kocioni-diskovi"],
  ["product", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004"],
  ["landing", "/ponuda/kocione-plocice-golf"],
  ["landing2", "/ponuda/kocione-plocice-golf"],
  ["korpa", "/korpa"],
  ["search", "/pretraga?q=disk"],
];
const out = [];
for (const [name, route] of pages) {
  const res = await fetch(BASE + route);
  const link = res.headers.get("link") ?? "";
  const files = [...link.matchAll(/<\/_next\/static\/media\/([^>]+)>/g)].map((m) => m[1]);
  out.push(`${name} ${route} Link preloads: ${files.join(", ")}`);
  if (name === "landing2") out.pop();
}
out.push("");

const browser = await launch();
for (const vp of [
  { w: 390, h: 844 },
  { w: 1440, h: 900 },
]) {
  for (const [name, route] of pages.filter(([n]) => n !== "landing2")) {
    const ctx = await newContext(browser, { width: vp.w, height: vp.h, tag: `verify-pb08-${vp.w}` });
    await ctx.addInitScript(() => {
      window.__lcp = [];
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          const el = e.element;
          window.__lcp.push(el ? `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} "${(el.textContent || el.currentSrc || "").trim().slice(0, 40)}"` : "(removed)");
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    await page.goto(BASE + route, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    // Tag first-viewport elements with own text.
    const n = await page.evaluate(() => {
      let i = 0;
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= innerHeight || r.width === 0 || r.right <= 0 || r.left >= innerWidth) continue;
        const own = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
        if (!own) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
        el.setAttribute("data-vpf", String(i++));
      }
      return i;
    });
    const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
    const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "[data-vpf]" });
    const faces = {};
    for (const id of nodeIds) {
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId: id }).catch(() => ({ fonts: [] }));
      const text = await cdp.send("DOM.getOuterHTML", { nodeId: id }).then((r) => r.outerHTML.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 28)).catch(() => "");
      for (const f of fonts) {
        if (!f.glyphCount) continue;
        const k = `${f.familyName}${f.isCustomFont ? " (webfont)" : " (system)"}`;
        (faces[k] ??= []).push(text);
      }
    }
    const lcp = await page.evaluate(() => window.__lcp.at(-1));
    out.push(`@${vp.w} ${name}: ${n} first-viewport text elements; LCP element ${lcp}`);
    for (const [k, v] of Object.entries(faces)) out.push(`    ${k.padEnd(40)} ${v.length}: ${[...new Set(v)].slice(0, 4).join(" | ")}`);
    await ctx.close();
  }
}

// Ordering test: throttled (RTT 150 ms, 1.6 Mbps down) — does Expanded 600 finish after FCP?
out.push("", "Throttled 390 (latency 150 ms, 1.6 Mbps): font responseEnd vs first-contentful-paint (ms since navigation start)");
for (const [name, route] of [["category", "/delovi/kocioni-diskovi"], ["landing", "/ponuda/kocione-plocice-golf"]]) {
  for (let run = 1; run <= 3; run++) {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: `verify-pb08-thr-${run}` });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await page.goto(BASE + route, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(2000);
    const r = await page.evaluate(() => {
      const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime;
      const fonts = performance.getEntriesByType("resource").filter((e) => e.name.includes("/media/") && e.name.endsWith(".woff2"))
        .map((e) => `${e.name.split("/").pop().replace(/-s\..*$/, "").replace(/\.woff2$/, "")} start ${Math.round(e.startTime)} end ${Math.round(e.responseEnd)}`);
      return { fcp: Math.round(fcp), fonts };
    });
    out.push(`  ${name} run ${run}: FCP ${r.fcp}`);
    for (const f of r.fonts) out.push(`      ${f}`);
    await ctx.close();
  }
}
await browser.close();
console.log(out.join("\n"));
writeFileSync("docs/qa/audit/verify/perf-bundle/perf-bundle-08-reproduce.txt", out.join("\n") + "\n");
