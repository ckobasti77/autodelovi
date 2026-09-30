// motion-3d (second reviewer): DOM geometry behind the framing numbers — stage box, poster <img>
// contain box, and the caption block — per width (poster state, no 3D needed). Combined with
// framing.json (car bbox from pixels) it splits the empty band into "stage above the poster" and
// "inside the poster above the car", and gives the clear gap between caption and car.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext } from "./kit.mjs";

const SIZES = [
  [360, 780],
  [390, 844],
  [412, 915],
  [430, 932],
  [768, 1024],
  [1440, 900],
];
const browser = await launch();
const rows = [];
for (const [w, h] of SIZES) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `m3d-fdom-${w}` });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(1500);
  // Scroll so the stage is pinned at the top like the pixel measurement (mobile: track top).
  if (w < 1024) {
    await page.evaluate(() => {
      const t = document.querySelector('[data-testid="hero-track"]');
      window.scrollTo(0, Math.round(t.getBoundingClientRect().top + scrollY - 56));
    });
    await page.waitForTimeout(1200);
  }
  const g = await page.evaluate(() => {
    const track = document.querySelector('[data-testid="hero-track"]');
    const media = track.querySelector('[role="img"]').getBoundingClientRect();
    const img = track.querySelector("picture img");
    const ir = img?.getBoundingClientRect();
    const natural = img ? { w: img.naturalWidth, h: img.naturalHeight, src: (img.currentSrc || "").split("/").pop() } : null;
    // Contain box of the poster inside the img element (object-fit: contain, position bottom).
    let contain = null;
    if (img && natural?.w) {
      const s = Math.min(ir.width / natural.w, ir.height / natural.h);
      const cw = natural.w * s;
      const chh = natural.h * s;
      contain = { w: Math.round(cw), h: Math.round(chh), top: Math.round(ir.bottom - chh - media.top) };
    }
    const caps = [...track.querySelectorAll("[data-caption-line], .rt, [class*='type-display-m']")]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.bottom > media.top && r.top < media.bottom);
    const capBottom = caps.length ? Math.round(Math.max(...caps.map((r) => r.bottom)) - media.top) : null;
    return {
      stage: { w: Math.round(media.width), h: Math.round(media.height), top: Math.round(media.top) },
      poster: natural,
      contain,
      captionBottomInStage: capBottom,
    };
  });
  rows.push({ w, ...g });
  console.log(w, JSON.stringify(g));
  await ctx.close();
}
writeFileSync("docs/qa/audit/motion-3d/v2-framing-dom.json", JSON.stringify(rows, null, 2));
await browser.close();
