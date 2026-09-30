// Independent verification of vis-admin-02 (admin list tables overflow at 1024-1440).
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, loginAdmin, shot } from "./kit.mjs";
const out = {};
const browser = await launch("chromium");
const sizes = [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "1366", width: 1366, height: 768 },
  { tag: "1280", width: 1280, height: 800 },
  { tag: "1024", width: 1024, height: 768 },
  { tag: "1920", width: 1920, height: 1080 },
];
const routes = [
  { key: "upiti", path: "/admin/upiti" },
  { key: "proizvodi", path: "/admin/proizvodi" },
  { key: "porudzbine-default", path: "/admin/porudzbine" },
  { key: "porudzbine-sve", path: "/admin/porudzbine?status=sve" },
  { key: "mejlovi", path: "/admin/mejlovi" },
];
async function measure(page) {
  return page.evaluate(() => {
    const table = document.querySelector("main table");
    if (!table) return { noTable: true };
    const wrap = table.parentElement;
    const wr = wrap.getBoundingClientRect();
    const ths = [...table.querySelectorAll("thead th")];
    const sticky = ths.filter((t) => getComputedStyle(t).position === "sticky" && getComputedStyle(t).right !== "auto");
    const stickyLeft = sticky.length ? Math.min(...sticky.map((t) => t.getBoundingClientRect().left)) : wr.right;
    const cols = ths.map((t) => {
      const b = t.getBoundingClientRect();
      const label = (t.textContent || t.getAttribute("aria-label") || "").trim().slice(0, 24) || "(blank)";
      const hidden = b.right > stickyLeft + 1 && !sticky.includes(t);
      return `${label} [${Math.round(b.left)}-${Math.round(b.right)}]${hidden ? " (CUT)" : ""}`;
    });
    // Edge hint element position
    const hint = [...wrap.parentElement.querySelectorAll(":scope > span[aria-hidden='true']")].map((s) => {
      const b = s.getBoundingClientRect();
      return [Math.round(b.left), Math.round(b.right)];
    });
    return {
      overflowPx: wrap.scrollWidth - wrap.clientWidth,
      wrapRight: Math.round(wr.right),
      stickyLeft: Math.round(stickyLeft),
      cols,
      hint,
      docOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}
for (const s of sizes) {
  const ctx = await newContext(browser, { width: s.width, height: s.height, tag: `ver-va02-${s.tag}` });
  const page = await ctx.newPage();
  for (let i = 0; i < 3; i++) { try { await loginAdmin(page); break; } catch (e) { console.log("login retry", i); } }
  out[s.tag] = {};
  for (const r of routes) {
    if (s.tag === "1920" && r.key === "porudzbine-default") continue;
    try {
      await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle" });
      await page.waitForSelector("main table tbody tr", { timeout: 20000 });
      if (r.tab) {
        await page.getByRole("tab", { name: r.tab }).first().click();
        await page.waitForTimeout(1500);
      }
      await page.waitForTimeout(1200);
      const m = await measure(page);
      out[s.tag][r.key] = m;
      console.log(s.tag, r.key, "over", m.overflowPx, "sticky@", m.stickyLeft, "hint", JSON.stringify(m.hint), "| CUT:", m.cols?.filter((c) => c.includes("CUT")).join("; "));
      if (["1440", "1280", "1024"].includes(s.tag) && m.overflowPx > 0) {
        const t = page.locator("main table").first();
        const box = await t.boundingBox();
        await shot(page, `verify/vis-admin/vis-admin-02-reproduce-${s.tag}-${r.key}`, { clip: { x: Math.max(0, s.width - 760), y: Math.max(0, box.y - 10), width: Math.min(760, s.width), height: Math.min(420, s.height - box.y + 10) } });
      }
    } catch (e) {
      out[s.tag][r.key] = { error: String(e).slice(0, 200) };
      console.log(s.tag, r.key, "ERR", String(e).slice(0, 150));
    }
  }
  await ctx.close();
}
writeFileSync("docs/qa/audit/verify/vis-admin/vis-admin-02-reproduce.json", JSON.stringify(out, null, 2));
await browser.close();
