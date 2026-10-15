import "server-only";

/**
 * OG image frame (DESIGN-SYSTEM §2.7, SEO-ADS §J1): 1200 × 630, graphite ground, 1 px frame
 * with corner ticks, the horizontal logo (star ring, EUROMOTORS / PLUS — OEM Parts), a caps title in Archivo Expanded, a mono meta line, a count
 * line, the render/photo in a 440 px drawing box and a ruler with the domain and the tagline.
 * Never shows a price. Rendered with `next/og` (Node runtime; WebP inputs are converted to
 * PNG with sharp because the renderer cannot decode WebP).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";

import { LOGO_HORIZONTAL } from "@/components/brand/logoPaths";
import { site } from "@/config/site";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

const INK_1 = "#F1ECE3";
const INK_2 = "#C4BEB4";
const INK_3 = "#969088";
const LINE = "#2C3238";
const LINE_STRONG = "#434A52";
const BG = "#0D0F11";

type Font = { name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" };

let fonts: Promise<Font[]> | null = null;

function loadFonts(): Promise<Font[]> {
  fonts ??= (async () => {
    const dir = join(process.cwd(), "assets", "fonts", "og");
    const read = (file: string) => readFile(join(dir, file));
    const [expanded700, condensed600, monoLatin, monoExt, sansLatin, sansExt] = await Promise.all([
      read("archivo-expanded-700.woff"),
      read("archivo-condensed-600.woff"),
      read("martian-mono-latin-400-normal.woff"),
      read("martian-mono-latin-ext-400-normal.woff"),
      read("public-sans-latin-600-normal.woff"),
      read("public-sans-latin-ext-600-normal.woff"),
    ]);
    return [
      { name: "Archivo Expanded", data: expanded700, weight: 700, style: "normal" },
      { name: "Archivo Condensed", data: condensed600, weight: 600, style: "normal" },
      // The Latin Extended files get their own family names, listed after the Latin ones in
      // every font-family stack: two files under one name made the renderer take „Š“ from a
      // different font instead of the extended file (SEO-08).
      { name: "Martian Mono", data: monoLatin, weight: 400, style: "normal" },
      { name: "Martian Mono Ext", data: monoExt, weight: 400, style: "normal" },
      { name: "Public Sans", data: sansLatin, weight: 600, style: "normal" },
      { name: "Public Sans Ext", data: sansExt, weight: 600, style: "normal" },
    ];
  })();
  return fonts;
}

/**
 * A PNG data URI for a `/public` path or an absolute URL (Convex storage); null when the
 * image cannot be read — the frame then shows the empty drawing box.
 */
/** Remote OG inputs come only from this deployment's Convex file storage (no open fetch). */
function isConvexStorageUrl(src: string): boolean {
  try {
    const url = new URL(src);
    const convex = process.env.NEXT_PUBLIC_CONVEX_URL;
    return (
      url.protocol === "https:" &&
      !!convex &&
      url.host === new URL(convex).host &&
      url.pathname.startsWith("/api/storage/")
    );
  } catch {
    return false;
  }
}

const MAX_REMOTE_BYTES = 10 * 1024 * 1024;

export async function ogImageData(
  src: string | null | undefined,
  box = 440,
): Promise<string | null> {
  if (!src) return null;
  try {
    let input: Buffer;
    if (/^https?:\/\//.test(src)) {
      if (!isConvexStorageUrl(src)) return null;
      const res = await fetch(src, { cache: "no-store", redirect: "error" });
      if (!res.ok) return null;
      if (Number(res.headers.get("content-length") ?? "0") > MAX_REMOTE_BYTES) return null;
      input = Buffer.from(await res.arrayBuffer());
      if (input.byteLength > MAX_REMOTE_BYTES) return null;
    } else if (src.startsWith("/") && !src.includes("..")) {
      input = await readFile(join(process.cwd(), "public", src));
    } else {
      return null;
    }
    const png = await sharp(input)
      .resize(box, box, { fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/** The public domain for the ruler line; omitted while the site runs on localhost. */
function domainLabel(): string {
  try {
    const host = new URL(site.url).host;
    return /^(localhost|127\.|0\.0\.0\.0)/.test(host) ? "" : host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export type OgFrameInput = {
  title: string;
  /** Mono meta line, e.g. „OEM 5Q0 615 301 F · Brembo“; `code` is highlighted. */
  meta?: { label?: string; code?: string; after?: string } | null;
  count?: string | null;
  image?: string | null;
  tagline?: string;
  /**
   * `upper` (default) sets the title in display caps like category and landing H1s;
   * `sentence` keeps it as written — product names, whose H1 is sentence case and whose units
   * must not turn into „MM“ (COPY-15).
   */
  titleCase?: "upper" | "sentence";
};

const MONO = "Martian Mono, Martian Mono Ext";
const SANS = "Public Sans, Public Sans Ext";
const NBSP = String.fromCharCode(0xa0);

/**
 * Keeps a dimension or a value with its unit on one line: „2.0 TDI“ stays breakable, but
 * „24 mm“, „110 kW“ and „276 × 24“ never wrap apart (COPY-15).
 */
export function glueUnits(text: string): string {
  return text
    .replace(/(\d)\s+×\s+(?=\d)/g, `$1${NBSP}×${NBSP}`)
    .replace(/(\d)\s+(mm|cm|m|kW|KS|V|Ah|A|W|l|kg|Nm|°)(?=$|[\s,.;)])/g, `$1${NBSP}$2`);
}

/** Height of the logo in the frame (§2.7): the second line „PLUS — OEM Parts“ still reads. */
const LOGO_HEIGHT = 64;

/** The horizontal lockup (night variant), drawn from the same outlines as the site's logo. */
function Logo() {
  const l = LOGO_HORIZONTAL;
  const width = Math.round((l.w / l.h) * LOGO_HEIGHT);
  return (
    <svg width={width} height={LOGO_HEIGHT} viewBox={`0 0 ${l.w} ${l.h}`}>
      <path fill={INK_1} fillRule="evenodd" d={l.d} />
    </svg>
  );
}

function Ruler() {
  const ticks = [];
  for (let x = 0; x <= 1056; x += 12) {
    ticks.push(
      <line key={x} x1={x + 0.5} y1="0" x2={x + 0.5} y2="8" stroke={LINE} strokeWidth="1" />,
    );
  }
  return (
    <svg width="1056" height="24" viewBox="0 0 1056 24">
      <line x1="0" y1="0.5" x2="1056" y2="0.5" stroke={LINE_STRONG} strokeWidth="1" />
      {ticks}
    </svg>
  );
}

const tick = (pos: Record<string, number>, borders: Record<string, string>) => (
  <div
    style={{
      position: "absolute",
      width: 14,
      height: 14,
      display: "flex",
      ...pos,
      ...borders,
    }}
  />
);

export async function ogFrame(input: OgFrameInput): Promise<ImageResponse> {
  const raw = input.title.length > 70 ? `${input.title.slice(0, 68).trim()}…` : input.title;
  const title = glueUnits(raw);
  const titleSize = title.length > 44 ? 42 : title.length > 28 ? 48 : 52;
  const domain = domainLabel();
  const border = `1px solid ${LINE_STRONG}`;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: BG,
        color: INK_1,
        fontFamily: SANS,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 32,
          left: 32,
          right: 32,
          bottom: 32,
          border: `1px solid ${LINE}`,
          display: "flex",
        }}
      />
      {tick({ top: 26, left: 26 }, { borderTop: border, borderLeft: border })}
      {tick({ top: 26, right: 26 }, { borderTop: border, borderRight: border })}
      {tick({ bottom: 26, left: 26 }, { borderBottom: border, borderLeft: border })}
      {tick({ bottom: 26, right: 26 }, { borderBottom: border, borderRight: border })}

      <div style={{ position: "absolute", top: 64, left: 72, display: "flex" }}>
        <Logo />
      </div>

      <div
        style={{
          position: "absolute",
          left: 72,
          top: 160,
          width: input.image ? 580 : 980,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            fontFamily: "Archivo Expanded",
            fontSize: titleSize,
            lineHeight: 1.02,
            textTransform: input.titleCase === "sentence" ? "none" : "uppercase",
            marginBottom: 6,
            display: "flex",
          }}
        >
          {title}
        </div>
        {input.meta ? (
          <div
            style={{
              display: "flex",
              fontFamily: MONO,
              fontSize: 22,
              color: INK_3,
              gap: 10,
            }}
          >
            {input.meta.label ? <span>{input.meta.label}</span> : null}
            {input.meta.code ? <span style={{ color: INK_2 }}>{input.meta.code}</span> : null}
            {input.meta.after ? <span>{`· ${input.meta.after}`}</span> : null}
          </div>
        ) : null}
        {input.count ? (
          <div style={{ display: "flex", fontSize: 22, color: INK_2, fontWeight: 600 }}>
            {input.count}
          </div>
        ) : null}
      </div>

      {input.image ? (
        <div
          style={{
            position: "absolute",
            right: 72,
            top: 64,
            width: 440,
            height: 440,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #1E2227",
            background:
              "radial-gradient(60% 60% at 50% 45%, #1A1E23 0%, #121518 60%, #0D0F11 100%)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>. */}
          <img src={input.image} alt="" width={400} height={400} style={{ objectFit: "contain" }} />
        </div>
      ) : null}

      <div style={{ position: "absolute", left: 72, bottom: 72, display: "flex" }}>
        <Ruler />
      </div>
      {domain ? (
        <div
          style={{
            position: "absolute",
            left: 72,
            bottom: 44,
            display: "flex",
            fontFamily: MONO,
            fontSize: 16,
            color: INK_3,
            letterSpacing: "0.04em",
          }}
        >
          {domain}
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          right: 72,
          bottom: 44,
          display: "flex",
          fontSize: 16,
          fontWeight: 600,
          color: INK_2,
        }}
      >
        {input.tagline ?? site.brand.tagline}
      </div>
    </div>,
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}
