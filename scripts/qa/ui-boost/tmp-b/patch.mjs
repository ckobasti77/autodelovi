import { readFileSync, writeFileSync } from "node:fs";
const f = "scripts/qa/ui-boost/tmp-b/measure.mjs";
let s = readFileSync(f, "utf8");
const rep = (a, b) => {
  if (!s.includes(a)) throw new Error("missing: " + a.slice(0, 70));
  s = s.replace(a, () => b);
};

// 1. walk signature + chain + fixed off-screen pruning
rep(
  `  const excluded = { tiny: 0, fullBleed: 0, fixedEdge: 0 };`,
  `  const excluded = { tiny: 0, fullBleed: 0, fixedEdge: 0, fixedOffscreenSubtrees: 0 };
  const radiusBySig = {};
  const tagOnly = { total: 0, inRoundedWrapper: 0, ownPaint: 0, bare: 0 };`,
);
rep(`  const walk = (el, effBg) => {`, `  const walk = (el, effBg, chain) => {`);
rep(
  `    const fixed = cs.position === "fixed";`,
  `    const fixed = cs.position === "fixed";
    if (fixed && (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw)) {
      excluded.fixedOffscreenSubtrees++;
      return; // a fixed box outside the viewport can never be scrolled into view
    }`,
);
rep(
  `    if (visible) {
      vis.set(el, { r, cs });`,
  `    let link = { rounded: false, box: false, clip: false, radius: "0px" };
    if (visible) {
      const info = { r, cs, bordered: false, box: false };
      vis.set(el, info);`,
);
rep(
  `      const a = sides >= 3;
      const b = bg[3] > 0.5 && !same(bg, effBg);
      const c = TAG_BOX.has(tag);`,
  `      const a = sides >= 3;
      const b = bg[3] > 0.5 && !same(bg, effBg);
      const c = TAG_BOX.has(tag);
      info.bordered = a;
      info.box = a || b;
      link = { rounded: !square, box: a || b, clip: cs.overflowX !== "visible", radius: cs.borderRadius };`,
);
rep(
  `            histBox[cs.borderRadius] = (histBox[cs.borderRadius] || 0) + 1;`,
  `            histBox[cs.borderRadius] = (histBox[cs.borderRadius] || 0) + 1;
            const bucket = (radiusBySig[cs.borderRadius] ||= {});
            const k = sig(el);
            bucket[k] = (bucket[k] || 0) + 1;`,
);
rep(
  `            if (a) reasons.border++;
            else if (b) reasons.background++;
            else reasons.tagOnly++;`,
  `            if (a) reasons.border++;
            else if (b) reasons.background++;
            else reasons.tagOnly++;
            const wrap = chain.find((x) => x.rounded && (x.box || x.clip));
            const paints = sides > 0;
            if (!a && !b) {
              tagOnly.total++;
              if (wrap) tagOnly.inRoundedWrapper++;
              if (paints) tagOnly.ownPaint++;
              if (!wrap && !paints) tagOnly.bare++;
            }`,
);
rep(
  `              offenders.set(key, o);
            }
            o.n++;`,
  `              offenders.set(key, o);
            }
            o.n++;
            if (!a && !b) {
              if (wrap) {
                o.inRoundedWrapper = (o.inRoundedWrapper || 0) + 1;
                o.sample.wrapperRadius ??= wrap.radius;
              }
              if (paints) o.ownBorderSides = Math.max(o.ownBorderSides || 0, sides);
            }`,
);
rep(
  `    for (const ch of el.children) walk(ch, ownEff);
  };
  for (const ch of document.body.children) walk(ch, baseBg);`,
  `    const next = [link, ...chain].slice(0, 4);
    for (const ch of el.children) walk(ch, ownEff, next);
  };
  for (const ch of document.body.children) walk(ch, baseBg, []);`,
);
rep(
  `    reasons,
    excluded,`,
  `    reasons,
    tagOnly,
    excluded,`,
);
rep(
  `    radiusHistBoxes: histBox,
  };`,
  `    radiusHistBoxes: histBox,
    radiusBySig,
    contactLinks: {
      tel: document.querySelectorAll('a[href^="tel:"]').length,
      viber: document.querySelectorAll('a[href^="viber:"]').length,
      mailto: document.querySelectorAll('a[href^="mailto:"]').length,
    },
  };`,
);

// touch: wrapper box
rep(
  `          display: v.cs.display,
          testid: el.getAttribute("data-testid") || undefined,
        },
      };
      tt.set(key, o);`,
  `          display: v.cs.display,
          testid: el.getAttribute("data-testid") || undefined,
          borderedWrapper: (() => {
            const p = [el.parentElement, el.parentElement && el.parentElement.parentElement].find(
              (x) => x && vis.get(x) && vis.get(x).bordered,
            );
            if (!p) return undefined;
            const pr = vis.get(p).r;
            return +pr.width.toFixed(1) + "x" + +pr.height.toFixed(1);
          })(),
        },
      };
      tt.set(key, o);`,
);

// fields below 16
rep(
  `  const ctl = new Map();`,
  `  const ctl = new Map();
  const f16 = new Map();`,
);
rep(
  `      if (fs < 16) type.fieldsBelow16++;`,
  `      if (fs < 16) {
        type.fieldsBelow16++;
        bump(f16, el, fs, v.r);
      }`,
);
rep(
  `  type.fontSizeHist = fsHist;`,
  `  type.fieldsBelow16Top = [...f16.values()].sort((x, y) => y.n - x.n).slice(0, 10);
  type.fontSizeHist = fsHist;`,
);

// fixed + sticky-at-bottom
rep(
  `    if (cs.position !== "fixed") continue;
    const r = el.getBoundingClientRect();
    const shown =`,
  `    if (cs.position !== "fixed" && cs.position !== "sticky") continue;
    const r = el.getBoundingClientRect();
    if (cs.position === "sticky" && !(cs.bottom !== "auto" && r.bottom >= vh - 2 && r.top >= vh / 2)) continue;
    const shown =`,
);
rep(
  `      sig: sig(el),
      testid: el.getAttribute("data-testid") || undefined,
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),`,
  `      sig: sig(el),
      position: cs.position,
      visibility: cs.visibility,
      testid: el.getAttribute("data-testid") || undefined,
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),`,
);
rep(
  `          atBottom: f.fixedAfterUp300.fixed.filter((x) => x.atBottom),`,
  `          atBottom: f.fixedAfterUp300.fixed.filter((x) => x.atBottom),
          all: f.fixedAfterUp300.fixed,`,
);
rep(
  `        const el = document.querySelector('[data-testid="sticky-contact-bar"]');
        return el && el.getBoundingClientRect().top < window.innerHeight - 4;`,
  `        const el = document.querySelector('[data-testid="sticky-contact-bar"], [data-testid="sticky-buy-bar"]');
        return el && getComputedStyle(el).visibility !== "hidden" && el.getBoundingClientRect().top < window.innerHeight - 4;`,
);
rep(`      { timeout: 6000 },`, `      { timeout: 5000 },`);

// driver: aggregate radius by signature
rep(
  `  const histAll = {};
  const histBox = {};
  for (const p of PAGES) {`,
  `  const histAll = {};
  const histBox = {};
  const bySig = {};
  for (const p of PAGES) {`,
);
rep(
  `      for (const [k, n] of Object.entries(data.radiusHistBoxes)) histBox[k] = (histBox[k] || 0) + n;`,
  `      for (const [k, n] of Object.entries(data.radiusHistBoxes)) histBox[k] = (histBox[k] || 0) + n;
      for (const [radius, sigs] of Object.entries(data.radiusBySig)) {
        const bucket = (bySig[radius] ||= {});
        for (const [k, n] of Object.entries(sigs)) bucket[k] = (bucket[k] || 0) + n;
      }
      delete data.radiusBySig;`,
);
rep(
  `  evidence.radiusHistogram[vp.tag] = { allVisibleElements: sort(histAll), visibleBoxes: sort(histBox) };`,
  `  evidence.radiusHistogram[vp.tag] = {
    allVisibleElements: sort(histAll),
    visibleBoxes: sort(histBox),
    visibleBoxesTopSignatures: Object.fromEntries(
      Object.entries(bySig).map(([radius, sigs]) => [
        radius,
        Object.entries(sigs)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([k, n]) => ({ sig: k, n })),
      ]),
    ),
  };`,
);
// method notes
rep(
  `      sharpWhy: "why:`,
  `      tagOnly:
        "tagOnly = square elements counted only by criterion (c). inRoundedWrapper = an ancestor within 4 levels has a non-zero radius and either draws a box (a/b) or clips (overflow ≠ visible); ownPaint = the element paints 1–2 border sides itself; bare = neither.",
      fixedOffscreen: "a position:fixed element lying completely outside the viewport (skip link before focus, parked bars) is treated as invisible together with its subtree",
      sharpWhy: "why:`,
);
writeFileSync(f, s);
console.log("patched");
