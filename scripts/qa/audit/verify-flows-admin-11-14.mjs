// Independent verification of flows-admin-11..14 (step 21 QA audit).
// Evidence: docs/qa/audit/verify/flows-admin/<key>-reproduce.*
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot, convexRun } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/flows-admin";
mkdirSync(OUT, { recursive: true });
const only = process.argv[2] ?? "all";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = {};
const log = (key, name, data = {}) => {
  (report[key] ??= []).push({ name, at: new Date().toISOString(), ...data });
  console.log(key, name, JSON.stringify(data).slice(0, 600));
};
const active = (p) =>
  p.evaluate(() => {
    const a = document.activeElement;
    return a ? `${a.tagName} ${(a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 50)}` : null;
  });

async function owner(browser, tag, width = 1440, height = 900) {
  const ctx = await newContext(browser, { width, height, tag, mobile: width < 1024 });
  const p = await ctx.newPage();
  p.setDefaultTimeout(120_000);
  for (let i = 0; i < 3; i++) {
    try {
      await p.goto(`${BASE}/prijava?next=%2Fadmin`, { waitUntil: "domcontentloaded", timeout: 180_000 });
      await p.getByTestId("auth-email").fill(process.env.SEED_ADMIN_EMAIL);
      await p.getByTestId("auth-password").fill(process.env.SEED_ADMIN_PASSWORD);
      await p.getByTestId("auth-submit").click();
      await p.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 120_000 });
      break;
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  return { ctx, p };
}
async function open(ctx, route, wait = 3000) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(120_000);
  const w = watch(p);
  await p.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await p.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 120_000 }).catch(() => {});
  await sleep(wait);
  return { p, w };
}

const browser = await launch();
try {
  const { ctx, p: home } = await owner(browser, "vfa");
  await sleep(4000);

  // ---------------- flows-admin-12: bell label capped at 100 ----------------
  if (only === "all" || only === "12") {
    const K = "flows-admin-12";
    try {
      const bell = home.getByTestId("admin-notification-bell");
      await bell.waitFor();
      const before = {
        label: await bell.getAttribute("aria-label"),
        badge: (await bell.textContent())?.trim(),
      };
      log(K, "before", before);
      const { number } = convexRun("testing:createTestOrder", { tag: `vfa12-${Date.now()}` });
      log(K, "created order", { number });
      await sleep(7000);
      const after = {
        label: await bell.getAttribute("aria-label"),
        badge: (await bell.textContent())?.trim(),
      };
      log(K, "after", after);
      await bell.click();
      await sleep(1500);
      const top = await home.locator("[data-radix-popper-content-wrapper] li").first().textContent().catch(() => "");
      log(K, "panel first row", { top: top?.replace(/\s+/g, " ").trim().slice(0, 140) });
      await shot(home, `verify/flows-admin/${K}-reproduce`, { clip: { x: 900, y: 0, width: 540, height: 620 } });
      await home.keyboard.press("Escape");
      report.orderFor11 = number;
    } catch (e) {
      log(K, "FAILED", { error: String(e).slice(0, 500) });
    }
  }

  // ---------------- flows-admin-11: ConvexError console noise ----------------
  if (only === "all" || only === "11") {
    const K = "flows-admin-11";
    try {
      const number =
        report.orderFor11 ?? convexRun("testing:createTestOrder", { tag: `vfa11-${Date.now()}` }).number;
      log(K, "order", { number });
      const A = await open(ctx, `/admin/porudzbine/${number}`);
      const B = await open(ctx, `/admin/porudzbine/${number}`);
      await B.p.getByRole("button", { name: "Potvrdi", exact: true }).first().click();
      await B.p.getByRole("alertdialog").waitFor();
      await A.p.getByRole("button", { name: "Potvrdi", exact: true }).first().click();
      await A.p.getByRole("alertdialog").getByRole("button", { name: "Potvrdi" }).click();
      await sleep(4000);
      const bStill = await B.p.getByRole("alertdialog").isVisible().catch(() => false);
      log(K, "B dialog still open after A confirmed", { bStill });
      await B.p.getByRole("alertdialog").getByRole("button", { name: "Potvrdi" }).click().catch(() => {});
      await sleep(3000);
      log(K, "B after confirm", {
        alerts: await B.p.getByRole("alert").allTextContents(),
        toasts: await B.p.locator("[data-sonner-toast]").allTextContents(),
        console: B.w.console,
        pageErrors: B.w.pageErrors,
      });
      await shot(B.p, `verify/flows-admin/${K}-reproduce-order`);
      log(K, "A console", { console: A.w.console });
      await A.p.close();
      await B.p.close();

      // Mechanic reject with empty reason
      const tag = `vfa11-${Date.now().toString().slice(-6)}`;
      const m = convexRun("testing:createPendingMechanic", { tag, pib: "101134702", mb: "07012345" });
      log(K, "pending mechanic", m);
      const M = await open(ctx, `/admin/majstori/${m.profileId}`);
      await M.p.getByTestId("admin-mechanic-reject").click();
      await sleep(3500);
      log(K, "mechanic reject empty", {
        alerts: await M.p.getByRole("alert").allTextContents(),
        toasts: await M.p.locator("[data-sonner-toast]").allTextContents(),
        console: M.w.console,
      });
      await shot(M.p, `verify/flows-admin/${K}-reproduce-mechanic`);
      await M.p.close();

      // Variant: storefront sign-in with a wrong password (Convex Auth action) in a fresh context.
      const g = await newContext(browser, { tag: "vfa11-signin" });
      const gp = await g.newPage();
      const gw = watch(gp);
      await gp.goto(`${BASE}/prijava`, { waitUntil: "domcontentloaded", timeout: 180_000 });
      await sleep(3000);
      await gp.getByTestId("auth-email").fill(`verify-fa11-${Date.now()}@primer.rs`);
      await gp.getByTestId("auth-password").fill("PogresnaLozinka123");
      await gp.getByTestId("auth-submit").click();
      await sleep(6000);
      log(K, "storefront wrong sign-in", {
        alerts: await gp.getByRole("alert").allTextContents(),
        console: gw.console,
        url: gp.url(),
      });
      await g.close();
    } catch (e) {
      log(K, "FAILED", { error: String(e).slice(0, 500) });
    }
  }

  // ---------------- flows-admin-13: product editor focus on failed save ----------------
  if (only === "all" || only === "13") {
    const K = "flows-admin-13";
    try {
      // (a) mouse click
      const P = await open(ctx, "/admin/proizvodi/novi", 4000);
      const btn = P.p.getByRole("button", { name: "Sačuvaj artikal" });
      const btnBox = await btn.boundingBox();
      await btn.click();
      await sleep(1500);
      const state = await P.p.evaluate(() => {
        const alert = document.querySelector('main [role="alert"]') || document.querySelector('[role="alert"]');
        const r = alert?.getBoundingClientRect();
        return {
          invalid: document.querySelectorAll('[aria-invalid="true"]').length,
          summaryText: alert?.textContent?.trim().slice(0, 200),
          summaryTabIndex: alert?.getAttribute("tabindex"),
          summaryInViewport: r ? r.top >= 0 && r.bottom <= innerHeight : null,
          summaryTop: r?.top,
          scrollY: scrollY,
        };
      });
      log(K, "click save", { btnBox, focus: await active(P.p), ...state });
      await shot(P.p, `verify/flows-admin/${K}-reproduce-click`);
      await P.p.close();

      // (b) keyboard: focus the save button and press Enter
      const Q = await open(ctx, "/admin/proizvodi/novi", 4000);
      await Q.p.getByRole("button", { name: "Sačuvaj artikal" }).focus();
      await Q.p.keyboard.press("Enter");
      await sleep(1500);
      log(K, "keyboard Enter on save", {
        focus: await active(Q.p),
        invalid: await Q.p.locator('[aria-invalid="true"]').count(),
      });
      // Tab once from there: where does focus go?
      await Q.p.keyboard.press("Tab");
      log(K, "next Tab", { focus: await active(Q.p) });
      // (c) Ctrl+S from the name field
      await Q.p.goto(BASE + "/admin/proizvodi/novi", { waitUntil: "domcontentloaded" });
      await sleep(4000);
      await Q.p.getByLabel(/^Naziv/).first().click();
      await Q.p.keyboard.press("Control+s");
      await sleep(1500);
      log(K, "ctrl+s", {
        focus: await active(Q.p),
        invalid: await Q.p.locator('[aria-invalid="true"]').count(),
      });
      await Q.p.close();
    } catch (e) {
      log(K, "FAILED", { error: String(e).slice(0, 500) });
    }
  }

  // ---------------- flows-admin-14: convert dialog native validation ----------------
  if (only === "all" || only === "14") {
    const K = "flows-admin-14";
    try {
      const I = await open(ctx, "/admin/upiti/UP-2026-000003", 4000);
      await I.p.getByRole("button", { name: "Pretvori u porudžbinu" }).click();
      const d = I.p.getByRole("dialog");
      await d.waitFor();
      await sleep(800);
      const fields = await d.evaluate((el) =>
        [...el.querySelectorAll("input")].map((i) => ({
          label: i.labels?.[0]?.textContent?.trim(),
          value: i.value,
          required: i.required,
          type: i.type,
        })),
      );
      log(K, "dialog fields (initial)", { fields });
      // Clear e-mail (and keep other fields as they are) so the submit is blocked by validation.
      const email = d.getByLabel(/E-pošta/);
      await email.fill("");
      const valid = await d.locator("form").evaluate((f) => f.checkValidity());
      log(K, "form validity after clearing e-mail", { valid });
      if (valid) throw new Error("form valid - refusing to submit (would create an order)");
      await d.getByRole("button", { name: "Kreiraj porudžbinu" }).click();
      await sleep(800);
      const after = await d.evaluate((el) => {
        const inv = [...el.querySelectorAll("input")].filter((i) => !i.checkValidity());
        return {
          focus: document.activeElement?.tagName + " " + (document.activeElement?.labels?.[0]?.textContent ?? ""),
          nativeMessages: inv.map((i) => `${i.labels?.[0]?.textContent?.trim()}: ${i.validationMessage}`),
          ariaInvalid: el.querySelectorAll('[aria-invalid="true"]').length,
          inlineErrors: [...el.querySelectorAll('[data-invalid], [role="alert"]')].map((e) => e.textContent?.trim()),
          novalidate: el.querySelector("form")?.noValidate,
        };
      });
      log(K, "after submit", { ...after, dialogOpen: await d.isVisible(), url: I.p.url() });
      await shot(I.p, `verify/flows-admin/${K}-reproduce`);
      // Variant: wrong-format e-mail
      await email.fill("nije-adresa");
      await d.getByRole("button", { name: "Kreiraj porudžbinu" }).click();
      await sleep(600);
      log(K, "bad format e-mail", {
        msg: await email.evaluate((i) => i.validationMessage),
        ariaInvalid: await email.getAttribute("aria-invalid"),
      });
      await d.getByRole("button", { name: "Odustani" }).click();
      log(K, "probe after (unchanged)", convexRun("testing:adminProbe", { inquiryNumber: "UP-2026-000003" }));
      await I.p.close();
    } catch (e) {
      log(K, "FAILED", { error: String(e).slice(0, 500) });
    }
  }
} finally {
  writeFileSync(`${OUT}/verify-11-14-${only}.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
