// Verify seo-15: consent banner position in server HTML (no sk_consent cookie) vs header / h1 / main,
// with a Googlebot UA and a normal UA, plus the same with sk_consent set.
import { writeFileSync } from "node:fs";
const BASE = process.env.AUDIT_BASE || "http://localhost:3100";
const routes = ["/", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", "/delovi/kocioni-diskovi", "/delovi/kocioni-diskovi/volkswagen/golf", "/vozila/volkswagen/golf/golf-7", "/ponuda/kocione-plocice-golf", "/kontakt", "/pretraga?q=disk"];
const UAS = {
  googlebot: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
};
const lines = [];
for (const r of routes) {
  for (const [label, headers] of [["googlebot, no cookie", { "user-agent": UAS.googlebot }], ["googlebot, sk_consent set", { "user-agent": UAS.googlebot, cookie: "sk_consent=" + encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false })) }]]) {
    const res = await fetch(BASE + r, { headers });
    const html = await res.text();
    const body = html.indexOf("<body");
    const pos = (re) => { const m = re.exec(html); return m ? m.index : -1; };
    const kol = pos(/>Kolačići<\/h2>/);
    const dialog = pos(/role="dialog"[^>]*aria-label[^>]*|aria-labelledby="[^"]*"[^>]*role="dialog"/);
    const header = pos(/<header[\s>]/);
    const main = pos(/<main[\s>]/);
    const h1 = pos(/<h1[\s>]/);
    const firstHeading = (/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/.exec(html.slice(body)) || [])[1]?.replace(/<[^>]+>/g, "").trim();
    const nosnippet = /data-nosnippet/.test(html);
    lines.push(`${r} [${res.status}] (${label}) body@${body} consentH2@${kol} header@${header} main@${main} h1@${h1} firstHeading="${firstHeading}" data-nosnippet=${nosnippet}`);
  }
}
// Visible text order (as a text extractor would see it): strip tags from body and show the first 400 chars.
const home = await (await fetch(BASE + "/", { headers: { "user-agent": UAS.googlebot } })).text();
const text = home.slice(home.indexOf("<body")).replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
lines.push("\nHome body text, first 600 chars (tags stripped, scripts/styles removed):\n" + text.slice(0, 600));
const txt = lines.join("\n");
console.log(txt);
writeFileSync("docs/qa/audit/verify/seo/seo-15-reproduce.txt", `seo-15 reproduce — ${new Date().toISOString()} — ${BASE}\n\n${txt}\n`);
