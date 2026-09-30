/** Step 21 audit (flows-import-mech): sturdier login for a loaded shared machine. */
import { readFileSync } from "node:fs";

import { BASE } from "./kit.mjs";

export const ACCOUNTS = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));

export async function login(page, email, password, next = "/nalog") {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${BASE}/prijava?next=${encodeURIComponent(next)}`, {
        waitUntil: "load",
        timeout: 90_000,
      });
      await page.getByTestId("auth-email").waitFor({ timeout: 60_000 });
      await page.waitForTimeout(1500);
      await page.getByTestId("auth-email").fill(email);
      await page.getByTestId("auth-password").fill(password);
      await page.getByTestId("auth-submit").click();
      await page.waitForURL((u) => u.pathname.startsWith(next), { timeout: 90_000 });
      return;
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
}

export const loginAdminSafe = (page) =>
  login(page, process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD, "/admin");
export const loginMechanic = (page, next = "/majstor") =>
  login(page, ACCOUNTS.mechanic.email, ACCOUNTS.mechanic.password, next);
