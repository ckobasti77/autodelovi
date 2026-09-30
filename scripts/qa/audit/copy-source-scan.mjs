/**
 * Copy track: parses every .ts/.tsx under app, components, lib, convex, constants, config with the
 * TypeScript compiler and lists user-facing string candidates (JSX text, JSX attribute strings for
 * copy attributes, string/template literals with a space or Serbian letters) that match copy rules:
 * English UI words, ijekavian stems, straight quotes, three dots, hyphen ranges, "x" dimensions,
 * exclamation marks, Cyrillic, TODO/lorem, Title Case, ASCII spellings of words that need diacritics.
 *
 *   node scripts/qa/audit/copy-source-scan.mjs  → docs/qa/audit/copy/source-scan.json (+ .txt summary)
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOTS = ["app", "components", "lib", "convex", "constants", "config", "emails"];
const SKIP = /node_modules|_generated|\.test\.|\.spec\.|tests[\\/]|seedData|styleguide/;

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !SKIP.test(p)) out.push(p);
  }
  return out;
}

const COPY_ATTRS = new Set([
  "aria-label", "placeholder", "title", "alt", "label", "description", "hint", "helper", "helperText",
  "aria-description", "aria-roledescription", "aria-valuetext", "emptyText", "caption", "heading", "text",
  "confirmLabel", "cancelLabel", "submitLabel", "legend", "subtitle", "tooltip", "message",
]);

const ENGLISH = /\b(Loading|Submit|Cancel|Save|Close|Open menu|Search|Next|Previous|Back to|Add to|Remove|Delete|Edit|Checkout|Sign in|Sign out|Log ?in|Log ?out|Password|Required|Invalid|Please|Something went wrong|Try again|Not found|Skip to|Toggle|Select|Choose|Show more|Show less|Upload|Download|Copied|Success|Warning|Error|Notifications?|Settings|Dashboard|Home|Cart|Order|Price|Stock|Quantity|Total|Subtotal|Shipping|Delivery|Payment|Customer|Product|Products|Category|Categories|Vehicle|Inquiry|Quote|Welcome|Continue|Confirm|Apply|Reset|Clear|Filter|Sort|Sort by|View|Details|Items?|Page|of|and|the|your|you|with|for|this|that|is|are|not|no results|empty|unknown|untitled|new|all|none|yes|no|ok|OK|Done|Menu|Account|Profile|Help|Contact|About|Terms|Privacy|Cookies|Accept|Decline|Reject|Allow|Deny|Share|Copy|Print|Export|Import|Retry|Refresh|Reload|Send|Sent|Pending|Approved|Rejected|Draft|Status|Date|Time|Name|Email|Phone|Address|City|Note|Notes|Message|Message sent|Thank you|Thanks|Oops|Sorry|Click|Tap|Drag|Drop|Browse|Selected|Unselected|Enabled|Disabled|Active|Inactive|Online|Offline|Required field)\b/;

const IJEKAVIAN = /\b(dio|dijel|cijen|rješ|vrijem|mjest|lijev|bijel|uvjet|pjesm|mjesec|sjedi|vjer|djec|tijel|prije|poslije|rijeka|rijeci|riječ|lijep|mlijek|snijeg|htio|vidio|dijelov|prijevo|primjer|pretraživ|pogrješ|svjetl|zamjen|mjenja|mijenja|smjer|vjetr|cjelin|cijel|ocjen|procjen|obavijest|nedjelj|sjedište|sjever|namjen|objašnj|pjesak|tjed)/i;

// ASCII spellings of words that need diacritics (visible copy only; slugs/identifiers filtered by context).
const ASCII_DIACRITIC = /\b(porudzbin\w*|placanj\w*|licno|preuzimanj\w*|kocion\w*|plocic\w*|celjust\w*|sasij\w*|zupcast\w*|pretrazi\w*|vozil[ao] (?:je|su)|sifr\w*|kolicin\w*|postansk\w*|maticn\w*|obavestenj\w*|podesavanj\w*|hvala vam|posalji\w*|pogresn\w*|ceka\b|cekanj\w*|zavrsen\w*|isporucen\w*|potvrdjen\w*|prihvacen\w*|otkazan\w* porudz\w*|Skoda|Skodi|Srbij\w* do|tockov\w*|vesanj\w*|hladjenj\w*|svecic\w*|grejac\w*|menjac\w*|lezaj\w*|glavcin\w*|dihtung\w*|ulje i tecnost\w*|tecnost\w*|brisac\w*|kvacil\w*|Nasa|nas[ae] radnj\w*|dobrodosl\w*|moze\w*|mozete|necemo|cemo|ćemo|ucitava\w*|ucitaj\w*|izaberi\w* |greska|greske|gresk\w*|pokusaj\w*|obrisi\w*|izmeni\w* |sacuvaj\w*|sacuvan\w*|zatvori |uspesn\w*|neuspesn\w*|nije pronadjen\w*|pronadjen\w*|jos\b|vise\b|sto pre|takodje|izvinjavamo|dodji|dodjite|prodavnic\w* auto|zasto|cesto|cest[ao] pitanj\w*|odgovor\w* na pitanj\w*|radnim danom|subot\w*|nedelj\w*|pocetn\w*|stanj\w* je|uslovi koriscenja|politika privatnosti|kolacic\w*|reklamacij\w* i povrat)\b/;

const CYRILLIC = /[Ѐ-ӿ]/;
const STRAIGHT_QUOTES = /(^|[\s(])"[^"\s][^"]*"/; // "word" used as quotation in copy
const THREE_DOTS = /\.\.\./;
const HYPHEN_RANGE = /\b\d{1,4}\s?-\s?\d{1,4}\b(?!\s?\d)/; // 1-2, 2012-2020 (not OEM numbers)
const X_DIM = /\b\d+(?:[.,]\d+)?\s?x\s?\d+/; // 312x25 (× expected)
const EXCLAIM = /[A-Za-zčćžšđČĆŽŠĐ0-9)]!(\s|$)/;
const TODO = /\b(TODO|FIXME|XXX|lorem|ipsum|placeholder text|TBD)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;

function titleCase(s) {
  // three or more consecutive capitalised words of ≥3 letters in a short label
  const words = s.trim().split(/\s+/);
  if (words.length < 3 || words.length > 8) return false;
  const caps = words.filter((w) => /^[A-ZČĆŽŠĐ][a-zčćžšđ]{2,}/.test(w));
  const lower = words.filter((w) => /^[a-zčćžšđ]{3,}/.test(w));
  return caps.length >= 3 && lower.length === 0;
}

const files = ROOTS.flatMap((r) => walk(r));
const hits = [];

function add(file, sf, node, kind, text, rules) {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  hits.push({ file: file.replaceAll("\\", "/"), line: line + 1, kind, rules, text: text.slice(0, 240) });
}

function check(file, sf, node, kind, raw) {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || text.length < 2) return;
  const rules = [];
  const looksCopy = /\s/.test(text) || /[čćžšđČĆŽŠĐ]/.test(text) || kind !== "literal";
  if (!looksCopy) return;
  // Heuristic: skip code-ish literals (class names, selectors, paths, SQL-like, keys)
  if (kind === "literal" && (/^[\w-]+(\s[\w:-]+)+$/.test(text) && /(^|\s)(flex|grid|px-|py-|text-|bg-|border|rounded|items-|justify-|gap-|w-|h-|min-|max-|sm:|md:|lg:|hover:|focus|aria-|data-|inline|block|hidden|absolute|relative|sticky|type-|col-|row-|mt-|mb-|ml-|mr-|pt-|pb-|p-|m-|sr-only|tabular|truncate|shrink|grow|overflow|opacity|transition|z-|top-|left-|right-|bottom-|inset|size-|leading|tracking|font-|shadow|ring|outline|cursor|select-|pointer|place-|self-|order-|space-|divide|fill-|stroke-|object-|aspect|line-clamp|whitespace|break-|underline|decoration|uppercase|lowercase|capitalize)/.test(text))) return;
  if (kind === "literal" && /^(https?:|\/|\.|#|@|[a-z]+:[a-z])/.test(text)) return;
  if (ENGLISH.test(text) && !/[čćžšđ]/.test(text)) {
    // count English vs Serbian words to reduce noise
    const words = text.split(/\s+/);
    const en = words.filter((w) => ENGLISH.test(w)).length;
    if (en >= 2 || words.length <= 3) rules.push("english");
  }
  if (IJEKAVIAN.test(text)) rules.push("ijekavian");
  if (ASCII_DIACRITIC.test(text)) rules.push("ascii-diacritic");
  if (CYRILLIC.test(text)) rules.push("cyrillic");
  if (STRAIGHT_QUOTES.test(text)) rules.push("straight-quotes");
  if (THREE_DOTS.test(text)) rules.push("three-dots");
  if (HYPHEN_RANGE.test(text)) rules.push("hyphen-range");
  if (X_DIM.test(text)) rules.push("x-dimension");
  if (EXCLAIM.test(text)) rules.push("exclamation");
  if (TODO.test(text)) rules.push("todo-lorem");
  if (EMOJI.test(text)) rules.push("emoji");
  if (titleCase(text)) rules.push("title-case");
  if (/\d RSD/.test(text) && !/ RSD/.test(text)) rules.push("rsd-space");
  if (rules.length) add(file, sf, node, kind, text, rules);
}

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      check(file, sf, node, "jsx-text", node.getText(sf));
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const n = node.name.getText(sf);
      const init = node.initializer;
      const lit = ts.isStringLiteral(init) ? init : init.expression && (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression)) ? init.expression : null;
      if (lit && COPY_ATTRS.has(n)) check(file, sf, lit, `attr:${n}`, lit.text);
    } else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !ts.isImportDeclaration(node.parent) && !ts.isExportDeclaration(node.parent) && !(ts.isJsxAttribute(node.parent))) {
      // skip object keys, type literals, console/log messages
      const p = node.parent;
      if (ts.isPropertyAssignment(p) && p.name === node) return;
      if (ts.isLiteralTypeNode(p)) return;
      if (ts.isCallExpression(p) && /console\.|require|import|describe|it\(|test\(|querySelector|getElementById|addEventListener|getByTestId/.test(p.expression.getText(sf))) return;
      check(file, sf, node, "literal", node.text);
    } else if (ts.isTemplateExpression(node)) {
      const raw = [node.head.text, ...node.templateSpans.map((s) => `{x}${s.literal.text}`)].join("");
      check(file, sf, node, "template", raw);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const dir = path.resolve("docs/qa/audit/copy");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "source-scan.json"), JSON.stringify(hits, null, 1));
const byRule = {};
for (const h of hits) for (const r of h.rules) (byRule[r] ??= []).push(h);
let txt = `files scanned: ${files.length}\nhits: ${hits.length}\n`;
for (const [r, list] of Object.entries(byRule)) {
  txt += `\n## ${r} (${list.length})\n`;
  for (const h of list) txt += `${h.file}:${h.line} [${h.kind}] ${h.text}\n`;
}
writeFileSync(path.join(dir, "source-scan.txt"), txt);
console.log(Object.fromEntries(Object.entries(byRule).map(([k, v]) => [k, v.length])), "files", files.length);
