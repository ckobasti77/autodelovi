import { readFileSync, writeFileSync } from "node:fs";
const f = "scripts/qa/ui-boost/tmp-b/measure.mjs";
let s = readFileSync(f, "utf8");
const rep = (a, b) => {
  if (!s.includes(a)) throw new Error("missing: " + a.slice(0, 70));
  s = s.replace(a, () => b);
};
rep(
  `const OUT = path.resolve("docs/qa/screens/step-26/critique-b-evidence.json");`,
  `const OUT = path.resolve("scripts/qa/ui-boost/tmp-b/evidence-run.json");
const MAX_ATTEMPTS = 8;`,
);
rep(
  `    let note;
    try {
      const res = await page.goto(\`\${BASE}\${p}\`, { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
      note = \`status \${res ? res.status() : "?"}\`;
    } catch (error) {
      note = \`networkidle not reached: \${String(error).slice(0, 160)}\`;
    }
    return { note, ms: Date.now() - t0 };`,
  `    let note;
    let status = 0;
    try {
      const res = await page.goto(\`\${BASE}\${p}\`, { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
      status = res ? res.status() : 0;
      note = \`status \${status}\`;
    } catch (error) {
      note = \`networkidle not reached: \${String(error).slice(0, 160)}\`;
    }
    return { note, status, ms: Date.now() - t0, at: new Date().toISOString() };`,
);
rep(
  `  try {
    const nav = await go("/");
    await page.waitForTimeout(800);
    const atTop = await page.evaluate(headerMetrics);
    const rest = await downThenUp(page);
    evidence.header[vp.tag] = { nav, atTop, ...rest, treeNewest: treeStamp().at };
    console.log(\`[\${vp.tag}] header: \${atTop ? atTop.height : "none"} px, \${atTop ? atTop.position : ""}\`);
  } catch (error) {
    evidence.header[vp.tag] = { error: String(error).slice(0, 300) };
    console.log(\`[\${vp.tag}] header FAILED \${String(error).slice(0, 200)}\`);
  }`,
  `  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const nav = await go("/");
      await page.waitForTimeout(800);
      const atTop = await page.evaluate(headerMetrics);
      if ((nav.status >= 400 || !atTop) && attempt < MAX_ATTEMPTS) {
        console.log(\`[\${vp.tag}] header: \${nav.note}, no header — the app is broken right now, retry \${attempt}\`);
        await page.waitForTimeout(15000);
        continue;
      }
      const rest = await downThenUp(page);
      evidence.header[vp.tag] = { nav, atTop, ...rest, treeNewest: treeStamp().at, attempts: attempt };
      console.log(\`[\${vp.tag}] header: \${atTop ? atTop.height : "none"} px, \${atTop ? atTop.position : ""}\`);
      break;
    } catch (error) {
      evidence.header[vp.tag] = { error: String(error).slice(0, 300) };
      console.log(\`[\${vp.tag}] header FAILED \${String(error).slice(0, 200)}\`);
    }
  }`,
);
rep(`   for (let attempt = 1; attempt <= 3; attempt++) {`, `   for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {`);
rep(
  `      const nav = await go(p);
      await page.waitForTimeout(500);
      await scrollThrough(page);`,
  `      const nav = await go(p);
      if (nav.status >= 400 && attempt < MAX_ATTEMPTS) {
        console.log(\`[\${vp.tag}] \${p}: \${nav.note} — the app is broken right now (\${errors[0] ? errors[0].slice(0, 120).replace(/\n/g, " ") : "no console error"}), retry \${attempt}\`);
        await page.waitForTimeout(15000);
        continue;
      }
      await page.waitForTimeout(500);
      await scrollThrough(page);`,
);
rep(
  `      if (stampAfter.ms !== stampBefore.ms && attempt < 3) {`,
  `      if (stampAfter.ms !== stampBefore.ms && attempt < MAX_ATTEMPTS) {`,
);
rep(`      if (attempt === 3) break;`, `      if (attempt === MAX_ATTEMPTS) break;
      await page.waitForTimeout(5000);`);
rep(`        nav,
        url: page.url().replace(BASE, ""),`, `        nav,
        httpStatus: nav.status,
        url: page.url().replace(BASE, ""),`);
writeFileSync(f, s);
console.log("patched 3");
