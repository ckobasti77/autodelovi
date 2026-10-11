import { readFileSync } from "node:fs";
import path from "node:path";

const ev = JSON.parse(readFileSync(path.resolve("docs/qa/screens/step-26/critique-b-evidence.json"), "utf8"));
const pad = (s, n) => String(s).padEnd(n);

console.log("=== A per page");
for (const vp of ["1440", "390"]) {
  let tb = 0;
  let ts = 0;
  const agg = { border: 0, background: 0, tagOnly: 0 };
  const tag = { total: 0, inRoundedWrapper: 0, ownPaint: 0, bare: 0 };
  for (const [p, d] of Object.entries(ev.pages[vp])) {
    const s = d.sharp;
    tb += s.boxes.total;
    ts += s.count;
    for (const k of Object.keys(agg)) agg[k] += s.reasons[k];
    for (const k of Object.keys(tag)) tag[k] += s.tagOnly[k];
    console.log(
      `${vp} ${pad(p, 46)} boxes=${pad(s.boxes.total, 4)} square=${pad(s.count, 3)} border=${s.reasons.border} bg=${s.reasons.background} tag=${s.reasons.tagOnly} [wrap=${s.tagOnly.inRoundedWrapper} paint=${s.tagOnly.ownPaint} bare=${s.tagOnly.bare}] excl=${JSON.stringify(s.excluded)} contact=${JSON.stringify(d.contactLinks)}`,
    );
  }
  console.log(`${vp} TOTAL boxes=${tb} square=${ts} ${JSON.stringify(agg)} tagOnly=${JSON.stringify(tag)}`);
}

console.log("\n=== A offenders that are not in a rounded wrapper (bare or own paint) or drawn by border/bg");
for (const vp of ["1440", "390"]) {
  const m = new Map();
  for (const [p, d] of Object.entries(ev.pages[vp])) {
    for (const o of d.sharp.top) {
      const drawn = (o.why.border || 0) + (o.why["border+bg"] || 0) + (o.why.bg || 0);
      const tagN = o.why.tag || 0;
      const notWrapped = tagN - (o.inRoundedWrapper || 0);
      let e = m.get(o.sig);
      if (!e) m.set(o.sig, (e = { sig: o.sig, n: 0, drawn: 0, tag: 0, wrapped: 0, notWrapped: 0, sides: 0, pages: [], sample: o.sample }));
      e.n += o.n;
      e.drawn += drawn;
      e.tag += tagN;
      e.wrapped += o.inRoundedWrapper || 0;
      e.notWrapped += notWrapped;
      e.sides = Math.max(e.sides, o.ownBorderSides || 0);
      e.pages.push(p);
    }
  }
  console.log(`--- @${vp}`);
  for (const e of [...m.values()].sort((a, b) => b.n - a.n)) {
    console.log(
      `  ${pad(e.n, 4)} ${pad(e.sig, 58)} drawn=${e.drawn} tag=${e.tag} wrapped=${e.wrapped} notWrapped=${e.notWrapped} ownSides=${e.sides} ${e.sample.w}x${e.sample.h} wr=${e.sample.wrapperRadius ?? "-"} "${e.sample.text}" pages=${e.pages.length}`,
    );
  }
}

console.log("\n=== radius histograms");
for (const vp of ["1440", "390"]) {
  const h = ev.radiusHistogram[vp];
  console.log(vp, "all:", JSON.stringify(h.allVisibleElements));
  console.log(vp, "boxes:", JSON.stringify(h.visibleBoxes));
  for (const [r, list] of Object.entries(h.visibleBoxesTopSignatures)) {
    console.log(`  ${r}: ` + list.slice(0, 8).map((x) => `${x.sig}×${x.n}`).join(" | "));
  }
}

console.log("\n=== B aggregated signatures @390");
{
  const m = new Map();
  for (const [p, d] of Object.entries(ev.pages["390"])) {
    for (const o of d.touch.top) {
      let e = m.get(o.sig);
      if (!e) m.set(o.sig, (e = { sig: o.sig, n: 0, eff: 0, pages: [], minW: 1e9, minH: 1e9, sample: o.sample }));
      e.n += o.n;
      e.eff += o.nEffective;
      e.pages.push(p);
      e.minW = Math.min(e.minW, o.minW);
      e.minH = Math.min(e.minH, o.minH);
    }
  }
  for (const e of [...m.values()].sort((a, b) => b.n - a.n)) {
    console.log(
      `  ${pad(e.n, 4)} eff=${pad(e.eff, 3)} pages=${pad(e.pages.length, 2)} ${pad(e.sig, 52)} ${e.sample.w}x${e.sample.h} (eff ${e.sample.effW}x${e.sample.effH}; min ${e.minW}x${e.minH}; wrap ${e.sample.borderedWrapper ?? "-"}) "${e.sample.text}"${e.sample.testid ? ` [${e.sample.testid}]` : ""} ${e.pages.length <= 3 ? e.pages.join(",") : ""}`,
    );
  }
  for (const [p, d] of Object.entries(ev.pages["390"])) {
    const t = d.touch;
    console.log(`  ${pad(p, 46)} interactive=${pad(t.interactiveVisible, 4)} <44=${pad(t.count, 3)} eff<44=${pad(t.countEffective, 3)} <24=${pad(t.below24, 3)} eff<24=${t.below24Effective} exclInline=${t.excludedInlineLinks} exclHidden=${t.excludedVisuallyHidden}`);
  }
}

console.log("\n=== D aggregated @390");
{
  const m = new Map();
  const c = new Map();
  const hist = {};
  const histNoSg = {};
  for (const [p, d] of Object.entries(ev.pages["390"])) {
    const t = d.type;
    for (const [k, n] of Object.entries(t.fontSizeHist)) {
      hist[k] = (hist[k] || 0) + n;
      if (p !== "/styleguide") histNoSg[k] = (histNoSg[k] || 0) + n;
    }
    for (const [map, list] of [
      [m, t.below12Top],
      [c, t.controlsBelow14Top],
    ]) {
      for (const o of list) {
        let e = map.get(o.sig);
        if (!e) map.set(o.sig, (e = { sig: o.sig, n: 0, fs: o.fontSize, pages: [], sample: o.sample }));
        e.n += o.n;
        e.pages.push(p);
      }
    }
    console.log(`  ${pad(p, 46)} text=${pad(t.textElements, 4)} <12=${pad(t.below12, 4)} ctl<14=${pad(t.controlsBelow14, 3)} fields=${t.fields} fields<16=${t.fieldsBelow16} ${JSON.stringify(t.fieldsBelow16Top)}`);
  }
  const sortNum = (h) => Object.entries(h).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).map(([k, n]) => `${k}:${n}`).join("  ");
  console.log("  font-size hist (all 11 pages):", sortNum(hist));
  console.log("  font-size hist (without /styleguide):", sortNum(histNoSg));
  console.log("  <12:");
  for (const e of [...m.values()].sort((a, b) => b.n - a.n)) console.log(`    ${pad(e.n, 4)} ${e.fs}px pages=${pad(e.pages.length, 2)} ${pad(e.sig, 56)} "${e.sample.text}" ${e.pages.length <= 2 ? e.pages.join(",") : ""}`);
  console.log("  controls <14:");
  for (const e of [...c.values()].sort((a, b) => b.n - a.n)) console.log(`    ${pad(e.n, 4)} ${e.fs}px pages=${pad(e.pages.length, 2)} ${pad(e.sig, 56)} "${e.sample.text}" ${e.pages.length <= 2 ? e.pages.join(",") : ""}`);
}

console.log("\n=== E fixed / sticky-bottom after down 1200 / up 300");
for (const vp of ["1440", "390"]) {
  console.log(vp, "/", JSON.stringify(ev.header[vp].fixedAfterUp300));
  for (const [p, d] of Object.entries(ev.pages[vp])) if (d.fixedCheck) console.log(vp, pad(p, 46), "scrollY", d.fixedCheck.scrollY, JSON.stringify(d.fixedCheck.all));
}
console.log("\nmeta", ev.meta.startedAt, ev.meta.finishedAt);
