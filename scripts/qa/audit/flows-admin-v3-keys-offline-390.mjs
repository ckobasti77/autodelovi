// flows-admin v3: g-chord navigation, table arrow keys, offline note (Convex reconnect), 390 px admin screens.
import os from "node:os";
import path from "node:path";
import { launch, watch, shot, overflowX, axe, BASE } from "./kit.mjs";
import { save, sleep } from "./flows-admin-lib.mjs";
import { ownerCtx, go } from "./flows-admin-lib2.mjs";

const [ORDER] = process.argv.slice(2);
const browser = await launch();
const report = { ORDER, steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, at: new Date().toISOString(), ...data });
  console.log(name, JSON.stringify(data).slice(0, 800));
};
const txt = async (l) => ((await l.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
try {
  const ctx = await ownerCtx(browser, { tag: "fa3-keys" });
  const STATE = path.join(os.tmpdir(), `fa3-state-${Date.now()}.json`);
  await ctx.storageState({ path: STATE });
  // g chord
  const h = await go(ctx, "/admin", { wait: 3000 });
  await h.getByRole("heading", { level: 1 }).click();
  await h.keyboard.press("g");
  await sleep(150);
  await h.keyboard.press("p");
  await sleep(3000);
  step("g p (h1 clicked)", { url: h.url(), active: await h.evaluate(() => document.activeElement?.tagName) });
  await h.keyboard.press("g");
  await sleep(150);
  await h.keyboard.press("u");
  await sleep(3000);
  step("g u", { url: h.url() });
  // Table arrows on orders list
  const l = await go(ctx, "/admin/porudzbine?status=sve", { wait: 3000 });
  await l.getByRole("heading", { level: 1 }).click();
  await l.keyboard.press("ArrowDown");
  await sleep(200);
  await l.keyboard.press("ArrowDown");
  await sleep(300);
  step("arrows", {
    active: await l.evaluate(() => document.activeElement?.outerHTML.slice(0, 200)),
    selectedRows: await l.locator("tr[aria-selected=true], tr[data-active=true], tr[data-state=selected]").count(),
  });
  await shot(l, "flows-admin/v3-keys-01-orders-arrows");
  await l.keyboard.press("Enter");
  await sleep(2500);
  step("enter", { url: l.url() });
  // Offline note on a nova test order
  const od = await go(ctx, `/admin/porudzbine/${ORDER}`, { wait: 3000 });
  const lo = watch(od);
  const ta = od.getByLabel("Nova napomena");
  await ta.fill("Offline beleška (audit flows-admin).");
  await ctx.setOffline(true);
  await sleep(1000);
  await od.getByRole("button", { name: "Dodaj napomenu" }).click();
  await sleep(8000);
  step("offline after submit", {
    btnBusy: await od.getByRole("button", { name: "Dodaj napomenu" }).getAttribute("aria-busy").catch(() => null),
    btnDisabled: await od.getByRole("button", { name: "Dodaj napomenu" }).isDisabled().catch(() => null),
    textarea: await ta.inputValue(),
    toasts: await od.locator("[data-sonner-toast]").allTextContents(),
    alerts: await od.getByRole("alert").allTextContents(),
    offlineBanner: (await txt(od.locator("[role=status], [aria-live]").filter({ hasText: /veza|mrež|offline|internet/i }).first())).slice(0, 200),
  });
  await shot(od, "flows-admin/v3-offline-01-pending");
  // status transition offline
  const primary = od.getByRole("button", { name: "Potvrdi", exact: true }).first();
  if (await primary.isVisible().catch(() => false)) {
    await primary.click();
    const d = od.getByRole("alertdialog");
    await d.waitFor();
    await d.getByRole("button", { name: "Potvrdi" }).click();
    await sleep(6000);
    step("offline confirm", {
      dialogOpen: await d.isVisible().catch(() => false),
      dialogBusy: await d.getByRole("button", { name: "Potvrdi" }).getAttribute("aria-busy").catch(() => null),
      head: (await txt(od.locator("main").first())).slice(0, 120),
    });
    await shot(od, "flows-admin/v3-offline-02-confirm");
  }
  await ctx.setOffline(false);
  await sleep(10000);
  step("back online", {
    noteInHistory: (await txt(od.locator("main"))).includes("Offline beleška"),
    head: (await txt(od.locator("main").first())).slice(0, 120),
    dialogOpen: await od.getByRole("alertdialog").isVisible().catch(() => false),
    toasts: await od.locator("[data-sonner-toast]").allTextContents(),
  });
  await shot(od, "flows-admin/v3-offline-03-online");
  step("offline errors", lo);
  // 390 px
  const m = await browser.newContext({ storageState: STATE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "sr-Latn-RS", timezoneId: "Europe/Belgrade" });
  for (const route of ["/admin", "/admin/porudzbine", `/admin/porudzbine/${ORDER}`, "/admin/upiti/UP-2026-000054", "/admin/proizvodi/qh7cqja340240s4jq1fsawnc3s8fctej", "/admin/podesavanja"]) {
    const p = await go(m, route, { wait: 3500 });
    const slug = route.replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
    const ax = await axe(p).catch((e) => [String(e).slice(0, 100)]);
    step(`390 ${route}`, { url: p.url(), ov: await overflowX(p), ax: ax.map((a) => `${a.id}:${a.nodes}:${(a.targets || []).slice(0, 2).join("|")}`) });
    await shot(p, `flows-admin/v3-m390${slug}`);
    await p.close();
  }
} catch (e) {
  step("FAILED", { error: String(e).slice(0, 900) });
} finally {
  save("v3-keys-offline-390.json", report);
  await browser.close();
}
