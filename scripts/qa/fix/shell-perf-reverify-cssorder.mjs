import { chromium } from "@playwright/test";
const b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 360, height: 780 } });
  await p.goto("http://localhost:3001/delovi/kocioni-diskovi", { waitUntil: "networkidle" });
  const r = await p.evaluate(() => {
    const out = [];
    let i = 0;
    const walk = (rules, layer) => {
      for (const rule of rules) {
        i++;
        if (rule.cssRules && !(rule instanceof CSSStyleRule))
          walk(rule.cssRules, rule.name ?? rule.conditionText ?? layer);
        if (
          rule instanceof CSSStyleRule &&
          [
            ".hidden",
            ".inline-flex",
            ".sm\:inline-flex",
            ".min-\[90rem\]\:inline-flex",
            ".min-\[90rem\]\:hidden",
          ].includes(rule.selectorText)
        )
          out.push(`${i} [${layer}] ${rule.selectorText} { ${rule.style.cssText} }`);
        if (rule instanceof CSSStyleRule && rule.cssRules?.length)
          walk(rule.cssRules, layer + " " + rule.selectorText);
      }
    };
    for (const s of document.styleSheets) {
      try {
        walk(s.cssRules, "top");
      } catch {}
    }
    return out;
  });
  console.log(r.join("\n"));
} finally {
  await b.close();
}
