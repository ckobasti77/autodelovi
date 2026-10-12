/**
 * Shared by corners.spec.ts and reveal-routes.spec.ts (step 28, docs/design/UI-BOOST.md §12):
 * the main routes of the storefront, the mechanics portal, the account and the admin, sign-in
 * per role, a scroll-through and the two in-page audits (corners, reveal contract).
 *
 * The portal and the account use the shared audit accounts (.playwright/audit-accounts.json,
 * written by scripts/qa/audit/accounts.mjs); the admin uses the seeded owner
 * (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD). A role without credentials is skipped.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { Page } from "@playwright/test";

import { REVEAL_LINE, REVEAL_TALL_RATIO } from "../../../constants/revealConfig";
import { TEST_IDS } from "../../../constants/testIds";

export const PRODUCT_PATH = "/deo/kocioni-disk-prednji-312-25-mm-demo-0007";
export const CATEGORY_PATH = "/delovi/kocioni-diskovi";

export type Role = "visitor" | "mechanic" | "customer" | "admin";

export type MainRoute = {
  name: string;
  path: string;
  role: Role;
  /** Needs a line in the cart. */
  cart?: boolean;
  /** Admin lists: open the first record (rows open with Enter). */
  firstRow?: string;
};

export const MAIN_ROUTES: MainRoute[] = [
  { name: "home", path: "/", role: "visitor" },
  { name: "parts", path: "/delovi", role: "visitor" },
  { name: "system", path: "/delovi/kocnice", role: "visitor" },
  { name: "category", path: CATEGORY_PATH, role: "visitor" },
  { name: "product", path: PRODUCT_PATH, role: "visitor" },
  { name: "search", path: "/pretraga?q=disk", role: "visitor" },
  { name: "search-empty", path: "/pretraga?q=zzzz-nema", role: "visitor" },
  { name: "cart", path: "/korpa", role: "visitor", cart: true },
  { name: "checkout", path: "/porudzbina", role: "visitor", cart: true },
  { name: "inquiry", path: "/upit", role: "visitor" },
  { name: "mechanics", path: "/za-majstore", role: "visitor" },
  { name: "mechanics-register", path: "/za-majstore/registracija", role: "visitor" },
  { name: "vehicles", path: "/vozila", role: "visitor" },
  { name: "vehicle-generation", path: "/vozila/volkswagen/golf/golf-7", role: "visitor" },
  { name: "contact", path: "/kontakt", role: "visitor" },
  { name: "delivery", path: "/dostava-i-placanje", role: "visitor" },
  { name: "about", path: "/o-nama", role: "visitor" },
  { name: "signin", path: "/prijava", role: "visitor" },
  { name: "signup", path: "/registracija", role: "visitor" },
  { name: "not-found", path: "/ova-strana-ne-postoji", role: "visitor" },
  { name: "portal", path: "/majstor", role: "mechanic" },
  { name: "portal-quick-order", path: "/majstor/brza-porudzbina", role: "mechanic" },
  { name: "portal-orders", path: "/majstor/porudzbine", role: "mechanic" },
  { name: "portal-pricelist", path: "/majstor/cenovnik", role: "mechanic" },
  { name: "portal-profile", path: "/majstor/profil", role: "mechanic" },
  { name: "account", path: "/nalog", role: "customer" },
  { name: "account-orders", path: "/nalog/porudzbine", role: "customer" },
  { name: "account-profile", path: "/nalog/profil", role: "customer" },
  { name: "admin", path: "/admin", role: "admin" },
  { name: "admin-orders", path: "/admin/porudzbine", role: "admin" },
  {
    name: "admin-order",
    path: "/admin/porudzbine",
    role: "admin",
    firstRow: "/admin/porudzbine/",
  },
  { name: "admin-inquiries", path: "/admin/upiti", role: "admin" },
  { name: "admin-products", path: "/admin/proizvodi", role: "admin" },
  { name: "admin-product", path: "/admin/proizvodi", role: "admin", firstRow: "/admin/proizvodi/" },
  { name: "admin-mechanics", path: "/admin/majstori", role: "admin" },
  { name: "admin-customers", path: "/admin/kupci", role: "admin" },
  { name: "admin-stock", path: "/admin/lager", role: "admin" },
  { name: "admin-import", path: "/admin/uvoz", role: "admin" },
  { name: "admin-settings", path: "/admin/podesavanja", role: "admin" },
];

export const routesFor = (role: Role) => MAIN_ROUTES.filter((route) => route.role === role);

type Account = { email: string; password: string };

const ACCOUNTS_FILE = path.resolve(".playwright/audit-accounts.json");

function credentials(role: Role): Account | null {
  if (role === "admin") {
    const { SEED_ADMIN_EMAIL: email, SEED_ADMIN_PASSWORD: password } = process.env;
    return email && password ? { email, password } : null;
  }
  if (!existsSync(ACCOUNTS_FILE)) return null;
  const accounts = JSON.parse(readFileSync(ACCOUNTS_FILE, "utf8")) as Partial<
    Record<"mechanic" | "customer", Account>
  >;
  return (role === "mechanic" ? accounts.mechanic : accounts.customer) ?? null;
}

/** Why `role` cannot be tested here, or null when it can. */
export function missingCredentials(role: Role): string | null {
  if (role === "visitor" || credentials(role)) return null;
  return role === "admin"
    ? "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set"
    : ".playwright/audit-accounts.json is missing (node scripts/qa/audit/accounts.mjs)";
}

const HOME: Record<Exclude<Role, "visitor">, string> = {
  mechanic: "/majstor",
  customer: "/nalog",
  admin: "/admin",
};

export async function signInAs(page: Page, role: Role) {
  if (role === "visitor") return;
  const account = credentials(role);
  if (!account) throw new Error(missingCredentials(role) ?? "no credentials");
  const next = HOME[role];
  await page.goto(`/prijava?next=${encodeURIComponent(next)}`, { waitUntil: "networkidle" });
  await page.getByTestId(TEST_IDS.authEmail).fill(account.email);
  await page.getByTestId(TEST_IDS.authPassword).fill(account.password);
  await page.getByTestId(TEST_IDS.authSubmit).click();
  await page.waitForURL((url) => url.pathname.startsWith(next), { timeout: 90_000 });
}

/** Network idle, but never longer than 20 s (a live query or an upload never idles). */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
}

/** The reveal engine has taken over (or the failsafe has): the boot rule no longer hides. */
export async function engineReady(page: Page) {
  await page
    .waitForFunction(
      () => {
        const classes = document.documentElement.classList;
        return !classes.contains("tr-hide") || classes.contains("tr-failsafe");
      },
      null,
      { timeout: 15_000 },
    )
    .catch(() => undefined);
}

export type RouteState = { cartReady: boolean };

/** Opens a main route (adds a product to the cart first when the route needs one). */
export async function openRoute(page: Page, route: MainRoute, state: RouteState) {
  if (route.cart && !state.cartReady) {
    await page.goto(PRODUCT_PATH, { waitUntil: "networkidle", timeout: 120_000 });
    await page.locator("#buy-box").getByTestId(TEST_IDS.productAddToCart).click();
    await page.getByText("Dodato").first().waitFor({ timeout: 30_000 });
    state.cartReady = true;
  }
  await page.goto(route.path, { waitUntil: "load", timeout: 120_000 });
  await settle(page);
  if (route.firstRow) {
    const prefix = route.firstRow;
    const row = page.locator("tr[data-row]").first();
    await row.waitFor({ timeout: 30_000 });
    await row.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(
      (url) => url.pathname.startsWith(prefix) && url.pathname.length > prefix.length,
      { timeout: 30_000, waitUntil: "commit" },
    );
    await settle(page);
  }
  await engineReady(page);
}

/** Scrolls to the end in 60 % steps, so everything has crossed the line, and waits it out. */
export async function scrollEndToEnd(page: Page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.6);
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 140));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page
    .waitForFunction(
      () => !document.querySelector('[data-reveal-state="pending"], [data-reveal-state="running"]'),
      null,
      { timeout: 6000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(400);
}

// ---------------------------------------------------------------------------------------------
// Reveal contract

export type RevealContract = {
  /** Elements with text that are laid out and have a computed opacity of 0. */
  hidden: string[];
  pending: number;
  running: number;
  /** Word spans the engine forgot to remove. */
  words: number;
  /** The 3.5 s failsafe showed the page instead of the engine. */
  failsafe: boolean;
};

export function revealContract(page: Page): Promise<RevealContract> {
  return page.evaluate(() => ({
    hidden: [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((e) => e.offsetParent && e.textContent?.trim() && getComputedStyle(e).opacity === "0")
      .map((e) => `${e.tagName.toLowerCase()}: ${e.textContent?.trim().slice(0, 48)}`)
      .slice(0, 12),
    pending: document.querySelectorAll('[data-reveal-state="pending"]').length,
    running: document.querySelectorAll('[data-reveal-state="running"]').length,
    words: document.querySelectorAll(".reveal-word").length,
    failsafe: document.documentElement.classList.contains("tr-failsafe"),
  }));
}

/**
 * What the trigger rule says must already be showing: elements whose centre (top, when taller
 * than the tall ratio) is above the line — on screen or scrolled past — and that are still
 * pending or at opacity 0.
 */
export function unrevealedAboveLine(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ line, tall }) => {
      const lineY = window.innerHeight * (1 - line);
      const crossed = (el: Element) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        const point =
          rect.height > window.innerHeight * tall ? rect.top : rect.top + rect.height / 2;
        return point < lineY - 4;
      };
      const out = new Set<string>();
      const describe = (el: Element) =>
        `${el.tagName.toLowerCase()}: ${el.textContent?.trim().slice(0, 48)}`;
      for (const el of document.querySelectorAll('[data-reveal-state="pending"]')) {
        if (crossed(el)) out.add(describe(el));
      }
      for (const el of document.querySelectorAll<HTMLElement>("body *")) {
        if (!el.offsetParent || !el.textContent?.trim()) continue;
        if (getComputedStyle(el).opacity === "0" && crossed(el)) out.add(describe(el));
      }
      return [...out].slice(0, 12);
    },
    { line: REVEAL_LINE, tall: REVEAL_TALL_RATIO },
  );
}

/** Elements with text inside the current viewport that are at opacity 0. */
export function hiddenInViewport(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((e) => {
        if (!e.offsetParent || !e.textContent?.trim()) return false;
        const rect = e.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.width === 0) return false;
        return getComputedStyle(e).opacity === "0";
      })
      .map((e) => `${e.tagName.toLowerCase()}: ${e.textContent?.trim().slice(0, 48)}`)
      .slice(0, 12),
  );
}

// ---------------------------------------------------------------------------------------------
// Corner audit

export const CORNER_KINDS = [
  "card",
  "button",
  "input",
  "select",
  "image",
  "badge",
  "dialog",
  "menu",
  "toast",
  "tooltip",
] as const;
export type CornerKind = (typeof CORNER_KINDS)[number];

export type CornerFinding = { kind: CornerKind; sig: string; size: string; text: string };

export type CornerReport = {
  /** Visible boxes audited, by kind (rounded, allowlisted and sharp together). */
  checked: Record<CornerKind, number>;
  /** Boxes with a computed border radius of 0 on all four corners and at least one free corner. */
  sharp: CornerFinding[];
  /** Radius 0, not sharp — the documented allowlist, by reason. */
  allowed: {
    fullBleed: number;
    clipped: number;
    joined: number;
    drawing: number;
    artwork: number;
  };
  /** Controls with radius 0 that paint nothing at rest (text buttons, inputs inside a frame). */
  bare: number;
};

/**
 * Runs in the page. Every element that draws a visible box — a fill that differs from what is
 * behind it, a border on three sides (or two that meet), an opaque gradient, a box shadow, a
 * picture, a form control — is audited; so is every dialog, menu, toast and tooltip. A box is
 * **sharp** when all four computed corner radii are 0 and one of its corners is free, i.e. not:
 *
 * - on an edge of the viewport or of the document (full-bleed bands, the header, docked bars,
 *   drawers and sheets on their docked side, a sidebar from top to bottom);
 * - clipped round by an ancestor (same corner, `overflow` not visible, radius > 0);
 * - ending on a straight edge of an ancestor that clips or draws a box (a strip across a card,
 *   a picture that fills one end of it) — a T-junction, not a corner;
 * - continued by a neighbouring box that is painted right beside it (cells of a grid divided
 *   by hairlines inside one rounded panel, the admin top bar against the sidebar).
 *
 * Also allowed: drawings (`.corner-ticks`, `[data-corner-audit="skip"]`, anything inside an
 * SVG) and pictures whose four corner pixels are transparent (logos, part renders, the
 * stage poster) — there is no box to round.
 */
export async function cornerAuditInPage(): Promise<CornerReport> {
  type RGBA = [number, number, number, number];
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;
  const TOLERANCE = 2;
  const KINDS = [
    "card",
    "button",
    "input",
    "select",
    "image",
    "badge",
    "dialog",
    "menu",
    "toast",
    "tooltip",
  ] as const;
  type Kind = (typeof KINDS)[number];

  // Computed colours come back as rgb(), oklab(), color(srgb …): let a canvas resolve them.
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const ink = probe.getContext("2d", { willReadFrequently: true });
  const colours = new Map<string, RGBA>();
  const rgba = (value: string): RGBA => {
    const known = colours.get(value);
    if (known) return known;
    let out: RGBA = [0, 0, 0, 0];
    if (ink && value && value !== "transparent" && value !== "rgba(0, 0, 0, 0)") {
      ink.clearRect(0, 0, 1, 1);
      ink.fillStyle = "#000";
      ink.fillStyle = value;
      ink.fillRect(0, 0, 1, 1);
      const data = ink.getImageData(0, 0, 1, 1).data;
      out = [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, (data[3] ?? 0) / 255];
    }
    colours.set(value, out);
    return out;
  };
  const near = (a: RGBA, b: RGBA) =>
    Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 8;
  const backdrop = (el: Element): RGBA => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      const colour = rgba(getComputedStyle(node).backgroundColor);
      if (colour[3] > 0.5) return colour;
    }
    return rgba(getComputedStyle(document.documentElement).backgroundColor);
  };
  const radiiOf = (style: CSSStyleDeclaration) =>
    [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius,
    ].map((value) => Number.parseFloat(value) || 0);
  const SIDES = ["Top", "Right", "Bottom", "Left"] as const;
  const borders = (style: CSSStyleDeclaration) =>
    SIDES.map((side) => {
      const width = Number.parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`));
      const kind = style.getPropertyValue(`border-${side.toLowerCase()}-style`);
      const colour = rgba(style.getPropertyValue(`border-${side.toLowerCase()}-color`));
      return width > 0 && kind !== "none" && kind !== "hidden" && colour[3] > 0.05 ? width : 0;
    });
  const shadowShows = (value: string) => {
    if (!value || value === "none") return false;
    // Layers are separated by commas outside parentheses; each starts with its colour.
    return value.split(/,(?![^(]*\))/).some((layer) => {
      const colour = layer.trim().match(/^([a-z-]+\([^)]*\)|#[0-9a-f]+|[a-z]+)/i)?.[1];
      const lengths = layer.replace(/[a-z-]+\([^)]*\)/gi, "").match(/-?[\d.]+px/g) ?? [];
      const drawn = lengths.some((length) => Number.parseFloat(length) !== 0);
      return drawn && colour !== undefined && rgba(colour)[3] > 0.05;
    });
  };
  /** What an element paints: a box, and whether a fill or border makes it one. */
  const paintOf = (el: Element, style: CSSStyleDeclaration) => {
    const fill = rgba(style.backgroundColor);
    const filled = fill[3] >= 0.04 && !(fill[3] > 0.9 && near(fill, backdrop(el)));
    const widths = borders(style);
    const count = widths.filter((width) => width > 0).length;
    const meet = widths.some((width, i) => width > 0 && (widths[(i + 1) % 4] ?? 0) > 0);
    const bordered = count >= 3 || (count === 2 && meet);
    const image = style.backgroundImage;
    const picture = image.includes("url(");
    const gradient = image.includes("gradient(") && !/rgba\(0, 0, 0, 0\)|transparent/.test(image);
    return {
      filled,
      bordered,
      picture,
      widths,
      box: filled || bordered || picture || gradient || shadowShows(style.boxShadow),
    };
  };

  const kindOf = (el: Element, rect: DOMRect, picture: boolean): Kind => {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role") ?? "";
    if (el.matches("li[data-swipe-direction]")) return "toast";
    if (role === "dialog" || role === "alertdialog" || tag === "dialog") return "dialog";
    if (role === "tooltip") return "tooltip";
    if (role === "menu" || role === "listbox") return "menu";
    if (el.parentElement?.hasAttribute("data-radix-popper-content-wrapper")) {
      // Radix puts role="tooltip" on a visually hidden copy beside the visible content.
      return el.parentElement.querySelector('[role="tooltip"]') ? "tooltip" : "menu";
    }
    if (tag === "select" || (role === "combobox" && tag !== "input")) return "select";
    if (tag === "input") {
      const type = el.getAttribute("type") ?? "text";
      return ["button", "submit", "reset"].includes(type) ? "button" : "input";
    }
    if (tag === "textarea") return "input";
    if (tag === "button" || role === "button" || tag === "summary") return "button";
    if (tag === "a") return rect.height > 64 ? "card" : "button";
    if (["img", "video", "canvas", "iframe"].includes(tag) || picture) return "image";
    if (rect.height <= 28 && rect.width <= 260 && !el.querySelector("a, button, input")) {
      return "badge";
    }
    return "card";
  };

  /** Every visible element that paints a fill or a border: what a corner can end against. */
  const boxes: Element[] = [];
  /** Boxes with a free corner so far; judged against their neighbours once `boxes` is whole. */
  const undecided: { el: HTMLElement; kind: Kind; position: string }[] = [];

  /** Free corners of a box whose own radii are all 0, and whether an edge excused any. */
  const judge = (el: Element, rect: DOMRect, ownPosition: string, neighbours = false) => {
    /**
     * A painted box that is neither `el`, inside it nor around it covers this point. By
     * geometry, not hit-testing: an open modal menu sets `pointer-events: none` on the body.
     */
    const painted = (px: number, py: number) =>
      boxes.some((other) => {
        if (other === el || el.contains(other) || other.contains(el)) return false;
        const box = other.getBoundingClientRect();
        return px >= box.left && px <= box.right && py >= box.top && py <= box.bottom;
      });
    const REACH = 4;
    let anchored = ownPosition === "fixed" || ownPosition === "sticky";
    const chain: {
      rect: DOMRect;
      radii: number[];
      widths: number[];
      clips: boolean;
      draws: boolean;
    }[] = [];
    for (
      let node = el.parentElement;
      node && node !== document.documentElement;
      node = node.parentElement
    ) {
      const style = getComputedStyle(node);
      if (style.position === "fixed" || style.position === "sticky") anchored = true;
      const paint = paintOf(node, style);
      const clips = style.overflowX !== "visible" || style.overflowY !== "visible";
      const draws = paint.filled || paint.bordered;
      if (clips || draws) {
        chain.push({
          rect: node.getBoundingClientRect(),
          radii: radiiOf(style),
          widths: paint.widths,
          clips,
          draws,
        });
      }
    }
    const points: [number, number][] = [
      [rect.left, rect.top],
      [rect.right, rect.top],
      [rect.right, rect.bottom],
      [rect.left, rect.bottom],
    ];
    let free = 0;
    let onEdge = false;
    let joined = false;
    for (const [i, [x, y]] of points.entries()) {
      const docY = y + window.scrollY;
      if (
        x <= 1 ||
        x >= vw - 1 ||
        docY <= 1 ||
        docY >= docHeight - 1 ||
        (anchored && (y <= 1 || y >= vh - 1))
      ) {
        onEdge = true;
        continue;
      }
      let soft = false;
      for (const outer of chain) {
        const [top = 0, right = 0, bottom = 0, left = 0] = outer.widths;
        const box = outer.rect;
        const outside =
          x < box.left - TOLERANCE ||
          x > box.right + TOLERANCE ||
          y < box.top - TOLERANCE ||
          y > box.bottom + TOLERANCE;
        if (outside) {
          // Cut off by a clipping ancestor: the visible edge is the ancestor's.
          if (outer.clips) soft = true;
          if (soft) break;
          continue;
        }
        const onLeft = Math.abs(x - box.left) <= TOLERANCE + left;
        const onRight = Math.abs(x - box.right) <= TOLERANCE + right;
        const onTop = Math.abs(y - box.top) <= TOLERANCE + top;
        const onBottom = Math.abs(y - box.bottom) <= TOLERANCE + bottom;
        const [tl = 0, tr = 0, br = 0, bl = 0] = outer.radii;
        if ((onLeft || onRight) && (onTop || onBottom)) {
          // The ancestor's own corner: soft only when the ancestor clips it round.
          const radius = onTop ? (onLeft ? tl : tr) : onRight ? br : bl;
          if (outer.clips && radius > 0) soft = true;
        } else if (onLeft || onRight) {
          const above = onLeft ? tl : tr;
          const below = onLeft ? bl : br;
          if (outer.clips || (y - box.top >= above && box.bottom - y >= below)) soft = true;
        } else if (onTop || onBottom) {
          const before = onTop ? tl : bl;
          const after = onTop ? tr : br;
          if (outer.clips || (x - box.left >= before && box.right - x >= after)) soft = true;
        }
        if (soft) break;
      }
      if (!soft && neighbours) {
        // Outwards from this corner: left for the left corners, up for the top ones.
        const dx = i === 0 || i === 3 ? -REACH : REACH;
        const dy = i <= 1 ? -REACH : REACH;
        if (painted(x + dx, y - dy) || painted(x - dx, y + dy)) {
          soft = true;
          joined = true;
        }
      }
      if (!soft) free += 1;
    }
    return { free, onEdge, joined };
  };

  /** A picture whose four corner pixels are transparent draws no box. */
  const transparentCorners = (img: HTMLImageElement) => {
    try {
      if (!img.complete || img.naturalWidth === 0) return true;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 48;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return false;
      context.drawImage(img, 0, 0, 48, 48);
      const alpha = (x: number, y: number) => context.getImageData(x, y, 1, 1).data[3] ?? 255;
      return [alpha(1, 1), alpha(46, 1), alpha(46, 46), alpha(1, 46)].every((a) => a < 24);
    } catch {
      return false;
    }
  };

  await Promise.race([
    Promise.all(
      [...document.images]
        .filter((img) => !img.complete)
        .map((img) => img.decode().catch(() => undefined)),
    ),
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ]);

  const checked = Object.fromEntries(KINDS.map((kind) => [kind, 0])) as Record<Kind, number>;
  const allowed = { fullBleed: 0, clipped: 0, joined: 0, drawing: 0, artwork: 0 };
  const sharp: { kind: Kind; sig: string; size: string; text: string }[] = [];
  let bare = 0;
  const SKIP = new Set([
    "script",
    "style",
    "template",
    "noscript",
    "br",
    "option",
    "optgroup",
    "td",
    "th",
    "col",
    "colgroup",
    "source",
    "track",
    "picture",
  ]);
  const CONTROLS = new Set(["button", "input", "select", "textarea"]);
  const MEDIA = new Set(["img", "video", "canvas", "iframe"]);

  for (const el of document.querySelectorAll<HTMLElement>("body *")) {
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag) || el.closest("nextjs-portal, svg")) continue;
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 12 || rect.height < 12) continue;
    if (rect.right <= 0 || rect.left >= vw) continue;
    const style = getComputedStyle(el);
    if (tag === "input" && ["hidden", "file", "range"].includes(el.getAttribute("type") ?? "")) {
      continue;
    }

    const paint = paintOf(el, style);
    if (paint.filled || paint.bordered) boxes.push(el);
    const role = el.getAttribute("role") ?? "";
    const control = CONTROLS.has(tag) || role === "button" || role === "combobox";
    const media = MEDIA.has(tag);
    const overlay =
      el.matches(
        'li[data-swipe-direction], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
      ) || el.parentElement?.hasAttribute("data-radix-popper-content-wrapper") === true;
    if (!(paint.box || control || media || overlay)) continue;

    const kind = kindOf(el, rect, paint.picture);
    const radii = radiiOf(style);
    if (radii.some((radius) => radius > 0)) {
      checked[kind] += 1;
      continue;
    }
    if (control && !paint.box) {
      bare += 1;
      continue;
    }
    if (el.closest('.corner-ticks, [data-corner-audit="skip"]')) {
      checked[kind] += 1;
      allowed.drawing += 1;
      continue;
    }
    if (tag === "img" && !paint.filled && !paint.bordered) {
      const img = el as HTMLImageElement;
      const fit = style.objectFit;
      const letterboxed =
        (fit === "contain" || fit === "scale-down") &&
        img.naturalWidth > 0 &&
        Math.abs(img.naturalWidth / img.naturalHeight - rect.width / rect.height) > 0.03;
      if (letterboxed || transparentCorners(img)) {
        checked[kind] += 1;
        allowed.artwork += 1;
        continue;
      }
    }
    checked[kind] += 1;
    const verdict = judge(el, rect, style.position);
    if (verdict.free === 0) {
      if (verdict.onEdge) allowed.fullBleed += 1;
      else allowed.clipped += 1;
      continue;
    }
    undecided.push({ el, kind, position: style.position });
  }

  for (const { el, kind, position } of undecided) {
    const tag = el.tagName.toLowerCase();
    const rect = el.getBoundingClientRect();
    if (judge(el, rect, position, true).free === 0) {
      allowed.joined += 1;
      continue;
    }
    sharp.push({
      kind,
      sig: `${tag}.${[...el.classList].slice(0, 4).join(".")}${
        el.closest("[data-testid]")
          ? ` [${el.closest("[data-testid]")?.getAttribute("data-testid")}]`
          : ""
      }`,
      size: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
      text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 32),
    });
  }
  return { checked, sharp, allowed, bare };
}

/** Audits the page as it stands (overlays included). Call after the reveals have run. */
export async function auditCorners(page: Page): Promise<CornerReport> {
  // Sections skipped by `content-visibility: auto` have no boxes to measure.
  await page.addStyleTag({ content: "*{content-visibility:visible!important}" });
  await page.waitForTimeout(150);
  return page.evaluate(cornerAuditInPage);
}

export function cornerLine(label: string, report: CornerReport): string {
  const kinds = CORNER_KINDS.filter((kind) => report.checked[kind] > 0)
    .map((kind) => `${kind} ${report.checked[kind]}`)
    .join(" · ");
  const { fullBleed, clipped, joined, drawing, artwork } = report.allowed;
  return `corners ${label}: sharp ${report.sharp.length} | ${kinds || "nothing audited"} | allowlist: full-bleed ${fullBleed} · clipped by a rounded box ${clipped} · joined to a neighbour ${joined} · drawing ${drawing} · transparent artwork ${artwork} | bare controls ${report.bare}`;
}
