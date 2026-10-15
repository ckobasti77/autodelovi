import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { arc, plus } from './marks.mjs';

const dir = new URL('.', import.meta.url).pathname;
const NIGHT = { bg: '#0D0F11', ink: '#F1ECE3', acc: '#FF6B1A' };
const PAPER = { bg: '#FFFFFF', ink: '#121518', acc: '#FF6B1A' };
const NAVY = { bg: '#FFFFFF', ink: '#1B2A6B', acc: '#FF6B1A' };
const vars = (t) => `--bg:${t.bg};--ink:${t.ink};--acc:${t.acc};background:${t.bg};color:${t.ink}`;

// ---------- marks (120 x 120) ----------
const markA = (small) => arc({ cx: 62, cy: 60, rx: small ? 44 : 48, ry: small ? 44 : 48, n: small ? 5 : 10, r0: small ? 15 : 5.5, r1: small ? 19 : 10, a0: -44, sweep: 272 });
const markB = (small) => arc({ cx: 62, cy: 60, rx: small ? 46 : 48, ry: small ? 46 : 48, n: small ? 5 : 9, r0: small ? 13 : 5.5, r1: small ? 16 : 10, a0: -44, sweep: 272 }) + plus(66, 60, small ? 26 : 19);
const markC = (small) => arc({ cx: 60, cy: 60, rx: small ? 44 : 47, ry: small ? 44 : 47, n: small ? 5 : 9, r0: small ? 13 : 5, r1: small ? 22 : 15, a0: -42, sweep: 282, last: 'plus' });
const svg = (inner, size, vb = '0 0 120 120') => `<svg viewBox="${vb}" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;

// ---------- stacked lockup, faithful to the original layout ----------
function stacked(variant) {
  const W = 860, H = 470; const X = 480;
  const last = variant === 'C' ? 'plus' : 'star';
  const n = variant === 'B' ? 11 : 12;
  const stars = arc({ cx: 400, cy: 236, rx: 318, ry: 212, n, r0: 11, r1: variant === 'C' ? 26 : 24, a0: -50, sweep: 268, last });
  const mid = variant === 'B'
    ? `<g transform="translate(${X} 285.5)">${plus(0, 0, 14)}</g>`
    : `<text x="${X}" y="299" class="plus-t" text-anchor="middle">PLUS</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W * 0.86}" height="${H * 0.86}">
    ${stars}
    <text x="${X}" y="250" class="name-t" text-anchor="middle">EUROMOTORS</text>
    <rect x="${X - (variant === 'B' ? 32 : 92) - 170}" y="284" width="170" height="3" rx="1.5" fill="var(--ink)"/>
    <rect x="${X + (variant === 'B' ? 32 : 92)}" y="284" width="170" height="3" rx="1.5" fill="var(--ink)"/>
    ${mid}
    <text x="${X}" y="352" class="oem-t" text-anchor="middle"><tspan class="oem">OEM</tspan> <tspan class="parts">Parts</tspan></text>
  </svg>`;
}

// ---------- horizontal lockup for the header ----------
function horizontal(mark) {
  return `<div class="lockup"><div class="mk">${svg(mark(false), 112)}</div><div class="words">
    <div class="name">EUROMOTORS</div>
    <div class="sub"><span class="plusw">PLUS</span><span class="rule"></span><span class="by"><b>OEM</b> <i>Parts</i></span></div>
  </div></div>`;
}

function smalls(mark, t) {
  return `<div class="smalls" style="${vars(t)}">${[64, 32, 16].map((s) => svg(mark(s <= 32), s)).join('')}
    <div class="tab"><span class="fav">${svg(mark(true), 16)}</span><span class="tabt">Euromotors Plus</span></div></div>`;
}

const V = [
  { id: 'A', name: 'Venac zvezda', note: 'Najbliže originalu: isti luk od 12 zvezda, isti raspored. Zvezde su čiste i geometrijske i rastu niz luk, pa se čita pokret. OEM Parts je u stilu njihovog drugog loga.', mark: markA },
  { id: 'B', name: 'Venac + plus', note: 'Luk zvezda oko narandžastog „+“. Plus je i „PLUS“ iz imena i jedini narandžasti signal sajta. Najjači znak za favicon i ikonicu.', mark: markB },
  { id: 'C', name: 'Zvezde u pokretu', note: 'Zvezde rastu i ubrzavaju, a poslednja se pretvara u narandžasti „+“. Priča: od evropskih zvezda do Plus-a.', mark: markC },
];

const rows = V.map((v) => `
<section class="row">
  <header><span class="id">${v.id}</span><h2>${v.name}</h2><p>${v.note}</p></header>
  <div class="cells">
    <div class="cell st" style="${vars(NIGHT)}">${stacked(v.id)}</div>
    <div class="cell st" style="${vars(v.id === 'A' ? NAVY : PAPER)}">${stacked(v.id)}</div>
  </div>
  <div class="cells2">
    <div class="cell lock" style="${vars(NIGHT)}">${horizontal(v.mark)}</div>
    <div class="cell lock" style="${vars(PAPER)}">${horizontal(v.mark)}</div>
    <div class="cell sm">${smalls(v.mark, NIGHT)}${smalls(v.mark, PAPER)}</div>
  </div>
</section>`).join('');

const html = `<!doctype html><html lang="sr"><head><meta charset="utf-8"><title>Euromotors Plus — logo sa zvezdama</title>
<style>
@font-face{font-family:ArchivoV;src:url(node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2) format('woff2');font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:SairaV;src:url(node_modules/@fontsource-variable/saira/files/saira-latin-wdth-italic.woff2) format('woff2');font-weight:100 900;font-stretch:50% 125%;font-style:italic}
*{box-sizing:border-box;margin:0}
body{background:#17191C;color:#F1ECE3;font-family:ArchivoV,system-ui,sans-serif;padding:40px;width:1700px}
h1{font-weight:800;font-stretch:125%;font-size:30px;letter-spacing:.02em}
.lead{color:#9AA0A6;margin:8px 0 28px;font-size:16px}
.row{margin-bottom:34px}
.row header{display:flex;align-items:baseline;gap:14px;margin-bottom:10px}
.id{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:8px;background:#FF6B1A;color:#0D0F11;font-weight:800;font-size:18px;flex:none}
h2{font-weight:800;font-stretch:115%;font-size:22px;white-space:nowrap}
.row p{color:#A9AFB5;font-size:15px}
.cells{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.cells2{display:grid;grid-template-columns:600px 600px 1fr;gap:12px}
.cell{border-radius:12px;display:grid;place-items:center;padding:18px;overflow:hidden}
.cell.sm{padding:0;gap:12px;grid-template-rows:1fr 1fr;place-items:stretch;background:transparent}
.smalls{border-radius:12px;display:flex;align-items:center;gap:16px;padding:12px 14px;flex-wrap:wrap}
.tab{display:flex;align-items:center;gap:8px;border-radius:8px;padding:6px 10px;font-size:13px;background:color-mix(in srgb,var(--ink) 10%,var(--bg))}
.name-t{font-family:ArchivoV;font-weight:800;font-stretch:125%;font-size:60px;fill:var(--ink);letter-spacing:.5px}
.plus-t{font-family:ArchivoV;font-weight:800;font-stretch:125%;font-size:32px;fill:var(--ink);letter-spacing:5px}
.oem-t{font-family:SairaV;font-style:italic;font-size:36px;fill:var(--ink)}
.oem-t .oem{font-weight:900;font-stretch:125%}
.oem-t .parts{font-weight:900;font-stretch:125%;fill:transparent;stroke:var(--ink);stroke-width:1.4px}
.lockup{display:flex;align-items:center;gap:14px}
.lockup .mk{display:flex}
.words{display:flex;flex-direction:column;gap:7px}
.name{font-weight:800;font-stretch:125%;font-size:46px;letter-spacing:.005em;line-height:.82;white-space:nowrap}
.sub{display:flex;align-items:center;gap:10px}
.plusw{font-weight:800;font-stretch:125%;font-size:21px;letter-spacing:.06em;line-height:1}
.rule{flex:1;height:2px;background:currentColor;opacity:.9;border-radius:1px}
.by{font-family:SairaV;font-style:italic;font-size:21px;white-space:nowrap;line-height:1}
.by b{font-weight:900;font-stretch:125%}
.by i{font-weight:900;font-stretch:125%;color:transparent;-webkit-text-stroke:1.2px var(--ink)}
</style></head><body>
<h1>EUROMOTORS PLUS · OEM Parts — moderni logo sa zvezdama, 3 varijante</h1>
<p class="lead">Polazište je njihov postojeći logo (luk zvezda, EUROMOTORS / PLUS) + „OEM Parts“ u stilu drugog loga. Svaki red: veliki logo (tamno · belo) · logo za header · male veličine i favicon.</p>
${rows}
</body></html>`;

writeFileSync(dir + 'board.html', html);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1780, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('file://' + dir + 'board.html');
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: dir + 'board.png', fullPage: true });
await browser.close();
console.log('ok');
