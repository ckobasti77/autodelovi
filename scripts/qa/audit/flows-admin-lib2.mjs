// flows-admin: robust owner login (domcontentloaded instead of networkidle; the shared server is busy).
import { BASE, newContext } from "./kit.mjs";
export async function ownerCtx(browser, { width = 1440, height = 900, tag = "fa2" } = {}) {
  const ctx = await newContext(browser, { width, height, tag, mobile: false });
  const p = await ctx.newPage();
  p.setDefaultTimeout(120_000);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await p.goto(`${BASE}/prijava?next=%2Fadmin`, { waitUntil: "domcontentloaded", timeout: 180_000 });
      await p.getByTestId("auth-email").fill(process.env.SEED_ADMIN_EMAIL);
      await p.getByTestId("auth-password").fill(process.env.SEED_ADMIN_PASSWORD);
      await p.getByTestId("auth-submit").click();
      await p.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 120_000 });
      break;
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
  await p.close();
  return ctx;
}
export async function go(ctx, route, { wait = 2500 } = {}) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(120_000);
  await p.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await p.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 120_000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, wait));
  return p;
}
