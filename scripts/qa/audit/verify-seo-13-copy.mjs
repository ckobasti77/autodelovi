// Verifier for seo-13: count programmatic copy defects in product meta descriptions and landing intros.
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const NBSP = String.fromCharCode(0xa0);

const locs = async (file) =>
  [...(await (await fetch(`${BASE}/sitemaps/${file}`)).text()).matchAll(/<loc>([^<]*)<\/loc>/g)]
    .map((m) => m[1].replace(/^https?:\/\/[^/]+/, ""))
    .filter((p) => !/\.(webp|avif|png|jpg)$/i.test(p) && !p.startsWith("/slike/"));

const decode = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

const products = (await locs("proizvodi-1.xml")).filter((p) => p.startsWith("/deo/"));
const landings = await locs("landing.xml");

const prod = await pool(products, 4, async (u) => {
  const html = await (await fetch(BASE + u)).text();
  const d = decode((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] ?? "");
  return {
    url: u,
    description: d,
    duplicateQuality: /\(([^,()]+), \1\)/.test(d),
    danglingI: / i …/.test(d),
    // Any ellipsis in the vehicle list (the only place productMeta shortens).
    truncatedVehicles: /…\s+(Cena|Na stanju|Po porudžbini|Trenutno)/.test(d),
  };
});

const land = await pool(landings, 4, async (u) => {
  const html = (await (await fetch(BASE + u)).text()).replace(/<script[\s\S]*?<\/script>/g, "");
  const text = html
    .replace(/<\/(p|div|h1|h2|h3|li|section|dd|dt)>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .split(NBSP)
    .join(" ");
  const intro = (text.match(/Za [^\n]*imamo[^\n]*/) || [])[0] ?? "";
  const gensMatch = intro.match(/Pokrivene generacije: (.*?)\. Proizvo/) ?? intro.match(/Najviše delova ima za (.*?)\. Proizvo/);
  const gens = gensMatch ? gensMatch[1] : null;
  const years = gens ? [...gens.matchAll(/\((\d{4})/g)].map((m) => Number(m[1])) : [];
  const chronological = years.every((y, i) => i === 0 || years[i - 1] <= y);
  return {
    url: u,
    intro,
    doubleI: /Proizvođači: [^.]* i [^.]* i još \d+\./.test(intro),
    josOne: /i još 1\./.test(intro),
    generationsListed: gens,
    nonChronological: years.length > 1 && !chronological,
  };
});

const summary = {
  products: prod.length,
  duplicateQuality: prod.filter((p) => p.duplicateQuality).length,
  truncatedVehicleList: prod.filter((p) => p.truncatedVehicles).length,
  danglingI: prod.filter((p) => p.danglingI).length,
  landings: land.length,
  landingsWithIntro: land.filter((l) => l.intro).length,
  landingDoubleI: land.filter((l) => l.doubleI).length,
  landingJosOne: land.filter((l) => l.josOne).length,
  landingNonChronologicalGenerations: land.filter((l) => l.nonChronological).length,
};

mkdirSync("docs/qa/audit/verify/seo", { recursive: true });
writeFileSync(
  "docs/qa/audit/verify/seo/seo-13-reproduce-copy.json",
  JSON.stringify(
    {
      summary,
      products: prod.filter((p) => p.duplicateQuality || p.truncatedVehicles),
      landings: land.filter((l) => l.doubleI || l.nonChronological),
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(summary, null, 2));
console.log(
  "sample truncated:",
  prod
    .filter((p) => p.truncatedVehicles)
    .slice(0, 6)
    .map((p) => p.description.match(/za (.*?…)/)?.[1]),
);
console.log(
  "sample landings:",
  land
    .filter((l) => l.doubleI)
    .slice(0, 2)
    .map((l) => `${l.url} :: ${l.intro}`),
);
