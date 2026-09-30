/**
 * Transactional e-mail building blocks (DS §3.1 „Paper“, dark-mode-safe). Every block
 * renders twice — table-based HTML with inline styles for mail clients and a plain-text twin —
 * so the two versions can never drift. Pure and Intl-free: runs in Convex mutations and in Next.
 *
 * Inline text markup (paragraphs, notices, list items): `**bold**` and `[label](https://…)`.
 * Everything else is escaped.
 */

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
  panel: "#16191D",
  header: "#1C2025",
  line: "#2C3238",
  ink1: "#F1ECE3",
  ink2: "#C4BEB4",
  ink3: "#969088",
  accentText: "#FF8A4A",
} as const;

const FONT_UI =
  "'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_DISPLAY = "'Arial Black', Arial, Helvetica, sans-serif";
const FONT_MONO = "'Martian Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

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

function linkStyle(color: string = PAPER.accentText): string {
  return `color:${color};text-decoration:underline;`;
}

/** Inline markup → HTML (escaped, links with the accent text colour). */
export function inlineHtml(source: string): string {
  return parseInline(source)
    .map((part) => {
      const value = escapeHtml(part.value).replace(/\n/g, "<br>");
      if (part.kind === "bold") return `<strong style="font-weight:700;">${value}</strong>`;
      if (part.kind === "link")
        return `<a href="${escapeHtml(safeHref(part.href))}" class="sk-link" style="${linkStyle()}">${value}</a>`;
      return value;
    })
    .join("");
}

/** Inline markup → plain text (`label (https://…)`). */
export function inlineText(source: string): string {
  return parseInline(source)
    .map((part) => {
      if (part.kind === "link") {
        const href = safeHref(part.href).replace(/^mailto:/, "");
        return part.value === href ? href : `${part.value}: ${href}`;
      }
      return part.value;
    })
    .join("");
}

// Blocks ---------------------------------------------------------------------------------

export function heading(value: string): Block {
  return {
    html: `<h1 class="sk-ink1" style="margin:0 0 12px;font-family:${FONT_UI};font-size:24px;line-height:1.25;font-weight:700;color:${PAPER.ink1};letter-spacing:-0.01em;">${escapeHtml(value)}</h1>`,
    text: `${value}\n${"=".repeat(Math.min(value.length, 60))}`,
  };
}

export function subheading(value: string): Block {
  return {
    html: `<h2 class="sk-ink1" style="margin:24px 0 8px;font-family:${FONT_UI};font-size:17px;line-height:1.3;font-weight:700;color:${PAPER.ink1};">${escapeHtml(value)}</h2>`,
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

/** Bulletproof button (table cell with the fill), 44 px tall, one per message region. */
export function button(label: string, href: string): Block {
  const url = escapeHtml(safeHref(href));
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px;border-collapse:separate;"><tr><td class="sk-button" bgcolor="${PAPER.accent}" style="background:${PAPER.accent};border-radius:2px;mso-padding-alt:12px 22px;"><a href="${url}" style="display:inline-block;padding:12px 22px;font-family:${FONT_UI};font-size:16px;line-height:20px;font-weight:700;color:${PAPER.onAccent};text-decoration:none;border-radius:2px;">${escapeHtml(label)}</a></td></tr></table>`,
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

/** Label / value „title block“ (a hairline between rows). Empty values are skipped. */
export function facts(rows: readonly FactRow[]): Block {
  const visible = rows.filter(([, value]) => value.trim() !== "");
  if (visible.length === 0) return { html: "", text: "" };
  const html = visible
    .map(([label, value, o], i) => {
      const border = i === 0 ? "" : `border-top:1px solid ${PAPER.lineFaint};`;
      const font = o?.mono ? FONT_MONO : FONT_UI;
      const size = o?.mono ? 14 : 15;
      const weight = o?.strong ? 700 : 400;
      return `<tr><td class="sk-ink3 sk-line" valign="top" style="${border}padding:9px 12px 9px 0;width:38%;font-family:${FONT_UI};font-size:12px;line-height:18px;letter-spacing:0.06em;text-transform:uppercase;color:${PAPER.ink3};">${escapeHtml(label)}</td><td class="sk-ink1 sk-line" valign="top" style="${border}padding:9px 0;font-family:${font};font-size:${size}px;line-height:21px;font-weight:${weight};color:${PAPER.ink1};word-break:break-word;">${inlineHtml(value)}</td></tr>`;
    })
    .join("");
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;border-collapse:collapse;border-top:1px solid ${PAPER.line};border-bottom:1px solid ${PAPER.line};" class="sk-rule">${html}</table>`,
    text: visible.map(([label, value]) => `${label}: ${inlineText(value)}`).join("\n"),
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
 * Items as two columns that fit 320 px without media queries: name, code and „2 × 4.990 RSD“
 * on the left, the line total on the right; totals below.
 */
export function items(rows: readonly ItemRow[], totals: readonly TotalRow[] = []): Block {
  const body = rows
    .map((r, i) => {
      const border = i === 0 ? "" : `border-top:1px solid ${PAPER.lineFaint};`;
      const code = r.sku
        ? `<div class="sk-ink3" style="font-family:${FONT_MONO};font-size:12px;line-height:18px;color:${PAPER.ink3};">${escapeHtml(r.sku)}</div>`
        : "";
      const meta = r.meta
        ? `<div class="sk-ink3" style="font-size:13px;line-height:19px;color:${PAPER.ink3};">${escapeHtml(r.meta)}</div>`
        : "";
      const note = r.note
        ? `<div style="font-size:13px;line-height:19px;color:${PAPER.warningText};">${escapeHtml(r.note)}</div>`
        : "";
      return `<tr><td class="sk-line" valign="top" style="${border}padding:10px 12px 10px 0;font-family:${FONT_UI};"><div class="sk-ink1" style="font-size:15px;line-height:21px;font-weight:600;color:${PAPER.ink1};">${escapeHtml(r.name)}</div>${code}${meta}<div class="sk-ink2" style="font-size:13px;line-height:19px;color:${PAPER.ink2};">${r.quantity}&nbsp;×&nbsp;${escapeHtml(r.unitLabel)}</div>${note}</td><td class="sk-ink1 sk-line" valign="top" align="right" style="${border}padding:10px 0;font-family:${FONT_UI};font-size:15px;line-height:21px;font-weight:600;color:${PAPER.ink1};white-space:nowrap;">${escapeHtml(r.totalLabel)}</td></tr>`;
    })
    .join("");
  const foot = totals
    .map(([label, value, o], i) => {
      const border = i === 0 ? `border-top:1px solid ${PAPER.line};` : "";
      const weight = o?.strong ? 700 : 400;
      const size = o?.strong ? 17 : 14;
      const color = o?.strong ? PAPER.ink1 : PAPER.ink2;
      const cls = o?.strong ? "sk-ink1" : "sk-ink2";
      return `<tr><td class="${cls} sk-rule" style="${border}padding:${i === 0 ? 10 : 3}px 12px 3px 0;font-family:${FONT_UI};font-size:${size}px;line-height:22px;font-weight:${weight};color:${color};">${escapeHtml(label)}</td><td class="${cls} sk-rule" align="right" style="${border}padding:${i === 0 ? 10 : 3}px 0 3px;font-family:${FONT_UI};font-size:${size}px;line-height:22px;font-weight:${weight};color:${color};white-space:nowrap;">${escapeHtml(value)}</td></tr>`;
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

const TONE: Record<Tone, { fg: string; bg: string; label: string }> = {
  info: { fg: PAPER.infoText, bg: PAPER.infoBg, label: "Napomena" },
  success: { fg: PAPER.successText, bg: PAPER.successBg, label: "U redu" },
  warning: { fg: PAPER.warningText, bg: PAPER.warningBg, label: "Pažnja" },
  danger: { fg: PAPER.dangerText, bg: PAPER.dangerBg, label: "Važno" },
};

/** Notice with a 3 px tone edge; the title carries the meaning in words, never colour alone. */
export function notice(tone: Tone, title: string, body?: string): Block {
  const t = TONE[tone];
  const bodyHtml = body
    ? `<div class="sk-ink2" style="margin-top:4px;font-size:15px;line-height:22px;color:${PAPER.ink2};">${inlineHtml(body)}</div>`
    : "";
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;border-collapse:collapse;"><tr><td class="sk-notice" style="border-left:3px solid ${t.fg};background:${t.bg};padding:12px 14px;font-family:${FONT_UI};"><div style="font-size:15px;line-height:22px;font-weight:700;color:${t.fg};">${escapeHtml(title)}</div>${bodyHtml}</td></tr></table>`,
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

/** Large monospace code (password reset). */
export function code(value: string, label: string): Block {
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px;border-collapse:collapse;"><tr><td class="sk-code" style="border:1px solid ${PAPER.line};background:${PAPER.header};padding:14px 20px;font-family:${FONT_MONO};font-size:28px;line-height:34px;letter-spacing:0.18em;font-weight:700;color:${PAPER.ink1};" aria-label="${escapeHtml(label)}">${escapeHtml(value)}</td></tr></table>`,
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

const DARK_CSS = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  @media only screen and (max-width: 620px) {
    .sk-shell { width: 100% !important; }
    .sk-pad { padding-left: 20px !important; padding-right: 20px !important; }
    .sk-outer { padding: 0 !important; }
    .sk-panel { border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
  }
  @media (prefers-color-scheme: dark) {
    .sk-body, .sk-outer { background: ${NIGHT.bg} !important; }
    .sk-panel { background: ${NIGHT.panel} !important; border-color: ${NIGHT.line} !important; }
    .sk-head, .sk-code { background: ${NIGHT.header} !important; border-color: ${NIGHT.line} !important; }
    .sk-ink1, .sk-code { color: ${NIGHT.ink1} !important; }
    .sk-mark { background: ${NIGHT.ink1} !important; }
    .sk-ink2 { color: ${NIGHT.ink2} !important; }
    .sk-ink3 { color: ${NIGHT.ink3} !important; }
    .sk-line, .sk-rule { border-color: ${NIGHT.line} !important; }
    .sk-link { color: ${NIGHT.accentText} !important; }
    .sk-notice { background: ${NIGHT.header} !important; }
  }
`;

const block = (w: number, h: number, color: string, cls = "") =>
  `<div${cls ? ` class="${cls}"` : ""} style="width:${w}px;height:${h}px;background:${color};font-size:0;line-height:0;">&nbsp;</div>`;

/**
 * The „izvučen deo“ mark (DS §2.2) as table cells — SVG is stripped by several clients:
 * the orange part lifted above its slot in the ink base.
 */
const MARK = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td colspan="3" style="padding:0 5px 3px;">${block(10, 5, PAPER.accent)}</td></tr><tr><td valign="bottom">${block(5, 8, PAPER.ink1, "sk-mark")}</td><td valign="bottom">${block(10, 5, PAPER.ink1, "sk-mark")}</td><td valign="bottom">${block(5, 8, PAPER.ink1, "sk-mark")}</td></tr></table>`;

/** Hidden preview text followed by filler so clients do not pull body copy into the preview. */
function preheaderHtml(value: string): string {
  const filler = "&#847;&zwnj;&nbsp;".repeat(60);
  return `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${PAPER.bg};">${escapeHtml(value)}${filler}</div>`;
}

export function layout(input: LayoutInput): RenderedEmail {
  const brand = escapeHtml(input.brandName.toUpperCase());
  const home = escapeHtml(safeHref(input.siteUrl));
  const reference = input.reference
    ? `<td align="right" class="sk-ink3" style="font-family:${FONT_MONO};font-size:13px;line-height:20px;color:${PAPER.ink3};white-space:nowrap;">${escapeHtml(input.reference)}</td>`
    : "";
  const company = input.companyLines.filter((l) => l.trim() !== "");
  const contactsHtml = input.contacts
    .map((c) =>
      c.href
        ? `${escapeHtml(c.label)}: <a href="${escapeHtml(safeHref(c.href))}" class="sk-link" style="${linkStyle()}">${escapeHtml(c.value)}</a>`
        : `${escapeHtml(c.label)}: ${escapeHtml(c.value)}`,
    )
    .join(" &nbsp;·&nbsp; ");
  const footerLines = [
    company.length
      ? `<div class="sk-ink2" style="font-weight:600;color:${PAPER.ink2};">${company.map(escapeHtml).join("<br>")}</div>`
      : `<div class="sk-ink2" style="font-weight:600;color:${PAPER.ink2};">${escapeHtml(input.brandName)}</div>`,
    contactsHtml ? `<div style="margin-top:6px;">${contactsHtml}</div>` : "",
    input.hoursText
      ? `<div style="margin-top:6px;">Radno vreme: ${escapeHtml(input.hoursText)}</div>`
      : "",
    `<div style="margin-top:12px;">${escapeHtml(input.reason)}${
      input.manageLink
        ? ` <a href="${escapeHtml(safeHref(input.manageLink.href))}" class="sk-link" style="${linkStyle()}">${escapeHtml(input.manageLink.label)}</a>`
        : ""
    }</div>`,
  ]
    .filter(Boolean)
    .join("");

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
<style>${DARK_CSS}</style>
</head>
<body class="sk-body" style="margin:0;padding:0;background:${PAPER.bg};">
${preheaderHtml(input.preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sk-outer" bgcolor="${PAPER.bg}" style="background:${PAPER.bg};padding:24px 12px;">
<tr><td align="center">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sk-shell" style="max-width:600px;width:100%;">
<tr><td class="sk-panel" bgcolor="${PAPER.panel}" style="background:${PAPER.panel};border:1px solid ${PAPER.line};border-radius:6px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td class="sk-pad sk-head sk-line" style="padding:18px 32px;border-bottom:1px solid ${PAPER.line};background:${PAPER.header};border-radius:6px 6px 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td><a href="${home}" style="text-decoration:none;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td valign="bottom" style="padding:0 10px 3px 0;" aria-hidden="true">${MARK}</td><td class="sk-ink1" style="font-family:${FONT_DISPLAY};font-size:20px;line-height:24px;font-weight:900;letter-spacing:2px;color:${PAPER.ink1};">${brand}</td></tr></table></a></td>
${reference}
</tr></table>
</td></tr>
<tr><td class="sk-pad" style="padding:28px 32px 12px;font-family:${FONT_UI};">
${input.body.html}
</td></tr>
<tr><td class="sk-pad sk-ink3 sk-line" style="padding:18px 32px 24px;border-top:1px solid ${PAPER.line};font-family:${FONT_UI};font-size:13px;line-height:20px;color:${PAPER.ink3};">
${footerLines}
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
    input.reason + (input.manageLink ? ` ${input.manageLink.label}: ${input.manageLink.href}` : ""),
  ].join("\n");

  return {
    subject: input.subject,
    preheader: input.preheader,
    html,
    text: `${input.body.text}\n\n${textFooter}\n`,
  };
}
