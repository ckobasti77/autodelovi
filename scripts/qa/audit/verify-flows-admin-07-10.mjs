/**
 * Verifier (step 21): flows-admin-07 (reject / suspend without confirmation), flows-admin-08 (admin
 * offline state), flows-admin-09 (link-in-text-block on /admin/obavestenja), flows-admin-10
 * (mechanic decision errors only in a banner).
 *   node scripts/qa/audit/verify-flows-admin-07-10.mjs <section...>   sections: mech | notif | offline
 * Creates: two pending test mechanics (testing:createPendingMechanic; one ends rejected, one
 * approved → suspended → reactivated) and one test order (testing:createTestOrder) that gets a
 * note and „Potvrđena“. No demo or real data is touched.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { mbCheckDigit, pibCheckDigit } from "../../../lib/domain/identifiers.ts";
import { AUDIT_DIR, BASE, axe, convexRun, launch, newContext, shot, watch } from "./kit.mjs";

const OUT = "verify/flows-admin";
const sections = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = String(Date.now()).slice(-7);

async function ownerCtx(browser, { width = 1440, height = 900, tag = "vfa" } = {}) {
  const ctx = await newContext(browser, { width, height, tag, mobile: width < 1024 });
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
async function go(ctx, route, wait = 2500) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(120_000);
  await p.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await p.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 120_000 }).catch(() => {});
  await sleep(wait);
  return p;
}
function save(name, data) {
  const file = path.join(AUDIT_DIR, OUT, name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2));
}
function newPending(tag) {
  const pib8 = `3${String(Date.now()).slice(-7)}`;
  const mb7 = `6${String(Date.now()).slice(-6)}`;
  const pib = `${pib8}${pibCheckDigit(pib8)}`;
  const mb = `${mb7}${mbCheckDigit(mb7)}`;
  return { ...convexRun("testing:createPendingMechanic", { tag, pib, mb }), email: `majstor-admin-${tag}@primer.rs` };
}
const dialogCount = (p) => p.locator('[role="dialog"]:visible, [role="alertdialog"]:visible').count();

const browser = await launch();
try {
  // ─────────────────────────── flows-admin-07 + 10: mechanic decisions ───────────────────────────
  if (sections.includes("mech")) {
    const log = { stamp, steps: [] };
    const step = (name, data = {}) => {
      log.steps.push({ name, ...data });
      console.log(name, JSON.stringify(data).slice(0, 600));
    };
    try {
      const ctx = await ownerCtx(browser, { tag: "vfa-mech" });
      // M1: pending → empty reject (10) → negative limit (10) → reject with reason (07)
      const m1 = newPending(`vfa07a-${stamp}`);
      step("created M1", m1);
      const p = await go(ctx, `/admin/majstori/${m1.profileId}`, 3000);
      const w = watch(p);
      const rejectBtn = p.getByTestId("admin-mechanic-reject");
      const reasonBox = p.getByRole("textbox", { name: /Razlog odbijanja/ });

      // 10a: empty reason
      await rejectBtn.click();
      await sleep(3500);
      const alert = p.locator('section[aria-labelledby="ad-decision"] [role="alert"]');
      const geo = async () => ({
        alertBox: await alert.boundingBox().catch(() => null),
        rejectBox: await rejectBtn.boundingBox().catch(() => null),
        reasonBox: await reasonBox.boundingBox().catch(() => null),
      });
      step("10a empty reason → click reject", {
        dialogs: await dialogCount(p),
        alert: await alert.textContent().catch(() => null),
        ariaInvalidCount: await p.locator('[aria-invalid="true"]').count(),
        reasonAriaInvalid: await reasonBox.getAttribute("aria-invalid"),
        reasonDescribedBy: await reasonBox.getAttribute("aria-describedby"),
        reasonDescribedByText: await p.evaluate(() => {
          const t = [...document.querySelectorAll("textarea")].find((e) =>
            e.labels?.[0]?.textContent?.includes("Razlog odbijanja"),
          );
          return (t?.getAttribute("aria-describedby") ?? "")
            .split(" ")
            .map((id) => document.getElementById(id)?.textContent)
            .filter(Boolean);
        }),
        focused: await p.evaluate(() => document.activeElement?.outerHTML.slice(0, 120)),
        consoleErrors: w.console.slice(0, 3),
        probe: convexRun("testing:mechanicProfileProbe", { profileId: m1.profileId }),
        ...(await geo()),
      });
      await p.evaluate(() => window.scrollTo(0, 0));
      await sleep(300);
      await shot(p, `${OUT}/flows-admin-10-reproduce-empty-reason`);

      // 10b: credit on, limit -5, approve
      await p.getByRole("switch", { name: /Odloženo plaćanje/ }).click();
      await sleep(400);
      const limit = p.getByRole("textbox", { name: /^Limit/ });
      await limit.fill("-5");
      await p.getByTestId("admin-mechanic-approve").click();
      await sleep(2000);
      step("10b limit -5 → approve", {
        alert: await alert.textContent().catch(() => null),
        ariaInvalidCount: await p.locator('[aria-invalid="true"]').count(),
        limitAriaInvalid: await limit.getAttribute("aria-invalid"),
        alertBox: await alert.boundingBox().catch(() => null),
        limitBox: await limit.boundingBox().catch(() => null),
        probe: convexRun("testing:mechanicProfileProbe", { profileId: m1.profileId }),
      });
      await shot(p, `${OUT}/flows-admin-10-reproduce-negative-limit`);
      // reset the limit so it does not interfere
      await limit.fill("");
      await p.getByRole("switch", { name: /Odloženo plaćanje/ }).click();
      await sleep(300);

      // 07a: reject with a reason → is there a confirmation?
      await reasonBox.fill("Verifikacija QA: PIB ne odgovara (test).");
      await rejectBtn.click();
      const t0 = Date.now();
      let dlgSeen = 0;
      for (let i = 0; i < 10; i++) {
        dlgSeen = Math.max(dlgSeen, await dialogCount(p));
        await sleep(150);
      }
      await p.getByText("Vrati na čekanje").waitFor({ timeout: 30_000 }).catch(() => {});
      step("07a reject with reason", {
        dialogsSeenWithin1_5s: dlgSeen,
        msToRejectedUi: Date.now() - t0,
        badge: await p.locator("h1 + *").first().textContent().catch(() => null),
        probe: convexRun("testing:mechanicProfileProbe", { profileId: m1.profileId }),
        events: convexRun("testing:mechanicProbe", { email: m1.email })?.eventTypes,
      });
      await shot(p, `${OUT}/flows-admin-07-reproduce-rejected`);
      // Outbox: was the rejection e-mail queued / logged immediately?
      const mail = await go(ctx, `/admin/mejlovi`, 3000);
      const mailText = ((await mail.locator("main").textContent()) ?? "").replace(/\s+/g, " ");
      const idx = mailText.indexOf(m1.email);
      step("07a outbox", {
        emailRowFound: idx >= 0,
        around: idx >= 0 ? mailText.slice(Math.max(0, idx - 200), idx + 120) : mailText.slice(0, 400),
      });
      await shot(mail, `${OUT}/flows-admin-07-reproduce-outbox`);
      await mail.close();

      // 07b: M2 approved via UI (default tier) → suspend
      const m2 = newPending(`vfa07b-${stamp}`);
      step("created M2", m2);
      const q = await go(ctx, `/admin/majstori/${m2.profileId}`, 3000);
      await q.getByTestId("admin-mechanic-approve").click();
      await q.getByRole("button", { name: "Pauziraj nalog" }).waitFor({ timeout: 30_000 });
      await sleep(1500);
      step("M2 approved", { probe: convexRun("testing:mechanicProfileProbe", { profileId: m2.profileId }) });
      await q.getByRole("button", { name: "Pauziraj nalog" }).click();
      let dlg2 = 0;
      for (let i = 0; i < 10; i++) {
        dlg2 = Math.max(dlg2, await dialogCount(q));
        await sleep(150);
      }
      await q.getByRole("button", { name: "Aktiviraj ponovo" }).waitFor({ timeout: 30_000 }).catch(() => {});
      step("07b suspend at 1440", {
        dialogsSeenWithin1_5s: dlg2,
        probe: convexRun("testing:mechanicProfileProbe", { profileId: m2.profileId }),
        events: convexRun("testing:mechanicProbe", { email: m2.email })?.eventTypes,
      });
      await shot(q, `${OUT}/flows-admin-07-reproduce-suspended`);
      // restore
      await q.getByRole("button", { name: "Aktiviraj ponovo" }).click();
      await q.getByRole("button", { name: "Pauziraj nalog" }).waitFor({ timeout: 30_000 }).catch(() => {});
      step("M2 reactivated (restore)", { probe: convexRun("testing:mechanicProfileProbe", { profileId: m2.profileId }) });
      await ctx.close();

      // 07c variant: suspend at 390 px (same component, touch)
      const mctx = await ownerCtx(browser, { width: 390, height: 844, tag: "vfa-mech390" });
      const r = await go(mctx, `/admin/majstori/${m2.profileId}`, 3000);
      const sus = r.getByRole("button", { name: "Pauziraj nalog" });
      await sus.scrollIntoViewIfNeeded();
      await sus.click();
      let dlg3 = 0;
      for (let i = 0; i < 10; i++) {
        dlg3 = Math.max(dlg3, await dialogCount(r));
        await sleep(150);
      }
      await r.getByRole("button", { name: "Aktiviraj ponovo" }).waitFor({ timeout: 30_000 }).catch(() => {});
      step("07c suspend at 390", {
        dialogsSeenWithin1_5s: dlg3,
        probe: convexRun("testing:mechanicProfileProbe", { profileId: m2.profileId }),
      });
      await shot(r, `${OUT}/flows-admin-07-reproduce-suspended-390`);
      await r.getByRole("button", { name: "Aktiviraj ponovo" }).click();
      await r.getByRole("button", { name: "Pauziraj nalog" }).waitFor({ timeout: 30_000 }).catch(() => {});
      step("M2 reactivated again (restore)", {
        probe: convexRun("testing:mechanicProfileProbe", { profileId: m2.profileId }),
        events: convexRun("testing:mechanicProbe", { email: m2.email })?.eventTypes,
      });
      await mctx.close();
    } catch (e) {
      step("FAILED", { error: String(e).slice(0, 900) });
    } finally {
      save("flows-admin-07-10-reproduce.json", log);
    }
  }

  // ─────────────────────────── flows-admin-09: link in text block ───────────────────────────
  if (sections.includes("notif")) {
    const log = { steps: [] };
    const step = (name, data = {}) => {
      log.steps.push({ name, ...data });
      console.log(name, JSON.stringify(data).slice(0, 600));
    };
    try {
      for (const vp of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
      ]) {
        const ctx = await ownerCtx(browser, { ...vp, tag: `vfa-notif${vp.width}` });
        const routes =
          vp.width === 1440
            ? ["/admin/obavestenja", "/admin/porudzbine/SK-2026-000142", "/admin/upiti/UP-2026-000054"]
            : ["/admin/obavestenja"];
        for (const route of routes) {
          const p = await go(ctx, route, 3500);
          const ax = await axe(p);
          const lit = ax.find((a) => a.id === "link-in-text-block");
          const style = await p.evaluate(() => {
            const a = document.querySelector('main a[href*="podesavanja"]');
            if (!a) return null;
            const cs = getComputedStyle(a);
            const pcs = getComputedStyle(a.parentElement);
            return {
              text: a.textContent,
              decoration: cs.textDecorationLine,
              color: cs.color,
              parentColor: pcs.color,
              fontWeight: cs.fontWeight,
              parentWeight: pcs.fontWeight,
            };
          });
          step(`${vp.width} ${route}`, { linkInTextBlock: lit ?? null, allViolations: ax.map((a) => `${a.id}:${a.nodes}`), style });
          if (route === "/admin/obavestenja") {
            const box = await p.locator("main h1").first().boundingBox();
            const clip = box
              ? { x: 0, y: Math.max(0, box.y - 20), width: vp.width, height: Math.min(260, vp.height) }
              : undefined;
            await shot(p, `${OUT}/flows-admin-09-reproduce-${vp.width}`, clip ? { clip } : {});
            // hover state
            await p.locator('main a[href*="podesavanja"]').hover();
            await sleep(300);
            step(`${vp.width} hover`, {
              decoration: await p.evaluate(
                () => getComputedStyle(document.querySelector('main a[href*="podesavanja"]')).textDecorationLine,
              ),
            });
          }
          await p.close();
        }
        await ctx.close();
      }
    } catch (e) {
      step("FAILED", { error: String(e).slice(0, 900) });
    } finally {
      save("flows-admin-09-reproduce.json", log);
    }
  }

  // ─────────────────────────── flows-admin-08: offline ───────────────────────────
  if (sections.includes("offline")) {
    const log = { steps: [] };
    const step = (name, data = {}) => {
      log.steps.push({ name, at: new Date().toISOString(), ...data });
      console.log(name, JSON.stringify(data).slice(0, 700));
    };
    const txt = async (l) => ((await l.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
    const connText = (p) =>
      p.evaluate(() => {
        const re = /(nema veze|veza je|veza sa|offline|bez interneta|pokušavamo ponovo|čeka vezu|mreža)/i;
        return [...document.querySelectorAll("body *")]
          .filter((e) => e.children.length === 0 && re.test(e.textContent ?? "") && e.getClientRects().length)
          .map((e) => e.textContent.trim().slice(0, 120))
          .slice(0, 5);
      });
    try {
      const { number } = convexRun("testing:createTestOrder", { tag: `vfa08-${stamp}` });
      step("created order", { number, probe: convexRun("testing:orderProbe", { number }) });
      const ctx = await ownerCtx(browser, { tag: "vfa-off" });
      const p = await go(ctx, `/admin/porudzbine/${number}`, 3500);
      const w = watch(p);
      const note = `Offline beleška verifikacija ${stamp}`;
      await p.getByLabel("Nova napomena").fill(note);
      await ctx.setOffline(true);
      await sleep(1500);
      step("offline, before any write", { connectionText: await connText(p) });
      await p.getByRole("button", { name: "Dodaj napomenu" }).click();
      await sleep(6000);
      step("offline 6 s after 'Dodaj napomenu'", {
        btnBusy: await p.getByRole("button", { name: "Dodaj napomenu" }).getAttribute("aria-busy").catch(() => null),
        connectionText: await connText(p),
        statusRegions: (await p.locator('[role="status"], [role="alert"], [aria-live]').allTextContents())
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 6),
        serverNoteSaved: (convexRun("testing:orderProbe", { number })?.eventTypes ?? []).join(","),
      });
      await shot(p, `${OUT}/flows-admin-08-reproduce-01-note-pending`);
      await p.getByRole("button", { name: "Potvrdi", exact: true }).first().click();
      const d = p.getByRole("alertdialog");
      await d.waitFor({ timeout: 10_000 });
      await d.getByRole("button", { name: "Potvrdi" }).click();
      await sleep(6000);
      const cancel = d.getByRole("button", { name: "Odustani" });
      step("offline 6 s after dialog 'Potvrdi'", {
        dialogOpen: await d.isVisible().catch(() => false),
        confirmBusy: await d.getByRole("button", { name: "Potvrdi" }).getAttribute("aria-busy").catch(() => null),
        cancelDisabled: await cancel.isDisabled().catch(() => null),
        connectionText: await connText(p),
        serverStatus: convexRun("testing:orderProbe", { number })?.status,
      });
      await shot(p, `${OUT}/flows-admin-08-reproduce-02-dialog-locked`);
      await p.keyboard.press("Escape");
      await sleep(800);
      step("offline: Escape pressed", { dialogOpen: await d.isVisible().catch(() => false) });
      await ctx.setOffline(false);
      await sleep(12000);
      const main = await txt(p.locator("main"));
      step("back online 12 s", {
        noteInHistory: main.includes(note),
        head: main.slice(0, 140),
        dialogOpen: await d.isVisible().catch(() => false),
        serverStatus: convexRun("testing:orderProbe", { number })?.status,
        toasts: (await p.locator('[role="status"]').allTextContents()).map((s) => s.trim()).filter(Boolean).slice(0, 5),
      });
      await shot(p, `${OUT}/flows-admin-08-reproduce-03-online`);
      step("errors", w);
      // Variant: admin dashboard offline for 8 s — any indicator at all?
      const dash = await go(ctx, "/admin", 3000);
      await ctx.setOffline(true);
      await sleep(8000);
      step("dashboard offline 8 s", { connectionText: await connText(dash) });
      await shot(dash, `${OUT}/flows-admin-08-reproduce-04-dashboard-offline`);
      await ctx.setOffline(false);
      await ctx.close();
      // Reference: the storefront shows its offline banner
      const sctx = await newContext(browser, { width: 1440, height: 900, tag: "vfa-shopoff" });
      const s = await sctx.newPage();
      await s.goto(`${BASE}/delovi`, { waitUntil: "domcontentloaded", timeout: 180_000 });
      await sleep(3000);
      await sctx.setOffline(true);
      await sleep(2500);
      step("shop /delovi offline 2.5 s", { connectionText: await connText(s) });
      await shot(s, `${OUT}/flows-admin-08-reproduce-05-shop-offline`);
      await sctx.close();
    } catch (e) {
      step("FAILED", { error: String(e).slice(0, 900) });
    } finally {
      save("flows-admin-08-reproduce.json", log);
    }
  }
} finally {
  await browser.close();
}
