// Verify seo-14: meta descriptions of content pages (server HTML), plus og:description.
import { writeFileSync } from "node:fs";
const BASE = process.env.AUDIT_BASE || "http://localhost:3100";
const routes = ["/kolacici", "/dostava-i-placanje", "/uslovi-koriscenja", "/reklamacije-i-povrat", "/politika-privatnosti", "/o-nama", "/kontakt", "/cesta-pitanja"];
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const out = [];
for (const r of routes) {
  const res = await fetch(BASE + r, { redirect: "manual" });
  const html = await res.text();
  const m = html.match(/<meta name="description" content="([^"]*)"/);
  const og = html.match(/<meta property="og:description" content="([^"]*)"/);
  const d = m ? decode(m[1]) : null;
  const flags = [];
  if (d && /\|/.test(d)) flags.push("PIPE");
  if (d && /(^|\s)[-*]\s/.test(d)) flags.push("LIST-MARKER");
  if (d && /\s-\s/.test(d)) flags.push("DASH-RUN");
  out.push(`${r}  [${res.status}]  len=${d ? d.length : "-"}  flags=${flags.join(",") || "none"}\n  description: ${d}\n  og:description: ${og ? decode(og[1]) : null}\n`);
}
const txt = out.join("\n");
console.log(txt);
writeFileSync("docs/qa/audit/verify/seo/seo-14-reproduce.txt", `seo-14 reproduce — ${new Date().toISOString()} — ${BASE}\n\n${txt}`);
