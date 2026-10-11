import { readFileSync } from "node:fs";
import path from "node:path";

const ev = JSON.parse(readFileSync(path.resolve("docs/qa/screens/step-26/critique-b-evidence.json"), "utf8"));
const mode = process.argv[2] ?? "all";
const pad = (s, n) => String(s).padEnd(n);

if (mode === "all" || mode === "A") {
  for (const vp of Object.keys(ev.pages)) {
    console.log(`\n=== A sharp corners @${vp}`);
    for (const [p, d] of Object.entries(ev.pages[vp])) {
      if (d.error) {
        console.log(p, "ERROR", d.error);
        continue;
      }
      const s = d.sharp;
      console.log(
        `${pad(p, 48)} square=${s.count} boxes=${s.boxes.total} rounded=${s.boxes.rounded} reasons=${JSON.stringify(s.reasons)} excl=${JSON.stringify(s.excluded)} sigs=${s.distinctSignatures} scrollH=${d.scrollHeight} dom=${d.domElements} pending=${d.revealPending}`,
      );
      for (const o of s.top.slice(0, Number(process.argv[3] ?? 25))) {
        console.log(`    ${pad(o.n, 4)} ${pad(o.sig, 62)} ${o.sample.w}x${o.sample.h} ${JSON.stringify(o.why)} "${o.sample.text}"${o.sample.testid ? ` [${o.sample.testid}]` : ""}`);
      }
    }
    console.log(`--- radius histogram @${vp} (all visible elements)`);
    console.log(JSON.stringify(ev.radiusHistogram[vp].allVisibleElements));
    console.log(`--- radius histogram @${vp} (visible boxes)`);
    console.log(JSON.stringify(ev.radiusHistogram[vp].visibleBoxes));
  }
}

if (mode === "all" || mode === "B") {
  console.log(`\n=== B touch targets @390`);
  for (const [p, d] of Object.entries(ev.pages["390"])) {
    if (d.error) continue;
    const t = d.touch;
    console.log(
      `${pad(p, 48)} interactive=${t.interactiveVisible} <44=${t.count} eff<44=${t.countEffective} <24=${t.below24} eff<24=${t.below24Effective} inlineDisplay=${t.inlineDisplay} exclInline=${t.excludedInlineLinks} exclHidden=${t.excludedVisuallyHidden}`,
    );
    for (const o of t.top) {
      console.log(`    ${pad(o.n, 4)}(eff ${o.nEffective}) ${pad(o.sig, 60)} ${o.sample.w}x${o.sample.h} eff ${o.sample.effW}x${o.sample.effH} min ${o.minW}x${o.minH} ${o.sample.display} "${o.sample.text}"${o.sample.testid ? ` [${o.sample.testid}]` : ""}`);
    }
  }
}

if (mode === "all" || mode === "C") {
  console.log(`\n=== C overflow`);
  for (const vp of Object.keys(ev.pages))
    for (const [p, d] of Object.entries(ev.pages[vp]))
      console.log(vp, pad(p, 48), d.overflowX, JSON.stringify(d.viewport), "errors", d.consoleErrorCount, d.consoleErrors?.[0] ?? "");
}

if (mode === "all" || mode === "D") {
  console.log(`\n=== D type sizes @390`);
  for (const [p, d] of Object.entries(ev.pages["390"])) {
    if (d.error) continue;
    const t = d.type;
    console.log(`${pad(p, 48)} text=${t.textElements} <12=${t.below12} ctl<14=${t.controlsBelow14} fields=${t.fields} fields<16=${t.fieldsBelow16}`);
    console.log(`    hist ${JSON.stringify(t.fontSizeHist)}`);
    for (const o of t.below12Top) console.log(`    <12  ${pad(o.n, 4)} ${o.fontSize}px ${pad(o.sig, 60)} "${o.sample.text}"`);
    for (const o of t.controlsBelow14Top) console.log(`    ctl  ${pad(o.n, 4)} ${o.fontSize}px ${pad(o.sig, 60)} "${o.sample.text}"`);
  }
}

if (mode === "all" || mode === "E") {
  console.log(`\n=== E header`);
  for (const vp of Object.keys(ev.header)) {
    const h = ev.header[vp];
    console.log(`--- @${vp}`);
    for (const k of ["atTop", "afterDown1200", "afterUp300"]) {
      const m = h[k];
      if (!m) continue;
      const { interactive, ...rest } = m;
      console.log(k, JSON.stringify(rest));
      if (k === "atTop") for (const i of interactive) console.log(`    ${pad(i.sig, 60)} ${i.w}x${i.h} @${i.x},${i.y} d${i.depth} "${i.label}"`);
    }
    console.log("fixed:", JSON.stringify(h.fixedAfterUp300, null, 0));
  }
  console.log(`\n--- fixedCheck other pages`);
  for (const vp of Object.keys(ev.pages))
    for (const [p, d] of Object.entries(ev.pages[vp])) if (d.fixedCheck) console.log(vp, pad(p, 48), JSON.stringify(d.fixedCheck));
}
