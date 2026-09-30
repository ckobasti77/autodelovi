// flows-admin-13 variant: save after scrolling to the bottom of the product editor (1440 and 390).
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch();
const out = [];
try {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const ctx = await newContext(browser, { width: w, height: h, tag: `vfa13b-${w}`, mobile: w < 1024 });
    const p = await ctx.newPage();
    p.setDefaultTimeout(120_000);
    await p.goto(`${BASE}/prijava?next=%2Fadmin%2Fproizvodi%2Fnovi`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await p.getByTestId("auth-email").fill(process.env.SEED_ADMIN_EMAIL);
    await p.getByTestId("auth-password").fill(process.env.SEED_ADMIN_PASSWORD);
    await p.getByTestId("auth-submit").click();
    await p.waitForURL((u) => u.pathname.startsWith("/admin/proizvodi/novi"), { timeout: 120_000 });
    await sleep(5000);
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(800);
    await p.getByRole("button", { name: "Sačuvaj artikal" }).click();
    await sleep(1500);
    const s = await p.evaluate(() => {
      const alert = [...document.querySelectorAll('[role="alert"]')].find((a) => a.textContent.includes("Upišite"));
      const r = alert?.getBoundingClientRect();
      const a = document.activeElement;
      return {
        focus: `${a?.tagName} ${(a?.textContent || "").trim().slice(0, 40)}`,
        scrollY,
        summaryTop: r?.top,
        summaryInViewport: r ? r.bottom > 0 && r.top < innerHeight : null,
        firstInvalidInViewport: (() => {
          const f = document.querySelector('[aria-invalid="true"]');
          const b = f?.getBoundingClientRect();
          return b ? b.bottom > 0 && b.top < innerHeight : null;
        })(),
      };
    });
    out.push({ width: w, ...s });
    console.log(w, JSON.stringify(s));
    await shot(p, `verify/flows-admin/flows-admin-13-reproduce-scrolled-${w}`);
    await ctx.close();
  }
} finally {
  writeFileSync("docs/qa/audit/verify/flows-admin/flows-admin-13-reproduce-scrolled.json", JSON.stringify(out, null, 2));
  await browser.close();
}
