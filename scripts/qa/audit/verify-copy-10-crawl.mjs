// copy-10 verification: crawl every landing in the landing sitemap and classify the manufacturer sentence.
import { writeFileSync } from "node:fs";
import { BASE } from "./kit.mjs";

const sm = await (await fetch(`${BASE}/sitemaps/landing.xml`)).text();
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace("http://localhost:3000", BASE));
const out = { sitemapUrls: urls.length, doubleI: [], okOrNoMore: [], noSentence: [] };
for (const u of urls) {
  const raw = await (await fetch(u)).text();
  const body = raw.slice(raw.indexOf("<body"));
  const html = body.replace(/<script[\s\S]*?<\/script>/g, " ");
  const text = html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
  const s = (text.match(/Proizvođači: [^.]*?\(\d+\)[^.]*\./) ?? [])[0];
  const p = u.replace(BASE, "");
  if (!s) out.noSentence.push(p);
  else if (/ i [^,]*\(\d+\) i još \d+/.test(s)) out.doubleI.push(`${p} :: ${s}`);
  else out.okOrNoMore.push(`${p} :: ${s}`);
}
out.counts = {
  doubleI: out.doubleI.length,
  okOrNoMore: out.okOrNoMore.length,
  noSentence: out.noSentence.length,
  moreIs1: out.doubleI.filter((x) => /i još 1\.$/.test(x)).length,
};
writeFileSync("docs/qa/audit/verify/copy/copy-10-reproduce-crawl.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.counts), "\n", out.doubleI.join("\n"), "\n---ok:\n", out.okOrNoMore.join("\n"), "\n---none:", out.noSentence.join(" "));
