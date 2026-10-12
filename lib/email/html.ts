/**
 * Transactional e-mail building blocks (DS §3.1 „Paper“, dark-mode-safe). Every block
 * renders twice — table-based HTML with inline styles for mail clients and a plain-text twin —
 * so the two versions can never drift. Pure and Intl-free: runs in Convex mutations and in Next.
 *
 * Inline text markup (paragraphs, notices, list items): `**bold**` and `[label](https://…)`.
 * Everything else is escaped.
 *
 * Shape (DS §5.3, where a client draws radii; Outlook on Windows draws squares): button and code
 * box 6 px, notice and well 8 px, the panel 12 px — square and full-bleed on phones, where it
 * meets the screen edge. One orange per message: the button. Document numbers and part codes are
 * set in mono.
 */
import { BRAND_LOCKUP_NAME } from "../domain/brand";
import { formatPhone, normalizePhone } from "../format/phone";

/** Paper palette (docs/design/tokens.json → color.paper) and its night counterpart. */
export const PAPER = {
  bg: "#F3F4F5",
  panel: "#FFFFFF",
  header: "#F7F8F9",
  line: "#DADDE1",
  lineFaint: "#E8EAED",
  ink1: "#121518",
  ink2: "#3D444C",
  ink3: "#5D6570",
  accent: "#FF6B1A",
  accentText: "#B8470A",
  onAccent: "#121518",
  successText: "#1D7A4A",
  successBg: "#E3F4EA",
  warningText: "#8C5B00",
  warningBg: "#FBF0D9",
  dangerText: "#C4303A",
  dangerBg: "#FBE4E5",
  infoText: "#3A5F80",
  infoBg: "#E5EDF4",
} as const;

export const NIGHT = {
  bg: "#0D0F11",
  raised: "#121518",
  panel: "#16191D",
  header: "#1C2025",
  line: "#2C3238",
  ink1: "#F1ECE3",
  ink2: "#C4BEB4",
  ink3: "#969088",
  accentText: "#FF8A4A",
  successText: "#4FD18B",
  successBg: "#152620",
  warningText: "#F4C04A",
  warningBg: "#292418",
  dangerText: "#FF6166",
  dangerBg: "#2A191B",
  infoText: "#9DB8D0",
  infoBg: "#1E2328",
} as const;

/** Radius by role (DS §5.3): press 6 · read 8 · float 12. */
const RADIUS = { press: 6, read: 8, float: 12 } as const;

const FONT_UI =
  "'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_DISPLAY = "'Arial Black', Arial, Helvetica, sans-serif";
const FONT_MONO = "'Martian Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";
/** Prices and counts line up in columns where the client supports it. */
const TABULAR = "font-variant-numeric:tabular-nums;";

export type Tone = "info" | "success" | "warning" | "danger";

export type Block = { html: string; text: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only http(s) and mailto/tel/viber links survive; anything else becomes `#`. */
export function safeHref(href: string): string {
  const trimmed = href.trim();
  return /^(https?:\/\/|mailto:|tel:|viber:\/\/)/i.test(trimmed) ? trimmed : "#";
}

type Inline =
  { kind: "text" | "bold"; value: string } | { kind: "link"; value: string; href: string };

const INLINE_RE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of source.matchAll(INLINE_RE)) {
    const index = m.index ?? 0;
    if (index > last) out.push({ kind: "text", value: source.slice(last, index) });
    if (m[1] !== undefined) out.push({ kind: "bold", value: m[1] });
    else out.push({ kind: "link", value: m[2] ?? "", href: m[3] ?? "" });
    last = index + m[0].length;
  }
  if (last < source.length) out.push({ kind: "text", value: source.slice(last) });
  return out;
}

/**
 * Document numbers (SK-2026-000187, UP-…) never break at their hyphens and are set in mono,
 * a little smaller so they sit on the line of the sans around them.
 */
function keepCodes(escaped: string): string {
  return escaped.replace(
    /\b([A-Z]{1,4}-\d{4}-\d{6})\b/g,
    `<span style="white-space:nowrap;font-family:${FONT_MONO};font-size:0.92em;">$1</span>`,
  );
}

function linkStyle(color: string = PAPER.accentText): string {
  return `color:${color};text-decoration:underline;`;
}

/** Inline markup → HTML (escaped, links with the accent text colour). */
export function inlineHtml(source: string): string {
  return parseInline(source)
    .map((part) => {
      const value = keepCodes(escapeHtml(part.value)).replace(/\n/g, "<br>");
      if (part.kind === "bold") return `<strong style="font-weight:700;">${value}</strong>`;
      if (part.kind === "link")
        return `<a href="${escapeHtml(safeHref(part.href))}" class="sk-link" style="${linkStyle()}">${value}</a>`;
      return value;
    })
    .join("");
}

/** The readable value behind a phone, e-mail or Viber link; `null` for any other link. */
function contactValue(href: string): string | null {
  if (/^mailto:/i.test(href)) return href.replace(/^mailto:/i, "").split("?")[0] ?? "";
  if (/^tel:/i.test(href)) {
    const e164 = normalizePhone(href.replace(/^tel:/i, ""));
    return e164 ? formatPhone(e164) : href.replace(/^tel:/i, "");
  }
  const viber = /^viber:\/\/chat\?number=([^&]+)/i.exec(href);
  if (viber) {
    const e164 = normalizePhone(decodeURIComponent(viber[1] ?? ""));
    return e164 ? formatPhone(e164) : null;
  }
  return null;
}

/**
 * Inline markup → plain text. A web link keeps its address („label: https://…“, without the
 * colon after a label that already ends a sentence); a phone, e-mail or Viber link prints its
 * visible value once — the value is the number or address itself (FLOW-34).
 */
export function inlineText(source: string): string {
  const printed = new Set<string>();
  return parseInline(source)
    .map((part) => {
      if (part.kind === "link") {
        const href = safeHref(part.href);
        const contact = contactValue(href);
        if (contact !== null) {
          // „+381 64 123 4567“ once, never the raw tel:/viber:// URL: a label that is not the
          // value itself gets it in brackets („Viber (+381 60 …)“) unless the same value was
          // already printed in this text („Pozovite +381 64 … ili pišite na Viber“).
          const digits = (s: string) => s.replace(/\D/g, "");
          const same =
            part.value === contact ||
            (digits(contact).length > 0 && digits(part.value) === digits(contact));
          const known = printed.has(contact);
          printed.add(contact);
          return same || known ? part.value : `${part.value} (${contact})`;
        }
        if (part.value === href) return href;
        return /[.!?:]$/.test(part.value) ? `${part.value} ${href}` : `${part.value}: ${href}`;
      }
      return part.value;
    })
    .join("");
}

// Blocks ---------------------------------------------------------------------------------

export function heading(value: string): Block {
  return {
    html: `<h1 class="sk-ink1" style="margin:0 0 12px;font-family:${FONT_UI};font-size:24px;line-height:1.25;font-weight:700;color:${PAPER.ink1};letter-spacing:-0.01em;">${keepCodes(escapeHtml(value))}</h1>`,
    text: `${value}\n${"=".repeat(Math.min(value.length, 60))}`,
  };
}

export function subheading(value: string): Block {
  return {
    html: `<h2 class="sk-ink1" style="margin:26px 0 8px;font-family:${FONT_UI};font-size:17px;line-height:1.3;font-weight:700;color:${PAPER.ink1};">${escapeHtml(value)}</h2>`,
    text: `\n${value.toUpperCase()}`,
  };
}

export function paragraph(value: string, opts: { muted?: boolean } = {}): Block {
  const color = opts.muted ? PAPER.ink3 : PAPER.ink2;
  const cls = opts.muted ? "sk-ink3" : "sk-ink2";
  const size = opts.muted ? 14 : 16;
  return {
    html: `<p class="${cls}" style="margin:0 0 14px;font-family:${FONT_UI};font-size:${size}px;line-height:1.55;color:${color};">${inlineHtml(value)}</p>`,
    text: inlineText(value),
  };
}

/**
 * Bulletproof button: the fill is a table cell and the size is padding, so it needs no image and
 * no VML. 44 px tall (48 px and full width on phones), one per message.
 */
export function button(label: string, href: string): Block {
  const url = escapeHtml(safeHref(href));
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="sk-btn" style="margin:8px 0 22px;border-collapse:separate;"><tr><td class="sk-button" align="center" bgcolor="${PAPER.accent}" style="background:${PAPER.accent};border-radius:${RADIUS.press}px;mso-padding-alt:12px 22px;"><a href="${url}" style="display:inline-block;padding:12px 22px;font-family:${FONT_UI};font-size:16px;line-height:20px;font-weight:700;color:${PAPER.onAccent};text-decoration:none;border-radius:${RADIUS.press}px;">${escapeHtml(label)}</a></td></tr></table>`,
    text: `${label}: ${safeHref(href)}`,
  };
}

/** Secondary link on its own line (e.g. „Pogledajte status porudžbine“ under a button). */
export function linkLine(label: string, href: string): Block {
  return paragraph(`[${label}](${href})`);
}

export type FactRow = readonly [
  label: string,
  value: string,
  opts?: { mono?: boolean; strong?: boolean },
];

/**
 * Label / value „title block“ (a hairline between rows). Empty values are skipped. `bare` drops
 * the rules above and below, for a list that sits inside a `well`.
 */
export function facts(rows: readonly FactRow[], opts: { bare?: boolean } = {}): Block {
  const visible = rows.filter(([, value]) => value.trim() !== "");
  if (visible.length === 0) return { html: "", text: "" };
  const rule = opts.bare ? PAPER.line : PAPER.lineFaint;
  const html = visible
    .map(([label, value, o], i) => {
      const border = i === 0 ? "" : `border-top:1px solid ${rule};`;
      const font = o?.mono ? FONT_MONO : FONT_UI;
      const size = o?.mono ? 14 : 15;
      const weight = o?.strong ? 700 : 400;
      return `<tr><td class="sk-ink3 sk-line" valign="top" style="${border}padding:9px 12px 9px 0;width:38%;font-family:${FONT_UI};font-size:12px;line-height:21px;letter-spacing:0.06em;text-transform:uppercase;color:${PAPER.ink3};">${escapeHtml(label)}</td><td class="sk-ink1 sk-line" valign="top" style="${border}padding:9px 0;font-family:${font};font-size:${size}px;line-height:21px;font-weight:${weight};color:${PAPER.ink1};word-break:break-word;${TABULAR}">${inlineHtml(value)}</td></tr>`;
    })
    .join("");
  const frame = opts.bare
    ? "margin:0;border-collapse:collapse;"
    : `margin:4px 0 18px;border-collapse:collapse;border-top:1px solid ${PAPER.line};border-bottom:1px solid ${PAPER.line};`;
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${frame}"${opts.bare ? "" : ' class="sk-rule"'}>${html}</table>`,
    text: visible.map(([label, value]) => `${label}: ${inlineText(value)}`).join("\n"),
  };
}

/**
 * A well: a quiet inset box (8 px) around what the reader has to copy or act on — the payment
 * data of a predračun. The plain-text twin is the inner block unchanged.
 */
export function well(inner: Block): Block {
  if (inner.html === "") return inner;
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;border-collapse:separate;"><tr><td class="sk-well" bgcolor="${PAPER.header}" style="border:1px solid ${PAPER.line};border-radius:${RADIUS.read}px;background:${PAPER.header};padding:4px 16px;">${inner.html}</td></tr></table>`,
    text: inner.text,
  };
}

export type ItemRow = {
  name: string;
  sku?: string;
  meta?: string;
  quantity: number;
  unitLabel: string;
  totalLabel: string;
  note?: string;
};

export type TotalRow = readonly [label: string, value: string, opts?: { strong?: boolean }];

/**
 * Items as two columns that fit 320 px without media queries: name, then maker and code (mono)
 * on the left; the line total over „2 × 4.990 RSD“ on the right; totals below.
 */
export function items(rows: readonly ItemRow[], totals: readonly TotalRow[] = []): Block {
  const body = rows
    .map((r, i) => {
      const border = i === 0 ? "" : `border-top:1px solid ${PAPER.lineFaint};`;
      const code = r.sku
        ? `<span style="font-family:${FONT_MONO};font-size:12px;white-space:nowrap;">${escapeHtml(r.sku)}</span>`
        : "";
      const source = [r.meta ? escapeHtml(r.meta) : "", code].filter(Boolean).join(" · ");
      const meta = source
        ? `<div class="sk-ink3" style="margin-top:2px;font-size:13px;line-height:19px;color:${PAPER.ink3};">${source}</div>`
        : "";
      const note = r.note
        ? `<div class="sk-t-warning" style="margin-top:2px;font-size:13px;line-height:19px;color:${PAPER.warningText};">${escapeHtml(r.note)}</div>`
        : "";
      return `<tr><td class="sk-line" valign="top" style="${border}padding:11px 12px 11px 0;font-family:${FONT_UI};"><div class="sk-ink1" style="font-size:15px;line-height:21px;font-weight:600;color:${PAPER.ink1};">${escapeHtml(r.name)}</div>${meta}${note}</td><td class="sk-line" valign="top" align="right" style="${border}padding:11px 0;font-family:${FONT_UI};white-space:nowrap;${TABULAR}"><div class="sk-ink1" style="font-size:15px;line-height:21px;font-weight:600;color:${PAPER.ink1};">${escapeHtml(r.totalLabel)}</div><div class="sk-ink3" style="margin-top:2px;font-size:13px;line-height:19px;color:${PAPER.ink3};">${r.quantity}&nbsp;×&nbsp;${escapeHtml(r.unitLabel)}</div></td></tr>`;
    })
    .join("");
  const foot = totals
    .map(([label, value, o], i) => {
      const border = i === 0 ? `border-top:1px solid ${PAPER.line};` : "";
      const weight = o?.strong ? 700 : 400;
      const size = o?.strong ? 17 : 14;
      const color = o?.strong ? PAPER.ink1 : PAPER.ink2;
      const cls = o?.strong ? "sk-ink1" : "sk-ink2";
      // The sum has air around it; the lines above and below it stay tight.
      const top = i === 0 ? 11 : o?.strong ? 7 : 3;
      const bottom = o?.strong ? 5 : 3;
      return `<tr><td class="${cls} sk-rule" style="${border}padding:${top}px 12px ${bottom}px 0;font-family:${FONT_UI};font-size:${size}px;line-height:22px;font-weight:${weight};color:${color};">${escapeHtml(label)}</td><td class="${cls} sk-rule" align="right" style="${border}padding:${top}px 0 ${bottom}px;font-family:${FONT_UI};font-size:${size}px;line-height:22px;font-weight:${weight};color:${color};white-space:nowrap;${TABULAR}">${escapeHtml(value)}</td></tr>`;
    })
    .join("");
  const text = [
    ...rows.map((r) => {
      const parts = [`- ${r.name}`];
      if (r.sku) parts.push(`  ${r.sku}`);
      if (r.meta) parts.push(`  ${r.meta}`);
      parts.push(`  ${r.quantity} × ${r.unitLabel} = ${r.totalLabel}`);
      if (r.note) parts.push(`  ${r.note}`);
      return parts.join("\n");
    }),
    ...(totals.length ? [""] : []),
    ...totals.map(([label, value]) => `${label}: ${value}`),
  ].join("\n");
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;border-collapse:collapse;border-top:1px solid ${PAPER.line};" class="sk-rule">${body}${foot}</table>`,
    text,
  };
}

const TONE: Record<Tone, { fg: string; bg: string; line: string }> = {
  info: { fg: PAPER.infoText, bg: PAPER.infoBg, line: "#C3D3E1" },
  success: { fg: PAPER.successText, bg: PAPER.successBg, line: "#B5DEC6" },
  warning: { fg: PAPER.warningText, bg: PAPER.warningBg, line: "#E9D5A4" },
  danger: { fg: PAPER.dangerText, bg: PAPER.dangerBg, line: "#F0BDC0" },
};

export type LedgerRow = {
  title: string;
  href?: string;
  /** Part code or SKU, set in mono under the title. */
  code?: string;
  /** The state in words („ostalo 2 kom.“, „nema na stanju“) — never colour alone. */
  value: string;
  tone?: Tone;
};

/**
 * Rows of „what · code → state“ (low stock). The title may link — underlined in ink, so a list
 * of them does not spend the accent — and the state sits on the right in the words of its tone.
 */
export function ledger(rows: readonly LedgerRow[]): Block {
  if (rows.length === 0) return { html: "", text: "" };
  const html = rows
    .map((r, i) => {
      const border = i === 0 ? "" : `border-top:1px solid ${PAPER.lineFaint};`;
      const title = r.href
        ? `<a href="${escapeHtml(safeHref(r.href))}" class="sk-ink1" style="${linkStyle(PAPER.ink1)}">${escapeHtml(r.title)}</a>`
        : escapeHtml(r.title);
      const code = r.code
        ? `<div class="sk-ink3" style="margin-top:2px;font-family:${FONT_MONO};font-size:12px;line-height:19px;color:${PAPER.ink3};">${escapeHtml(r.code)}</div>`
        : "";
      const tone = r.tone ? TONE[r.tone] : null;
      const valueClass = r.tone ? `sk-t-${r.tone}` : "sk-ink1";
      return `<tr><td class="sk-line" valign="top" style="${border}padding:11px 12px 11px 0;font-family:${FONT_UI};"><div class="sk-ink1" style="font-size:15px;line-height:21px;font-weight:600;color:${PAPER.ink1};">${title}</div>${code}</td><td class="${valueClass} sk-line" valign="top" align="right" style="${border}padding:11px 0;font-family:${FONT_UI};font-size:14px;line-height:21px;font-weight:600;color:${tone ? tone.fg : PAPER.ink1};white-space:nowrap;${TABULAR}">${escapeHtml(r.value)}</td></tr>`;
    })
    .join("");
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;border-collapse:collapse;border-top:1px solid ${PAPER.line};border-bottom:1px solid ${PAPER.line};" class="sk-rule">${html}</table>`,
    text: rows
      .map((r) => {
        const head = `- ${r.code ? `${r.code} · ` : ""}${r.title} — ${r.value}`;
        return r.href ? `${head}\n  ${safeHref(r.href)}` : head;
      })
      .join("\n"),
  };
}

/**
 * Notice: a tinted box (8 px) with a hairline of its tone. The title carries the meaning in
 * words, never colour alone.
 */
export function notice(tone: Tone, title: string, body?: string): Block {
  const t = TONE[tone];
  const bodyHtml = body
    ? `<div class="sk-ink2" style="margin-top:3px;font-size:15px;line-height:22px;color:${PAPER.ink2};">${inlineHtml(body)}</div>`
    : "";
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;border-collapse:separate;"><tr><td class="sk-notice sk-n-${tone}" bgcolor="${t.bg}" style="border:1px solid ${t.line};border-radius:${RADIUS.read}px;background:${t.bg};padding:12px 16px;font-family:${FONT_UI};"><div class="sk-t-${tone}" style="font-size:15px;line-height:22px;font-weight:700;color:${t.fg};">${keepCodes(escapeHtml(title))}</div>${bodyHtml}</td></tr></table>`,
    text: `[${title}]${body ? `\n${inlineText(body)}` : ""}`,
  };
}

export function bullets(values: readonly string[]): Block {
  if (values.length === 0) return { html: "", text: "" };
  const li = values
    .map(
      (v) =>
        `<li class="sk-ink2" style="margin:0 0 6px;font-family:${FONT_UI};font-size:15px;line-height:22px;color:${PAPER.ink2};">${inlineHtml(v)}</li>`,
    )
    .join("");
  return {
    html: `<ul style="margin:0 0 16px;padding:0 0 0 20px;">${li}</ul>`,
    text: values.map((v) => `- ${inlineText(v)}`).join("\n"),
  };
}

/**
 * Large monospace code (password reset). The cell carries no `aria-label`: a label would replace
 * the digits for a screen reader; the sentence above the box names it.
 */
export function code(value: string, label: string): Block {
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px;border-collapse:separate;"><tr><td class="sk-code" bgcolor="${PAPER.header}" style="border:1px solid ${PAPER.line};border-radius:${RADIUS.press}px;background:${PAPER.header};padding:14px 20px;font-family:${FONT_MONO};font-size:28px;line-height:34px;letter-spacing:0.18em;font-weight:700;color:${PAPER.ink1};white-space:nowrap;">${escapeHtml(value)}</td></tr></table>`,
    text: `${label}: ${value}`,
  };
}

export function spacer(height = 8): Block {
  return {
    html: `<div style="height:${height}px;line-height:${height}px;font-size:1px;">&nbsp;</div>`,
    text: "",
  };
}

export function join(...blocks: (Block | null | undefined | false)[]): Block {
  const kept = blocks.filter((b): b is Block => Boolean(b) && (b as Block).html !== "");
  return {
    html: kept.map((b) => b.html).join("\n"),
    text: kept
      .map((b) => b.text)
      .filter((t) => t !== "")
      .join("\n\n"),
  };
}

// Layout ---------------------------------------------------------------------------------

export type FooterContact = {
  label: string;
  value: string;
  href?: string;
};

export type LayoutInput = {
  subject: string;
  preheader: string;
  brandName: string;
  siteUrl: string;
  /** Document number shown in the header (mono), e.g. SK-2026-000187. */
  reference?: string;
  body: Block;
  /** Company lines (name, address, PIB) — empty lines are skipped. */
  companyLines: readonly string[];
  contacts: readonly FooterContact[];
  hoursText?: string;
  /** Why the recipient gets this message (plain sentence). */
  reason: string;
  /** Optional unsubscribe / settings link under the reason. */
  manageLink?: { label: string; href: string };
};

export type RenderedEmail = {
  subject: string;
  preheader: string;
  html: string;
  text: string;
};

/**
 * Night colours, one list for both ways a client asks for them: `prefers-color-scheme` (Apple
 * Mail, iOS, Outlook for Mac, Thunderbird) and Outlook.com / the Outlook apps, which rewrite
 * colours themselves and only keep ours behind `[data-ogsc]` (text) and `[data-ogsb]` (ground).
 * The logo band stays white in both: its PNG is drawn on white (DS §2.6).
 */
const NIGHT_RULES: readonly (readonly [selector: string, declarations: string])[] = [
  [".sk-body, .sk-outer", `background: ${NIGHT.bg} !important;`],
  [".sk-panel", `background: ${NIGHT.panel} !important; border-color: ${NIGHT.line} !important;`],
  [".sk-foot", `background: ${NIGHT.raised} !important;`],
  [
    ".sk-well, .sk-code",
    `background: ${NIGHT.header} !important; border-color: ${NIGHT.line} !important;`,
  ],
  [".sk-ink1, .sk-code", `color: ${NIGHT.ink1} !important;`],
  [".sk-ink2", `color: ${NIGHT.ink2} !important;`],
  [".sk-ink3", `color: ${NIGHT.ink3} !important;`],
  [".sk-line, .sk-rule", `border-color: ${NIGHT.line} !important;`],
  [".sk-link", `color: ${NIGHT.accentText} !important;`],
  [".sk-notice", `border-color: ${NIGHT.line} !important;`],
  [".sk-n-info", `background: ${NIGHT.infoBg} !important;`],
  [".sk-n-success", `background: ${NIGHT.successBg} !important;`],
  [".sk-n-warning", `background: ${NIGHT.warningBg} !important;`],
  [".sk-n-danger", `background: ${NIGHT.dangerBg} !important;`],
  [".sk-t-info", `color: ${NIGHT.infoText} !important;`],
  [".sk-t-success", `color: ${NIGHT.successText} !important;`],
  [".sk-t-warning", `color: ${NIGHT.warningText} !important;`],
  [".sk-t-danger", `color: ${NIGHT.dangerText} !important;`],
];

function nightCss(prefixes: readonly string[], indent: string): string {
  return NIGHT_RULES.map(([selector, declarations]) => {
    const scoped = selector
      .split(", ")
      .flatMap((s) => (prefixes.length ? prefixes.map((p) => `${p} ${s}`) : [s]))
      .join(", ");
    return `${indent}${scoped} { ${declarations} }`;
  }).join("\n");
}

const STYLE_CSS = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  @media only screen and (max-width: 620px) {
    .sk-shell { width: 100% !important; }
    .sk-pad { padding-left: 20px !important; padding-right: 20px !important; }
    .sk-outer { padding: 0 !important; }
    .sk-panel { border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
    .sk-logo { padding-left: 8px !important; padding-right: 8px !important; border-radius: 0 !important; }
    .sk-foot { border-radius: 0 !important; }
    .sk-ref { padding-left: 12px !important; }
    .sk-btn { width: 100% !important; }
    .sk-button a { display: block !important; padding-top: 14px !important; padding-bottom: 14px !important; text-align: center !important; }
    .sk-col { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
    .sk-col-2 { padding-top: 10px !important; }
  }
  @media (prefers-color-scheme: dark) {
${nightCss([], "    ")}
  }
${nightCss(["[data-ogsc]", "[data-ogsb]"], "  ")}
`;

/**
 * The logo in the header (DS §2.6): the kit's PNG on white — SVG is stripped by several clients.
 * 954 × 176 px shown at 477 × 88, with 16 px of white around the artwork, so the header band is
 * white in both colour schemes. The file is served by the site (`public/brand/`).
 */
export const EMAIL_LOGO = {
  path: "/brand/email-header@2x.png",
  width: 477,
  height: 88,
  alt: BRAND_LOCKUP_NAME,
} as const;
const LOGO_GROUND = "#FFFFFF";

/** Hidden preview text followed by filler so clients do not pull body copy into the preview. */
function preheaderHtml(value: string): string {
  const filler = "&#847;&zwnj;&nbsp;".repeat(60);
  return `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${PAPER.bg};">${escapeHtml(value)}${filler}</div>`;
}

export function layout(input: LayoutInput): RenderedEmail {
  const home = escapeHtml(safeHref(input.siteUrl));
  const logoSrc = escapeHtml(safeHref(`${input.siteUrl.replace(/\/$/, "")}${EMAIL_LOGO.path}`));
  // The alt text is styled: with images blocked it stands in for the logo.
  const logo = `<a href="${home}" style="display:block;text-decoration:none;"><img src="${logoSrc}" width="${EMAIL_LOGO.width}" height="${EMAIL_LOGO.height}" alt="${escapeHtml(EMAIL_LOGO.alt)}" style="display:block;width:100%;max-width:${EMAIL_LOGO.width}px;height:auto;border:0;outline:none;text-decoration:none;font-family:${FONT_DISPLAY};font-size:18px;line-height:24px;font-weight:900;color:${PAPER.ink1};"></a>`;
  // On the white band in both schemes, so its colour is fixed (no dark-mode class).
  const reference = input.reference
    ? `<div class="sk-ref" style="padding:0 0 6px 16px;font-family:${FONT_MONO};font-size:13px;line-height:20px;color:${PAPER.ink3};white-space:nowrap;">${escapeHtml(input.reference)}</div>`
    : "";
  const company = input.companyLines.filter((l) => l.trim() !== "");
  const [companyName = input.brandName, ...companyRest] = company;
  // The company on the left, one contact per line on the right; the columns stack on phones.
  const companyHtml =
    `<div class="sk-ink2" style="font-weight:700;color:${PAPER.ink2};">${escapeHtml(companyName)}</div>` +
    (companyRest.length ? `<div>${companyRest.map(escapeHtml).join("<br>")}</div>` : "") +
    (input.hoursText
      ? `<div style="margin-top:6px;">Radno vreme: ${escapeHtml(input.hoursText)}</div>`
      : "");
  const contactsHtml = input.contacts
    .map((c) =>
      c.href
        ? `<div style="white-space:nowrap;">${escapeHtml(c.label)}: <a href="${escapeHtml(safeHref(c.href))}" class="sk-link" style="${linkStyle()}">${escapeHtml(c.value)}</a></div>`
        : `<div>${escapeHtml(c.label)}: ${escapeHtml(c.value)}</div>`,
    )
    .join("");
  const columns = contactsHtml
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td class="sk-col sk-ink3" valign="top" width="50%" style="padding:0 12px 0 0;font-family:${FONT_UI};font-size:13px;line-height:21px;color:${PAPER.ink3};">${companyHtml}</td><td class="sk-col sk-col-2 sk-ink3" valign="top" width="50%" style="padding:0 0 0 12px;font-family:${FONT_UI};font-size:13px;line-height:24px;color:${PAPER.ink3};">${contactsHtml}</td></tr></table>`
    : companyHtml;
  const reasonHtml = `<div class="sk-rule" style="margin-top:14px;padding-top:12px;border-top:1px solid ${PAPER.line};">${escapeHtml(input.reason)}${
    input.manageLink
      ? ` <a href="${escapeHtml(safeHref(input.manageLink.href))}" class="sk-link" style="${linkStyle()}">${escapeHtml(input.manageLink.label)}</a>`
      : ""
  }</div>`;
  const inner = RADIUS.float - 1;

  const html = `<!doctype html>
<html lang="sr-Latn-RS" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>${escapeHtml(input.subject)}</title>
<style>${STYLE_CSS}</style>
</head>
<body class="sk-body" style="margin:0;padding:0;background:${PAPER.bg};">
${preheaderHtml(input.preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sk-outer" bgcolor="${PAPER.bg}" style="background:${PAPER.bg};padding:24px 12px;">
<tr><td align="center">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sk-shell" style="max-width:600px;width:100%;">
<tr><td class="sk-panel" bgcolor="${PAPER.panel}" style="background:${PAPER.panel};border:1px solid ${PAPER.line};border-radius:${RADIUS.float}px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td class="sk-logo sk-line" bgcolor="${LOGO_GROUND}" style="padding:6px 16px;border-bottom:1px solid ${PAPER.line};background:${LOGO_GROUND};border-radius:${inner}px ${inner}px 0 0;">
${logo}
${reference}
</td></tr>
<tr><td class="sk-pad" style="padding:28px 32px 14px;font-family:${FONT_UI};">
${input.body.html}
</td></tr>
<tr><td class="sk-pad sk-foot sk-ink3 sk-line" bgcolor="${PAPER.header}" style="padding:20px 32px 22px;border-top:1px solid ${PAPER.line};background:${PAPER.header};border-radius:0 0 ${inner}px ${inner}px;font-family:${FONT_UI};font-size:13px;line-height:21px;color:${PAPER.ink3};">
${columns}
${reasonHtml}
</td></tr>
</table>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;

  const textFooter = [
    "--",
    ...(company.length ? company : [input.brandName]),
    ...input.contacts.map((c) => `${c.label}: ${c.value}`),
    ...(input.hoursText ? [`Radno vreme: ${input.hoursText}`] : []),
    "",
    input.reason +
      (input.manageLink
        ? ` ${input.manageLink.label}${/[.!?:]$/.test(input.manageLink.label) ? "" : ":"} ${input.manageLink.href}`
        : ""),
  ].join("\n");

  return {
    subject: input.subject,
    preheader: input.preheader,
    html,
    text: `${input.body.text}\n\n${textFooter}\n`,
  };
}
