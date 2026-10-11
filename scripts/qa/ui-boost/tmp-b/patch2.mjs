import { readFileSync, writeFileSync } from "node:fs";
const f = "scripts/qa/ui-boost/tmp-b/measure.mjs";
let s = readFileSync(f, "utf8");
const rep = (a, b) => {
  if (!s.includes(a)) throw new Error("missing: " + a.slice(0, 70));
  s = s.replace(a, () => b);
};

// imports + tree stamp
rep(
  `import { mkdirSync, writeFileSync } from "node:fs";`,
  `import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";`,
);
rep(
  `const NAV_TIMEOUT = 120_000;`,
  `const NAV_TIMEOUT = 120_000;

/** Newest source file: the working tree is being edited by another process while this runs. */
function treeStamp() {
  let max = 0;
  let file = "";
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name.startsWith(".")) continue;
        walk(p);
      } else {
        const m = statSync(p).mtimeMs;
        if (m > max) {
          max = m;
          file = p;
        }
      }
    }
  };
  for (const d of ["app", "components", "constants", "lib", "config"]) walk(d);
  return { ms: Math.round(max), at: new Date(max).toISOString(), file: file.replace(/\\\\/g, "/") };
}`,
);

// sample: input type + clipped flag for drawn offenders
rep(
  `                  testid: el.getAttribute("data-testid") || undefined,
                },
              };
              offenders.set(key, o);`,
  `                  testid: el.getAttribute("data-testid") || undefined,
                  type: tag === "input" ? el.type : undefined,
                  src: tag === "img" ? (el.currentSrc || el.src || "").replace(location.origin, "").slice(0, 90) : undefined,
                  objectFit: tag === "img" ? cs.objectFit : undefined,
                },
              };
              offenders.set(key, o);`,
);
rep(
  `            if (!a && !b) {
              if (wrap) {
                o.inRoundedWrapper = (o.inRoundedWrapper || 0) + 1;`,
  `            if ((a || b) && chain.some((x) => x.rounded && x.clip)) {
              o.clippedByRoundedAncestor = (o.clippedByRoundedAncestor || 0) + 1;
              drawn.clippedByRoundedAncestor++;
            }
            if (a || b) drawn.total++;
            if (!a && !b) {
              if (wrap) {
                o.inRoundedWrapper = (o.inRoundedWrapper || 0) + 1;`,
);
rep(
  `  const tagOnly = { total: 0, inRoundedWrapper: 0, ownPaint: 0, bare: 0 };`,
  `  const tagOnly = { total: 0, inRoundedWrapper: 0, ownPaint: 0, bare: 0 };
  const drawn = { total: 0, clippedByRoundedAncestor: 0 };`,
);
rep(
  `    reasons,
    tagOnly,`,
  `    reasons,
    drawn,
    tagOnly,`,
);

// driver: per-page stamp + retry, fixed at page bottom, buy bar probe
rep(
  `  for (const p of PAGES) {
    errors.length = 0;
    try {
      const nav = await go(p);`,
  `  for (const p of PAGES) {
   for (let attempt = 1; attempt <= 3; attempt++) {
    errors.length = 0;
    const stampBefore = treeStamp();
    try {
      const nav = await go(p);`,
);
rep(
  `      const data = await page.evaluate(measureAll, { mobile: vp.mobile });
      for (const [k, n] of Object.entries(data.radiusHistAll)) histAll[k] = (histAll[k] || 0) + n;`,
  `      const data = await page.evaluate(measureAll, { mobile: vp.mobile });
      const fixedAtPageBottom = (await page.evaluate(fixedElements)).fixed.filter((x) => x.shownInViewport);
      const stampAfter = treeStamp();
      if (stampAfter.ms !== stampBefore.ms && attempt < 3) {
        console.log(\`[\${vp.tag}] \${p}: source changed during the measurement (\${stampAfter.file}) — retry \${attempt}\`);
        await page.waitForTimeout(5000);
        continue;
      }
      for (const [k, n] of Object.entries(data.radiusHistAll)) histAll[k] = (histAll[k] || 0) + n;`,
);
rep(
  `      let fixedCheck = null;
      if (p !== "/") {`,
  `      let buyBar = null;
      if (p.startsWith("/deo/")) {
        buyBar = await page.evaluate(async () => {
          const box = document.getElementById("buy-box");
          const bar = document.querySelector('[data-testid="sticky-buy-bar"]');
          if (!box || !bar) return { buyBox: !!box, bar: !!bar };
          const top = box.getBoundingClientRect().bottom + window.scrollY;
          window.scrollTo(0, top + 200);
          await new Promise((r) => setTimeout(r, 1500));
          const cs = getComputedStyle(bar);
          const r = bar.getBoundingClientRect();
          const btn = bar.querySelector("button");
          const br = btn ? btn.getBoundingClientRect() : null;
          return {
            scrollY: Math.round(window.scrollY),
            buyBoxBottomAtDocY: Math.round(top),
            display: cs.display,
            visibility: cs.visibility,
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            w: Math.round(r.width),
            h: Math.round(r.height),
            shown: cs.display !== "none" && cs.visibility !== "hidden" && r.top < window.innerHeight && r.height > 0,
            background: cs.backgroundColor,
            borderTop: cs.borderTopWidth + " " + cs.borderTopColor,
            button: br ? { w: Math.round(br.width), h: Math.round(br.height), radius: getComputedStyle(btn).borderRadius, text: btn.textContent.trim().slice(0, 40) } : null,
            text: bar.textContent.trim().replace(/\\s+/g, " ").slice(0, 80),
          };
        });
      }
      let fixedCheck = null;
      if (p !== "/") {`,
);
rep(
  `        ...data,
        fixedCheck,
      };`,
  `        ...data,
        fixedAtPageBottom,
        buyBar,
        fixedCheck,
        tree: { before: stampBefore.at, after: stampAfter.at, newestFile: stampAfter.file, attempts: attempt, changedDuringMeasure: stampAfter.ms !== stampBefore.ms },
      };`,
);
rep(
  `    } catch (error) {
      evidence.pages[vp.tag][p] = { error: String(error).slice(0, 400) };
      console.log(\`[\${vp.tag}] \${p}: FAILED \${String(error).slice(0, 300)}\`);
    }
  }`,
  `      break;
    } catch (error) {
      evidence.pages[vp.tag][p] = { error: String(error).slice(0, 400) };
      console.log(\`[\${vp.tag}] \${p}: FAILED \${String(error).slice(0, 300)}\`);
      if (attempt === 3) break;
    }
   }
  }`,
);
// header: stamp
rep(
  `    evidence.header[vp.tag] = { nav, atTop, ...rest };`,
  `    evidence.header[vp.tag] = { nav, atTop, ...rest, treeNewest: treeStamp().at };`,
);
// meta
rep(
  `const startedAt = new Date().toISOString();`,
  `const startedAt = new Date().toISOString();
const treeAtStart = treeStamp();`,
);
rep(
  `evidence.meta.finishedAt = new Date().toISOString();`,
  `evidence.meta.finishedAt = new Date().toISOString();
evidence.meta.tree = { atStart: treeAtStart, atEnd: treeStamp() };`,
);
writeFileSync(f, s);
console.log("patched 2");
