// flows-admin: bell realtime, palette + shortcuts, audit log, e-mail outbox, searches, sources + CSV,
// privacy (inspect), users/invites (view), print docs + bulk print, offline mutation, 390 px admin.
// Usage: node flows-admin-misc.mjs <orderNumber>
import { launch, watch, shot, convexRun, overflowX, axe, BASE } from "./kit.mjs";
import { save, sleep } from "./flows-admin-lib.mjs";
import { ownerCtx, go } from "./flows-admin-lib2.mjs";

const [ORDER] = process.argv.slice(2);
const browser = await launch();
const report = { ORDER, steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, at: new Date().toISOString(), ...data });
  console.log(name, JSON.stringify(data).slice(0, 700));
};
const txt = async (l) => ((await l.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();

try {
  const ctx = await ownerCtx(browser, { tag: "fa-misc" });
  // ---- bell realtime
  const home = await go(ctx, "/admin");
  const log = watch(home);
  const bell = home.getByRole("button", { name: /^Obaveštenja/ });
  const before = await bell.getAttribute("aria-label");
  const { number } = convexRun("testing:createTestOrder", { tag: "fa2bell" });
  let after = before;
  for (let i = 0; i < 20 && after === before; i++) {
    await sleep(1000);
    after = await bell.getAttribute("aria-label");
  }
  step("bell realtime", { before, after, newOrder: number });
  await bell.click();
  await sleep(1200);
  await shot(home, "flows-admin/misc-01-bell-open");
  step("bell panel", { text: (await txt(home.getByRole("dialog").or(home.locator("[role=menu]")).first())).slice(0, 500) });
  await home.keyboard.press("Escape");
  // ---- palette + shortcuts
  await home.keyboard.press("Control+k");
  await sleep(800);
  const pal = home.getByLabel("Pretraga: broj porudžbine, OEM, šifra, telefon, e-mail");
  await pal.fill("5Q0615505R");
  await sleep(2500);
  step("palette results", { text: (await txt(home.getByLabel("Rezultati"))).slice(0, 400) });
  await shot(home, "flows-admin/misc-02-palette");
  await pal.fill("zzzqqq-nema");
  await sleep(2000);
  step("palette empty", { text: (await txt(home.getByLabel("Rezultati"))).slice(0, 200) });
  await home.keyboard.press("Escape");
  await sleep(400);
  await home.keyboard.press("Shift+/");
  await sleep(800);
  step("shortcuts dialog", { open: await home.getByRole("dialog").isVisible().catch(() => false) });
  await home.keyboard.press("Escape");
  await home.keyboard.press("g");
  await home.keyboard.press("p");
  await sleep(2500);
  step("g p", { url: home.url() });

  // ---- orders list keyboard
  const list = await go(ctx, "/admin/porudzbine?status=sve");
  await list.keyboard.press("ArrowDown");
  await list.keyboard.press("ArrowDown");
  const focused = await list.evaluate(() => document.activeElement?.outerHTML.slice(0, 160));
  step("orders list arrow", { focused });
  const pager = await list.getByRole("button", { name: /Učitaj još|Prikaži još|Sledeća/ }).count();
  step("orders pagination", { pager, footer: (await txt(list.locator("main"))).match(/Prikazano[^.]*/)?.[0] ?? null });
  await list.close();

  // ---- audit log, outbox, searches, sources, privacy, users
  for (const [route, name] of [
    ["/admin/revizija", "revizija"],
    ["/admin/mejlovi", "mejlovi"],
    ["/admin/pretrage", "pretrage"],
    ["/admin/izvori", "izvori"],
    ["/admin/privatnost", "privatnost"],
    ["/admin/korisnici", "korisnici"],
    ["/admin/obavestenja", "obavestenja"],
    ["/admin/lager", "lager"],
  ]) {
    const p = await go(ctx, route, { wait: 3500 });
    const l = watch(p);
    const main = await txt(p.locator("main"));
    step(`page ${name}`, { url: p.url(), text: main.slice(0, 600), ax: await axe(p).catch((e) => String(e).slice(0, 100)) });
    await shot(p, `flows-admin/misc-page-${name}`);
    if (name === "izvori") {
      const csv = p.getByRole("link", { name: /CSV|Preuzmi/ });
      step("sources csv links", { n: await csv.count(), hrefs: await csv.evaluateAll((as) => as.map((a) => a.getAttribute("href"))) });
      const href = (await csv.first().getAttribute("href").catch(() => null)) ?? "/admin/izvoz/offline-konverzije.csv?dana=90";
      const res = await p.request.get(new URL(href, BASE).toString());
      const body = await res.text();
      step("csv download", { status: res.status(), type: res.headers()["content-type"], disp: res.headers()["content-disposition"], head: body.slice(0, 300) });
    }
    if (name === "korisnici") {
      step("users buttons", { btns: await p.locator("main button").allTextContents() });
    }
    step(`errors ${name}`, l);
    await p.close();
  }

  // ---- print docs
  for (const doc of ["predracun", "otpremnica"]) {
    const p = await go(ctx, `/admin/porudzbine/${ORDER}/${doc}`, { wait: 3000 });
    const l = watch(p);
    step(`print ${doc}`, { url: p.url(), text: (await txt(p.locator("body"))).slice(0, 500) });
    await shot(p, `flows-admin/misc-print-${doc}`, { fullPage: true });
    await p.emulateMedia({ media: "print" });
    await shot(p, `flows-admin/misc-print-${doc}-media`, { fullPage: true });
    step(`print ${doc} errors`, l);
    await p.close();
  }
  const bulk = await go(ctx, `/admin/stampa/otpremnice`, { wait: 3000 });
  step("bulk print no params", { url: bulk.url(), text: (await txt(bulk.locator("body"))).slice(0, 400) });
  await shot(bulk, "flows-admin/misc-print-bulk-empty");
  await bulk.close();

  // ---- offline mutation
  const od = await go(ctx, `/admin/porudzbine/${number}`, { wait: 3000 });
  const lo = watch(od);
  await ctx.setOffline(true);
  await sleep(1500);
  const noteBtn = od.getByRole("button", { name: "Dodaj napomenu" });
  if (await noteBtn.isVisible().catch(() => false)) {
    await noteBtn.click();
    await sleep(500);
    const ta = od.locator("textarea").last();
    await ta.fill("Offline test beleška (audit).");
    const submit = od.getByRole("button", { name: /Sačuvaj|Dodaj/ }).last();
    await submit.click().catch(() => {});
  }
  await sleep(8000);
  step("offline after submit", { toasts: await od.locator("[data-sonner-toast]").allTextContents(), alerts: await od.getByRole("alert").allTextContents(), busy: await od.locator("[aria-busy=true], [data-loading]").count(), banner: (await txt(od.locator("body"))).match(/(veza|mreža|offline|internet)[^.]{0,80}/i)?.[0] ?? null });
  await shot(od, "flows-admin/misc-offline");
  await ctx.setOffline(false);
  await sleep(8000);
  step("back online", { toasts: await od.locator("[data-sonner-toast]").allTextContents(), noteInHistory: (await txt(od.locator("main"))).includes("Offline test beleška") });
  step("offline errors", lo);
  await od.close();

  // ---- 390 px admin
  const ctxM = await ownerCtx(browser, { tag: "fa-m", width: 390, height: 844 });
  for (const route of ["/admin", "/admin/porudzbine", `/admin/porudzbine/${ORDER}`, "/admin/proizvodi", "/admin/upiti"]) {
    const p = await go(ctxM, route, { wait: 3500 });
    const ov = await overflowX(p);
    const slug = route.replace(/[^a-z0-9]+/gi, "_");
    step(`390 ${route}`, { ov });
    await shot(p, `flows-admin/m390${slug}`);
    await p.close();
  }
  step("errors home", log);
} catch (e) {
  step("FAILED", { error: String(e).slice(0, 800) });
} finally {
  save(`misc.json`, report);
  await browser.close();
}
