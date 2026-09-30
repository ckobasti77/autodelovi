// a11y-app shared helpers: load-tolerant login that waits for hydration, focus describer.
import { readFileSync } from "node:fs";
import { BASE } from "./kit.mjs";

export const ACC = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));

export async function hydrated(page, selector) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps") || k.startsWith("__reactFiber"));
    },
    selector,
    { timeout: 180000 },
  );
}

export async function login(page, role) {
  const [email, password, next] =
    role === "admin"
      ? [process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD, "/admin"]
      : role === "customer"
        ? [ACC.customer.email, ACC.customer.password, "/nalog"]
        : [ACC.mechanic.email, ACC.mechanic.password, "/majstor"];
  await page.goto(`${BASE}/prijava?next=${encodeURIComponent(next)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByTestId("auth-email").waitFor({ timeout: 120000 });
  await page.waitForFunction(() => {
    const f = document.querySelector("[data-testid=auth-email]")?.closest("form");
    return !!f && Object.keys(f).some((k) => k.startsWith("__reactProps"));
  }, null, { timeout: 180000 });
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((u) => u.pathname.startsWith(next), { timeout: 180000 });
}

export async function go(page, route) {
  await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator("h1").first().waitFor({ timeout: 120000 }).catch(() => {});
  await page.waitForLoadState("load", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

/** Describes document.activeElement: tag, role, name, visible focus indicator. */
export async function focused(page) {
  return page.evaluate(() => {
    const e = document.activeElement;
    if (!e || e === document.body) return { tag: "body" };
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    const name = (e.getAttribute("aria-label") || e.getAttribute("title") || e.textContent || e.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 50);
    return {
      tag: e.tagName.toLowerCase(),
      role: e.getAttribute("role") || "",
      name,
      id: e.id || "",
      href: e.getAttribute("href") || "",
      outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} off ${cs.outlineOffset}`,
      shadow: cs.boxShadow === "none" ? "" : cs.boxShadow.slice(0, 60),
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      inViewport: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
    };
  });
}

export async function liveRegions(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("[aria-live],[role=status],[role=alert],[role=log]")].map((e) => ({
      tag: e.tagName.toLowerCase(),
      role: e.getAttribute("role") || "",
      live: e.getAttribute("aria-live") || "",
      text: e.textContent.trim().slice(0, 100),
    })),
  );
}
