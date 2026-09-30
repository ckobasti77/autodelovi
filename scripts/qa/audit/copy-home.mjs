// Copy track: full text of the home page (textContent per section, since content-visibility hides innerText) at a given width.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, scrollThrough, shot } from "./kit.mjs";
const width = Number(process.argv[2] ?? 1440);
const path = process.argv[3] ?? "/";
const b = await launch();
const ctx = await newContext(b, { width, height: width < 800 ? 844 : 900, tag: "copy-home" });
const page = await ctx.newPage();
await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
await scrollThrough(page);
const data = await page.evaluate(() => {
  const out = [];
  const walk = (el, depth) => {
    for (const c of el.children) {
      if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "svg"].includes(c.tagName)) continue;
      const own = [...c.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).filter(Boolean).join(" ");
      if (own) out.push(`${"  ".repeat(Math.min(depth, 8))}<${c.tagName.toLowerCase()}${c.getAttribute("aria-hidden") === "true" ? " aria-hidden" : ""}${c.className && typeof c.className === "string" && c.className.includes("sr-only") ? " sr-only" : ""}> ${own}`);
      for (const a of ["aria-label", "title", "alt", "placeholder"]) if (c.getAttribute(a)) out.push(`${"  ".repeat(Math.min(depth, 8))}  @${a}=${c.getAttribute(a)}`);
      walk(c, depth + 1);
    }
  };
  walk(document.body, 0);
  return out.join("\n");
});
writeFileSync(`docs/qa/audit/copy/text-${path === "/" ? "home" : path.replace(/[^a-z0-9]+/gi, "_")}-${width}.txt`, data);
console.log(data.length);
await b.close();
