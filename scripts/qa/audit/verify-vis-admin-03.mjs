// Independent verification of vis-admin-03 (sidebar taller than laptop screens).
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, loginAdmin, shot } from "./kit.mjs";
const out = {};
const browser = await launch("chromium");
const sizes = [
  { tag: "1440x900", width: 1440, height: 900 },
  { tag: "1366x768", width: 1366, height: 768 },
  { tag: "1536x864", width: 1536, height: 864 },
  { tag: "1280x800", width: 1280, height: 800 },
  { tag: "1280x720", width: 1280, height: 720 },
  { tag: "1920x1080", width: 1920, height: 1080 },
];
for (const s of sizes) {
  const ctx = await newContext(browser, { width: s.width, height: s.height, tag: `ver-va03-${s.tag}` });
  const page = await ctx.newPage();
  for (let i = 0; i < 3; i++) { try { await loginAdmin(page); break; } catch (e) { console.log("login retry", i); } }
  out[s.tag] = {};
  for (const route of ["/admin/podesavanja?tab=firma", "/admin/korisnici", "/admin"]) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const nav = document.querySelector('aside nav[aria-label="Administracija"]');
      if (!nav) return { noNav: true };
      const sc = nav.querySelector(".overflow-y-auto");
      const sr = sc.getBoundingClientRect();
      const links = [...sc.querySelectorAll("a")];
      const hidden = links.filter((a) => a.getBoundingClientRect().top >= sr.bottom - 4 || a.getBoundingClientRect().bottom > sr.bottom + 1)
        .map((a) => (a.getAttribute("aria-label") || a.textContent).trim().replace(/\s+/g, " ").slice(0, 30));
      const active = sc.querySelector('[aria-current="page"]');
      const ab = active?.getBoundingClientRect();
      const cs = getComputedStyle(sc);
      return {
        scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight, scrollTop: sc.scrollTop,
        links: links.length, hidden,
        active: active ? { label: active.textContent.trim().slice(0, 30), top: Math.round(ab.top), bottom: Math.round(ab.bottom), visible: ab.bottom <= sr.bottom && ab.top >= sr.top } : null,
        mask: cs.maskImage || cs.webkitMaskImage, scrollbarWidth: cs.scrollbarWidth, scrollbarColor: cs.scrollbarColor,
        thumbGutter: sc.offsetWidth - sc.clientWidth,
      };
    });
    out[s.tag][route] = m;
    console.log(s.tag, route, JSON.stringify({ sh: m.scrollHeight, ch: m.clientHeight, hidden: m.hidden, active: m.active, mask: m.mask, gutter: m.thumbGutter, sbc: m.scrollbarColor }));
    if (route.startsWith("/admin/podesavanja") && ["1440x900", "1366x768", "1280x800"].includes(s.tag)) {
      await shot(page, `verify/vis-admin/vis-admin-03-reproduce-${s.tag}-podesavanja`, { clip: { x: 0, y: 0, width: s.width >= 1366 ? 520 : 400, height: s.height } });
    }
  }
  await ctx.close();
}
writeFileSync("docs/qa/audit/verify/vis-admin/vis-admin-03-reproduce.json", JSON.stringify(out, null, 2));
await browser.close();
