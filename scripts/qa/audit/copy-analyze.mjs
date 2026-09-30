/**
 * Copy track: runs the Serbian copy rules over one or more crawl-*.json files and writes
 * docs/qa/audit/copy/analysis-<name>.txt (each distinct offending line once, with the pages it is on).
 *
 *   node scripts/qa/audit/copy-analyze.mjs <name> crawl-a.json [crawl-b.json ...]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [name, ...files] = process.argv.slice(2);
const dir = path.resolve("docs/qa/audit/copy");

const RULES = {
  // English UI words standing alone or in English phrases (checked per line)
  english: /\b(Loading|Submit|Cancel|Save|Close|Search|Next|Previous|Back|Remove|Delete|Edit|Checkout|Sign in|Sign up|Log ?in|Log ?out|Password|Required|Invalid|Please|Something went wrong|Try again|Not found|Skip to|Toggle|Select|Choose|Show more|Upload|Download|Copied|Success|Warning|Error|Settings|Dashboard|Home|Cart|Order|Quantity|Subtotal|Shipping|Payment|Customer|Welcome|Continue|Confirm|Apply|Reset|Clear|Sort by|View|Details|Page \d|Menu|Account|Profile|Help|Contact|About|Terms|Privacy|Accept|Decline|Reject|Allow|Share|Print|Export|Import|Retry|Refresh|Send|Sent|Pending|Approved|Draft|Thank you|Thanks|Oops|Sorry|Click here|Browse|Selected|Enabled|Disabled|Active|Inactive|Online|Offline|Breadcrumb|breadcrumb|Close dialog|Open|Previous slide|Next slide|Go to|Scroll|Notifications|Dismiss|Toggle menu|Main navigation|Footer|Header|Image|Gallery|Zoom|New|Sale|Free shipping|Best seller|In stock|Out of stock|Add to cart|Buy now)\b/,
  ijekavian: /\b(dio|dijel\w*|cijen\w*|rješ\w*|vrijem\w*|mjest\w*|lijev\w*|bijel\w*|uvjet\w*|mjesec\w*|djec\w*|tijel\w*|prije\b|poslije|riječ\w*|lijep\w*|htio|vidio|primjer\w*|svjetl\w*|zamjen\w*|mijenja\w*|smjer\w*|cjel\w*|cijel\w*|ocjen\w*|procjen\w*|obavijest\w*|nedjelj\w*|sjever\w*|namjen\w*|objašnjen\w*|tjed\w*|vrijed\w*|pojedinost|uvijek|gdje|ovdje|nigdje|svugdje|prijevoz\w*|provjer\w*|mjer\w*|bilje\w*|dje\w*l)\b/i,
  // ASCII spellings of common words that need diacritics (visible copy; never in slugs)
  asciiDiacritic: /(?<![\w/-])(porudzbin\w*|narudzbin\w*|placanj\w*|placa\w*|licno|kocion\w*|kocnic\w*|plocic\w*|celjust\w*|sasij\w*|zupcast\w*|sifr\w*|kolicin\w*|postansk\w*|maticn\w*|obavestenj\w*|podesavanj\w*|posalji\w*|pogresn\w*|cekanj\w*|zavrsen\w*|isporucen\w*|isporuc\w*|potvrdjen\w*|prihvacen\w*|Skoda\w*|tockov\w*|tocak|vesanj\w*|hladjenj\w*|svecic\w*|grejac\w*|menjac\w*|lezaj\w*|glavcin\w*|tecnost\w*|brisac\w*|kvacil\w*|mozete|mozemo|cemo|ucitava\w*|greska|gresk\w*|pokusaj\w*|obrisi\w*|sacuvaj\w*|sacuvan\w*|uspesn\w*|pronadjen\w*|pronadj\w*|takodje|zasto|cesto|cest[aei]|pocetn\w*|koriscenj\w*|kolacic\w*|izaberite vozilo za tacno|tacno|tacn\w*|slican|sličan|dostupn\w* odmah)(?![\w/-])/,
  cyrillic: /[Ѐ-ӿ]/,
  straightQuotes: /(^|[\s(])"[^"\n]{1,80}"/,
  singleQuotes: /(^|\s)'[^'\n]{1,60}'(\s|[.,]|$)/,
  wrongOpenQuote: /“[^”“„\n]{1,80}[”“]/, // English-style opening quote in Serbian copy
  threeDots: /\.\.\./,
  hyphenRange: /(?<![\w./-])(\d{1,4})\s?-\s?(\d{1,4})(?![\w./-])/, // 1-2 dana, 2012-2020
  hyphenAsDash: /\S\s-\s\S/, // spaced hyphen used as a dash
  xDimension: /\b\d+(?:[.,]\d+)?\s?x\s?\d+(?:[.,]\d+)?\s?(mm|cm|m|Ah|kom|W)?\b/,
  exclamation: /[A-Za-zčćžšđČĆŽŠĐ0-9)]!(\s|$)/,
  todo: /\b(TODO|FIXME|lorem|ipsum|TBD|undefined|null|NaN|\[object Object\])\b/,
  emoji: /\p{Extended_Pictographic}/u,
  decimalPoint: /\b\d+\.\d{2}\s?(RSD|din)/, // 12990.00 RSD
  rsdNoGroup: /\b\d{5,}\s?RSD/, // 12990 RSD (no grouping)
  rsdLeading: /RSD\s?\d/, // RSD 12.990
  dinSign: /\b\d[\d.]*\s?(din\.?|dinara)\b/,
  dateFormat: /\b\d{1,2}\.\d{1,2}\.\d{4}(?!\.)|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
  timeFormat: /\b\d{1,2}(h|:\d{2}h)\b|\b\d{1,2}\s?(AM|PM|am|pm)\b/,
  percentNoSpace: /\d%/,
  titleCase: null, // computed below
  doubleSpace: /\S  +\S/,
  spaceBeforePunct: /\s[,.;:](\s|$)/,
  lowercaseVi: /\b(Vi|Vas|Vam|Vaš|Vaša|Vaše|Vašu|Vašeg|Vašem|Vašim)\b/, // capitalised Vi mid-sentence (checked below)
  email: /\b(e-mail|email|E-mail|Email|mejl\w*|imejl\w*|e-pošt\w*|E-pošt\w*)\b/,
};

function isTitleCase(line) {
  const words = line.trim().split(/\s+/);
  if (words.length < 3 || words.length > 7) return false;
  const lettersOnly = words.filter((w) => /^[A-Za-zČĆŽŠĐčćžšđ]{3,}$/.test(w));
  if (lettersOnly.length < 3) return false;
  const brand = /^(Volkswagen|Audi|Škoda|SEAT|Seat|Cupra|Golf|Passat|Polo|Octavia|Leon|Ibiza|Tiguan|Touran|Fabia|Superb|Rapid|Kodiaq|Karoq|Ateca|Formentor|Caddy|Original|VAG|OEM|Viber|WhatsApp|Google|Meta|Bosch|Valeo|Sachs|Febi|Bilstein|Castrol|Mann|Mahle|Brembo|Gates|Hella|Varta|Denso|SKLOP|PDV|VIN|Srbija|Beograd|Novi|Sad|Niš|Kragujevac|Majstor|Plus|Partner|Max|TDI|TSI|TFSI)$/;
  const caps = lettersOnly.filter((w) => /^[A-ZČĆŽŠĐ][a-zčćžšđ]+$/.test(w) && !brand.test(w));
  const lower = words.filter((w) => /^[a-zčćžšđ]{3,}/.test(w));
  return caps.length >= 3 && lower.length === 0;
}

const pages = [];
for (const f of files) {
  const j = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
  for (const r of j.results) pages.push({ ...r, source: f });
}

const hits = {}; // rule -> line -> Set(urls)
const add = (rule, line, url) => {
  ((hits[rule] ??= {})[line] ??= new Set()).add(url);
};

for (const p of pages) {
  if (!p.text) continue;
  const lines = [
    ...p.text.split("\n").map((l) => ["text", l.trim()]),
    ...(p.attrs ?? []).map((a) => [`${a.tag}@${a.attr}`, a.value]),
    ...(p.hidden ?? []).map((h) => ["hidden", h]),
    ["title", p.title ?? ""],
    ["description", p.description ?? ""],
    ["ogTitle", p.ogTitle ?? ""],
    ["ogDescription", p.ogDescription ?? ""],
    ["ogImageAlt", p.ogImageAlt ?? ""],
  ];
  for (const [kind, line] of lines) {
    if (!line) continue;
    for (const [rule, re] of Object.entries(RULES)) {
      if (rule === "titleCase") {
        if (kind !== "hidden" && isTitleCase(line)) add(rule, `[${kind}] ${line}`, p.url);
        continue;
      }
      if (rule === "lowercaseVi") {
        // capitalised Vi/Vaš not at sentence start
        const m = line.match(/[a-zčćžšđ,]\s(Vi|Vas|Vam|Vaš\w*)\b/);
        if (m) add(rule, `[${kind}] ${line.slice(0, 200)}`, p.url);
        continue;
      }
      if (re && re.test(line)) add(rule, `[${kind}] ${line.slice(0, 220)}`, p.url);
    }
  }
}

let out = `pages: ${pages.length} from ${files.join(", ")}\n`;
const summary = {};
for (const [rule, lines] of Object.entries(hits)) {
  const entries = Object.entries(lines).sort((a, b) => b[1].size - a[1].size);
  summary[rule] = entries.length;
  out += `\n## ${rule} (${entries.length} distinct lines)\n`;
  for (const [line, urls] of entries.slice(0, 200)) {
    const u = [...urls];
    out += `${line}\n    ↳ ${u.length} page(s): ${u.slice(0, 4).join(" ")}${u.length > 4 ? " …" : ""}\n`;
  }
}
writeFileSync(path.join(dir, `analysis-${name}.txt`), out);
console.log(summary);
