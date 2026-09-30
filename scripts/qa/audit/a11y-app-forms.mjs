// a11y-app (second pass): form error handling, labels, grouping and live feedback on auth,
// mechanic registration, mechanic portal (quick order, price list) and customer account.
// Never submits a real registration or order: only empty/invalid submits and a paste preview.
// Usage: node scripts/qa/audit/a11y-app-forms.mjs [section ...]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { BASE, launch, newContext, shot, axe } from "./kit.mjs";
import { login, focused, hydrated } from "./a11y-app-lib.mjs";

const DIR = "docs/qa/audit/a11y-app";
const OUT = `${DIR}/forms.json`;
const R = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const want = process.argv.slice(2);
const save = () => writeFileSync(OUT, JSON.stringify(R, null, 2));
const browser = await launch();

async function page(role, width = 390) {
  const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: `a11y-app-forms-${role}` });
  const f = `${DIR}/state/${role}.json`;
  if (role !== "anon" && existsSync(f)) await ctx.addCookies(JSON.parse(readFileSync(f, "utf8")).cookies);
  const p = await ctx.newPage();
  p._role = role;
  return { ctx, p };
}
async function open(p, route) {
  await p.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180000 });
  if (p._role !== "anon" && new URL(p.url()).pathname.startsWith("/prijava")) {
    await login(p, p._role);
    writeFileSync(`${DIR}/state/${p._role}.json`, JSON.stringify(await p.context().storageState()));
    await p.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180000 });
  }
  await p.locator("main h1").first().waitFor({ timeout: 120000 }).catch(() => {});
  await p.waitForLoadState("load", { timeout: 60000 }).catch(() => {});
  await hydrated(p, "main form, main button").catch(() => {});
  await p.waitForTimeout(2000);
}
async function section(name, fn) {
  if (want.length && !want.includes(name)) return;
  try {
    R[name] = await fn();
  } catch (e) {
    R[name] = { error: String(e).slice(0, 400) };
  }
  save();
  console.log(name, JSON.stringify(R[name]).slice(0, 1800));
}
/** Every visible form control with its accessible-name source, required/invalid state and description. */
async function controls(p) {
  return p.evaluate(() => [...document.querySelectorAll("main input:not([type=hidden]), main textarea, main select, main [role=checkbox], main [role=radio], main [role=combobox], main [role=switch]")]
    .filter((e) => e.offsetParent || e.getClientRects().length)
    .filter((e) => !(e.tagName === "INPUT" && e.getAttribute("aria-hidden") === "true"))
    .map((e) => {
      const lb = e.getAttribute("aria-labelledby");
      const name = e.getAttribute("aria-label") || (lb && lb.split(" ").map((i) => document.getElementById(i)?.textContent).join(" ")) || (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)?.textContent) || e.closest("label")?.textContent || e.title || e.placeholder || "";
      const db = e.getAttribute("aria-describedby");
      const fs = e.closest("fieldset");
      const group = e.closest("[role=group],[role=radiogroup]");
      return {
        el: `${e.tagName.toLowerCase()}${e.getAttribute("role") ? `[${e.getAttribute("role")}]` : ""}${e.type ? `:${e.type}` : ""}`,
        name: name.trim().replace(/\s+/g, " ").slice(0, 60),
        nameFromPlaceholderOnly: !e.getAttribute("aria-label") && !lb && !(e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) && !e.closest("label") && !!e.placeholder,
        required: e.required || e.getAttribute("aria-required") === "true",
        invalid: e.getAttribute("aria-invalid"),
        desc: db ? db.split(" ").map((i) => document.getElementById(i)?.textContent?.trim()).join(" | ").slice(0, 120) : "",
        autocomplete: e.getAttribute("autocomplete"),
        group: fs ? `fieldset:${fs.querySelector("legend")?.textContent.trim().slice(0, 40) ?? "(no legend)"}` : group ? `${group.getAttribute("role")}:${group.getAttribute("aria-label") || (group.getAttribute("aria-labelledby") && document.getElementById(group.getAttribute("aria-labelledby"))?.textContent) || "(no name)"}` : "",
      };
    }));
}
async function errorsAfterSubmit(p, submitLocator, evName) {
  await submitLocator.click();
  await p.waitForTimeout(1500);
  const res = await p.evaluate(() => ({
    focus: (() => { const e = document.activeElement; return e ? `${e.tagName.toLowerCase()} ${e.getAttribute("name") || e.id || ""} "${(e.getAttribute("aria-label") || "").slice(0, 30)}"` : null; })(),
    alerts: [...document.querySelectorAll("[role=alert],[aria-live=assertive],[aria-live=polite]")].map((e) => e.textContent.trim().slice(0, 100)).filter(Boolean),
    invalid: [...document.querySelectorAll("[aria-invalid=true]")].map((e) => e.getAttribute("name") || e.id),
    visibleErrors: [...document.querySelectorAll("main [id$=-error], main [data-slot=error], main .text-danger, main [class*=text-danger]")].filter((e) => e.offsetParent).map((e) => `${e.id || e.tagName}: ${e.textContent.trim().slice(0, 70)}`),
    url: location.pathname + location.search,
  }));
  res.ev = await shot(p, `a11y-app/${evName}`, { fullPage: false });
  return res;
}

// 1. Sign-in: empty submit, wrong password.
await section("prijava", async () => {
  const { ctx, p } = await page("anon", 390);
  await open(p, "/prijava");
  const c = await controls(p);
  const empty = await errorsAfterSubmit(p, p.getByTestId("auth-submit"), "forms-prijava-empty-390");
  await p.getByTestId("auth-email").fill("audit-a11y-app-wrong@primer.rs");
  await p.getByTestId("auth-password").fill("PogresnaLozinka-987");
  const wrong = await errorsAfterSubmit(p, p.getByTestId("auth-submit"), "forms-prijava-wrong-390");
  await p.waitForTimeout(2500);
  wrong.later = await p.evaluate(() => [...document.querySelectorAll("[role=alert],[aria-live]")].map((e) => `${e.getAttribute("role") || e.getAttribute("aria-live")}: ${e.textContent.trim().slice(0, 100)}`).filter((t) => !t.endsWith(": ")));
  wrong.ev2 = await shot(p, "a11y-app/forms-prijava-wrong-390-late", { fullPage: false });
  // password visibility toggle
  const toggle = await p.evaluate(() => [...document.querySelectorAll("main button")].filter((b) => /lozink|prikaž|sakrij/i.test(b.getAttribute("aria-label") || b.textContent)).map((b) => ({ label: b.getAttribute("aria-label") || b.textContent.trim(), pressed: b.getAttribute("aria-pressed"), size: `${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}` })));
  await ctx.close();
  return { controls: c, empty, wrong, toggle };
});

// 2. Customer registration: empty submit, terms checkbox label.
await section("registracija", async () => {
  const { ctx, p } = await page("anon", 390);
  await open(p, "/registracija");
  const c = await controls(p);
  const empty = await errorsAfterSubmit(p, p.locator("main form button[type=submit]").first(), "forms-registracija-empty-390");
  const ax = await axe(p);
  await ctx.close();
  return { controls: c, empty, ax };
});

// 3. Forgot password.
await section("zaboravljena", async () => {
  const { ctx, p } = await page("anon", 390);
  await open(p, "/zaboravljena-lozinka");
  const c = await controls(p);
  const empty = await errorsAfterSubmit(p, p.locator("main form button[type=submit]").first(), "forms-zaboravljena-empty-390");
  await ctx.close();
  return { controls: c, empty };
});

// 4. Mechanic registration: empty submit, grouping of specialisations.
await section("zaMajstore", async () => {
  const { ctx, p } = await page("anon", 390);
  await open(p, "/za-majstore/registracija");
  const c = await controls(p);
  const empty = await errorsAfterSubmit(p, p.locator("main form button[type=submit]").first(), "forms-za-majstore-empty-390");
  const ax = await axe(p);
  await ctx.close();
  return { controls: c, empty, ax };
});

// 5. Mechanic quick order: textarea label, paste preview, results table, live feedback.
await section("brzaPorudzbina", async () => {
  const { ctx, p } = await page("mechanic", 1440);
  await open(p, "/majstor/brza-porudzbina");
  const c = await controls(p);
  const ta = p.locator("main textarea").first();
  await ta.focus();
  const taFocus = await focused(p);
  await ta.fill("5Q0615505R 2\nNEPOSTOJI-999 1\n1K0698151 1");
  // find the parse/preview button
  const btns = await p.evaluate(() => [...document.querySelectorAll("main button")].filter((b) => b.offsetParent).map((b) => (b.getAttribute("aria-label") || b.textContent.trim()).slice(0, 40)));
  const parse = p.locator("main button", { hasText: /Proveri|Prepoznaj|Učitaj|Dodaj|Obradi|Pretraži/ }).first();
  let parseLabel = null;
  if (await parse.count()) { parseLabel = (await parse.textContent())?.trim(); await parse.click(); }
  await p.waitForTimeout(5000);
  const table = await p.evaluate(() => {
    const t = document.querySelector("main table");
    if (!t) return null;
    return {
      caption: t.querySelector("caption")?.textContent,
      th: [...t.querySelectorAll("thead th")].map((th) => `${th.textContent.trim()}${th.getAttribute("scope") ? "" : "(no scope)"}`),
      rows: [...t.querySelectorAll("tbody tr")].slice(0, 4).map((tr) => tr.textContent.trim().replace(/\s+/g, " ").slice(0, 120)),
    };
  });
  const c2 = await controls(p);
  const live = await p.evaluate(() => [...document.querySelectorAll("main [aria-live],main [role=status],main [role=alert]")].map((e) => `${e.getAttribute("role") || e.getAttribute("aria-live")}: ${e.textContent.trim().slice(0, 120)}`));
  const rowButtons = await p.evaluate(() => [...document.querySelectorAll("main table button")].slice(0, 6).map((b) => (b.getAttribute("aria-label") || b.textContent.trim() || "(empty)").slice(0, 50)));
  const ev = await shot(p, "a11y-app/forms-quick-order-1440", { fullPage: false });
  const ax = await axe(p);
  await ctx.close();
  return { controls: c, taFocus, btns, parseLabel, table, controlsAfter: c2.slice(0, 20), live, rowButtons, ev, ax };
});

// 6. Mechanic price list download form.
await section("cenovnik", async () => {
  const { ctx, p } = await page("mechanic", 1440);
  await open(p, "/majstor/cenovnik");
  const c = await controls(p);
  const tree = await p.evaluate(() => {
    const cb = [...document.querySelectorAll("main [role=checkbox]")];
    return { count: cb.length, sample: cb.slice(0, 4).map((b) => ({ id: b.id, checked: b.getAttribute("aria-checked"), expanded: b.closest("[aria-expanded]")?.getAttribute("aria-expanded"), level: b.closest("[aria-level]")?.getAttribute("aria-level") })) };
  });
  const btns = await p.evaluate(() => [...document.querySelectorAll("main button:not([role])")].filter((b) => b.offsetParent).map((b) => (b.getAttribute("aria-label") || b.textContent.trim()).slice(0, 40)));
  const ev = await shot(p, "a11y-app/forms-cenovnik-1440", { fullPage: false });
  const ax = await axe(p);
  await ctx.close();
  return { controls: c.slice(0, 30), controlsCount: c.length, tree, btns, ev, ax };
});

// 7. Customer account sub-pages: titles, section headings, current nav item.
await section("nalog", async () => {
  const { ctx, p } = await page("customer", 390);
  const out = [];
  for (const r of ["/nalog", "/nalog/porudzbine", "/nalog/upiti", "/nalog/vozila", "/nalog/profil"]) {
    await open(p, r);
    out.push(await p.evaluate(() => ({
      path: location.pathname,
      title: document.title,
      h1: document.querySelector("main h1")?.textContent.trim(),
      h2: [...document.querySelectorAll("main h2")].map((h) => h.textContent.trim().slice(0, 40)).slice(0, 4),
      current: [...document.querySelectorAll("nav[aria-label=Nalog] [aria-current]")].map((a) => `${a.textContent.trim()}=${a.getAttribute("aria-current")}`),
    })));
    if (r === "/nalog/profil") {
      R._profilControls = await controls(p);
    }
  }
  await ctx.close();
  return { pages: out, profilControls: R._profilControls };
});

// 8. Mechanic portal sub-pages: titles and headings.
await section("majstor", async () => {
  const { ctx, p } = await page("mechanic", 390);
  const out = [];
  for (const r of ["/majstor", "/majstor/brza-porudzbina", "/majstor/porudzbine", "/majstor/cenovnik", "/majstor/profil"]) {
    await open(p, r);
    out.push(await p.evaluate(() => ({
      path: location.pathname,
      title: document.title,
      h1: document.querySelector("main h1")?.textContent.trim(),
      h2: [...document.querySelectorAll("main h2")].map((h) => h.textContent.trim().slice(0, 40)).slice(0, 4),
      current: [...document.querySelectorAll("main nav [aria-current], nav[aria-label='Majstorski portal'] [aria-current]")].map((a) => `${a.textContent.trim()}=${a.getAttribute("aria-current")}`),
    })));
  }
  await ctx.close();
  return { pages: out };
});

await browser.close();
console.log("saved", OUT);
