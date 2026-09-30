/** verify a11y-store-11: which markup variants avoid the space before the colon in Chromium's native accname. */
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
const sr = "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0";
const html = `<style>.sr-only{${sr}}</style>
<button id=a style="display:inline-flex;gap:8px"><span>Dodaj u korpu</span><span class=sr-only>: Disk</span></button>
<button id=b style="display:inline-flex;gap:8px"><span>Dodaj u korpu<span class=sr-only>: Disk</span></span></button>
<button id=c>Izmeni<span class=sr-only>: Kontakt</span></button>
<button id=d aria-label="Dodaj u korpu: Disk" style="display:inline-flex"><span>Dodaj u korpu</span></button>
<button id=e style="display:inline-flex"><span>Dodaj u korpu<span style="position:fixed;clip-path:inset(50%)">: Disk</span></span></button>`;
const b = await chromium.launch();
const p = await b.newPage();
await p.setContent(html);
const c = await p.context().newCDPSession(p);
await c.send("Accessibility.enable");
const { nodes } = await c.send("Accessibility.getFullAXTree");
const out = {};
for (const n of nodes.filter((n) => n.role?.value === "button")) out[n.backendDOMNodeId] = n.name.value;
const ids = await p.evaluate(() => [...document.querySelectorAll("button")].map((b) => b.id));
const res = Object.values(out).map((v, i) => `${ids[i]}: "${v}"`);
console.log(res.join("\n"));
writeFileSync("docs/qa/audit/verify/a11y-store/a11y-store-11-reproduce-fix-variants.txt", res.join("\n") + "\n");
await b.close();
