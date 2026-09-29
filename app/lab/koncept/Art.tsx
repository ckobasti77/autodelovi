// Concept-only vector art: the brand mark (drafting centre mark) and part thumbnails drawn in the
// X-ray language. Real thumbnails are Blender renders from step 08 (public/images/parts/*).
import type { DemoProduct } from "./data";

/** Brand mark: the drafting centre mark — a circle crossed by centre lines, the symbol a drawing
 *  uses to locate the centre of a disc, bore or wheel. Ink in currentColor; the only orange is the
 *  centre point ("you are here"). Independent of the (renamable) brand name. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="6.25" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 1.5v6M12 16.5v6M1.5 12h6M16.5 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <circle cx="12" cy="12" r="2" fill="#FF6B1A" />
    </svg>
  );
}

const edge = { fill: "none", stroke: "#969088", strokeOpacity: 0.7, strokeWidth: 1, vectorEffect: "non-scaling-stroke" as const };
const solid = { fill: "#2b3138", stroke: "#969088", strokeWidth: 1, vectorEffect: "non-scaling-stroke" as const };
const dark = { fill: "#1c2025", stroke: "#6e767f", strokeWidth: 1, vectorEffect: "non-scaling-stroke" as const };

export function PartArt({ art, className }: { art: DemoProduct["art"]; className?: string }) {
  return (
    <svg viewBox="0 0 200 150" className={className} aria-hidden="true" focusable="false">
      {art === "disc" && (
        <g>
          <circle cx="100" cy="75" r="66" {...solid} />
          <circle cx="100" cy="75" r="58" {...edge} />
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i / 24) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={100 + Math.cos(a) * 38}
                y1={75 + Math.sin(a) * 38}
                x2={100 + Math.cos(a) * 56}
                y2={75 + Math.sin(a) * 56}
                stroke="#434a52"
                strokeWidth="1"
              />
            );
          })}
          <circle cx="100" cy="75" r="30" {...dark} />
          <circle cx="100" cy="75" r="12" fill="#101215" stroke="#6e767f" />
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
            return <circle key={i} cx={100 + Math.cos(a) * 21} cy={75 + Math.sin(a) * 21} r="3" fill="#101215" stroke="#6e767f" />;
          })}
        </g>
      )}
      {art === "pads" && (
        <g>
          <path d="M40 58 Q100 30 160 58 L152 96 Q100 74 48 96 Z" {...solid} />
          <path d="M46 64 Q100 40 154 64" {...edge} />
          <path d="M52 106 Q100 86 148 106 L144 120 Q100 102 56 120 Z" {...dark} />
          <line x1="100" y1="44" x2="100" y2="84" stroke="#434a52" />
        </g>
      )}
      {art === "filter" && (
        <g>
          <path d="M66 36 H134 V112 Q134 122 124 122 H76 Q66 122 66 112 Z" {...solid} />
          <ellipse cx="100" cy="36" rx="34" ry="9" {...dark} />
          <ellipse cx="100" cy="36" rx="12" ry="3.5" fill="#101215" stroke="#6e767f" />
          {[52, 64, 76, 88, 100].map((y) => (
            <line key={y} x1="70" y1={y} x2="130" y2={y} stroke="#434a52" />
          ))}
          <path d="M66 44 V112" {...edge} />
        </g>
      )}
      {art === "turbo" && (
        <g>
          <path d="M100 30 A45 45 0 1 1 55 75 L55 104 H40 V64 H58 A45 45 0 0 1 100 30 Z" {...solid} />
          <circle cx="100" cy="75" r="28" {...dark} />
          <circle cx="100" cy="75" r="12" fill="#101215" stroke="#6e767f" />
          <path d="M100 47 A28 28 0 0 1 128 75" {...edge} />
          <rect x="140" y="64" width="26" height="22" rx="3" {...dark} />
        </g>
      )}
    </svg>
  );
}
