// MOT-07 root cause probe (home-hero-sections): does keyboard focus on a sticky-header link
// scroll the page in Chromium, and which CSS stops it? Prints the scroll shift per variant.
// Usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/home-hero-sections-focus-shift.mjs [route]
import { BASE, launch, newContext } from "../audit/kit.mjs";

// Pass the route without a leading slash (Git Bash rewrites "/x" into a Windows path).
const route = `/${(process.argv[2] ?? "delovi").replace(/^\/+/, "")}`;
const variants = {
  baseline: "",
  "html scroll-padding-top 0": "html{scroll-padding-top:0 !important}",
  "header * scroll-margin-top -80px": "header *{scroll-margin-top:-80px}",
};
const browser = await launch();
try {
  for (const [name, css] of Object.entries(variants)) {
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "hh-focus" });
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE}${route}`, { waitUntil: "load" });
      await page.waitForTimeout(1200);
      if (css) await page.addStyleTag({ content: css });
      await page.evaluate(() => window.scrollTo(0, 1500));
      await page.waitForTimeout(600);
      const shifts = await page.evaluate(async () => {
        const out = [];
        const links = [...document.querySelectorAll("header a, header button")].filter((e) => e.offsetParent).slice(0, 4);
        for (const el of links) {
          window.scrollTo(0, 1500);
          await new Promise((r) => setTimeout(r, 200));
          const before = window.scrollY;
          el.focus();
          await new Promise((r) => setTimeout(r, 300));
          out.push(`${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 18)}: ${before}→${window.scrollY}`);
        }
        return out;
      });
      console.log(name.padEnd(34), shifts.join(" | "));
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
