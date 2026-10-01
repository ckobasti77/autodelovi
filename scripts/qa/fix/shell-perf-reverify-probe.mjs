// Re-verification probe (step 22, shell-perf): which script URLs load on page load vs on intent.
import { BASE, launch, newContext } from "../audit/kit.mjs";
const browser = await launch();
try {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "rvprobe" });
  const page = await ctx.newPage();
  const scripts = [];
  page.on("request", (r) => r.resourceType() === "script" && scripts.push(r.url()));
  await page.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
  const n = scripts.length;
  console.log("initial", n);
  console.log(scripts.filter((u) => /Panel|Consent|Dialog|Sheet|SearchBox/i.test(u)).join("\n"));
  await page.getByRole("button", { name: "Pretraga delova" }).first().hover();
  await page.waitForTimeout(1500);
  console.log("after hover search:\n" + scripts.slice(n).join("\n"));
  const m = scripts.length;
  await page.getByTestId("mobile-menu-trigger").hover();
  await page.waitForTimeout(1500);
  console.log("after hover menu:\n" + scripts.slice(m).join("\n"));
  await ctx.close();
} finally {
  await browser.close();
}
