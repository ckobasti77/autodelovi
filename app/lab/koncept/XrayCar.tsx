// Step 03 placeholder for the 3D hero: a side-elevation "X-ray" drawing of the generic compact
// hatchback, drawn in millimetres with the proportions from docs/3D-CONTRACT.md §F2
// (4280 × 1450 mm, wheelbase 2620 mm, 205/55 R16 ≈ Ø 632 mm). It demonstrates the art direction
// (rim-lit glass shell, solid parts, one selected category with a leader-line callout, true
// dimension lines) until the Blender poster and live 3D replace it in steps 08–10.
import type { CSSProperties } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import styles from "./koncept.module.css";

const GROUND = 1600; // SVG y of the ground plane; model y is measured upward from the ground
const TOP = 1960; // model y of the annotation lane above the roof (callout shelf)
const VB = { x: -80, y: GROUND - TOP - 40, w: 4700, h: TOP + 40 + 380 };
const FRONT_AXLE = 880;
const REAR_AXLE = 3500;
const WHEEL_R = 316;
const TURBO = { x: 960, y: 640, r: 74 };

/** Model point (x from the front bumper, y up from the ground, mm) → SVG coordinates. */
const p = (x: number, y: number) => `${x} ${GROUND - y}`;
/** Model point → CSS position (percent of the drawing box) for HTML labels. */
const at = (x: number, y: number): CSSProperties => ({
  left: `${((x - VB.x) / VB.w) * 100}%`,
  top: `${((GROUND - y - VB.y) / VB.h) * 100}%`,
});
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return p(cx + r * Math.cos(a), cy + r * Math.sin(a));
};
/** Annular sector (a brake caliper) between two radii and two angles, model space. */
const sector = (cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) =>
  `M ${polar(cx, cy, r1, a0)} A ${r1} ${r1} 0 0 0 ${polar(cx, cy, r1, a1)} L ${polar(cx, cy, r0, a1)} A ${r0} ${r0} 0 0 1 ${polar(cx, cy, r0, a0)} Z`;

const BODY = [
  `M ${p(70, 250)}`,
  `L ${p(22, 330)}`,
  `C ${p(4, 380)} ${p(0, 470)} ${p(6, 560)}`,
  `C ${p(12, 610)} ${p(30, 650)} ${p(60, 680)}`,
  `L ${p(120, 720)}`,
  `C ${p(150, 738)} ${p(170, 745)} ${p(200, 750)}`,
  `C ${p(600, 820)} ${p(1100, 930)} ${p(1395, 992)}`,
  `L ${p(1430, 1003)}`,
  `C ${p(1600, 1130)} ${p(1800, 1310)} ${p(1985, 1418)}`,
  `C ${p(2250, 1462)} ${p(2900, 1462)} ${p(3500, 1432)}`,
  `C ${p(3620, 1424)} ${p(3700, 1414)} ${p(3752, 1402)}`,
  `L ${p(3790, 1392)}`,
  `C ${p(3900, 1270)} ${p(4010, 1150)} ${p(4105, 1050)}`,
  `L ${p(4150, 1000)}`,
  `C ${p(4200, 930)} ${p(4240, 850)} ${p(4262, 770)}`,
  `C ${p(4285, 680)} ${p(4283, 520)} ${p(4272, 420)}`,
  `C ${p(4262, 350)} ${p(4240, 300)} ${p(4200, 285)}`,
  `L ${p(3867, 285)}`,
  `A 368 368 0 1 0 ${p(3133, 285)}`,
  `L ${p(1247, 285)}`,
  `A 368 368 0 1 0 ${p(513, 285)}`,
  `L ${p(160, 262)}`,
  "Z",
].join(" ");

const GLASS = [
  `M ${p(1470, 1010)}`,
  `C ${p(1640, 1140)} ${p(1800, 1270)} ${p(1965, 1372)}`,
  `C ${p(2300, 1402)} ${p(3000, 1400)} ${p(3420, 1372)}`,
  `C ${p(3500, 1366)} ${p(3560, 1340)} ${p(3590, 1300)}`,
  `L ${p(3520, 1040)}`,
  `C ${p(3100, 1022)} ${p(2200, 1012)} ${p(1470, 1010)}`,
  "Z",
].join(" ");

const PANEL_LINES = [
  `M ${p(1440, 1004)} C ${p(1400, 800)} ${p(1360, 560)} ${p(1300, 330)}`, // front door front edge
  `M ${p(2508, 1398)} L ${p(2526, 330)}`, // B-pillar / door split
  `M ${p(3440, 1030)} L ${p(3402, 730)} A 410 410 0 0 0 ${p(3115, 456)} L ${p(3115, 330)}`, // rear door
  `M ${p(3330, 1030)} L ${p(3370, 1382)}`, // quarter window divider
  `M ${p(420, 782)} C ${p(1500, 905)} ${p(3000, 915)} ${p(4150, 962)}`, // shoulder crease
  `M ${p(1262, 352)} L ${p(3118, 352)}`, // sill
  `M ${p(2150, 958)} L ${p(2290, 960)} M ${p(3050, 972)} L ${p(3180, 975)}`, // handles
].join(" ");

const LAMPS = [
  `M ${p(55, 690)} L ${p(200, 748)} L ${p(450, 802)} L ${p(468, 764)} L ${p(300, 704)} L ${p(80, 652)} Z`,
  `M ${p(4005, 1040)} L ${p(4150, 1000)} L ${p(4232, 880)} L ${p(4238, 850)} L ${p(4080, 905)} Z`,
];

function Wheel({ cx, disc }: { cx: number; disc: number }) {
  const spokes = [18, 90, 162, 234, 306];
  return (
    <g>
      <circle cx={cx} cy={GROUND - WHEEL_R} r={WHEEL_R} className="xr-tyre" />
      <circle cx={cx} cy={GROUND - WHEEL_R} r={206} className="xr-rim" />
      {spokes.map((deg) => (
        <path key={deg} d={`M ${polar(cx, WHEEL_R, 62, deg)} L ${polar(cx, WHEEL_R, 198, deg)}`} className="xr-spoke" />
      ))}
      <circle cx={cx} cy={GROUND - WHEEL_R} r={disc} className="xr-disc" />
      <circle cx={cx} cy={GROUND - WHEEL_R} r={disc * 0.42} className="xr-hat" />
      <path d={sector(cx, WHEEL_R, disc * 0.62, disc + 18, -24, 42)} className="xr-caliper" />
      <circle cx={cx} cy={GROUND - WHEEL_R} r={34} className="xr-hub" />
    </g>
  );
}

const TICKS = Array.from({ length: 44 }, (_, i) => i * 100);

export function XrayCar() {
  return (
    <div className={styles.drawing}>
      <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} role="img" aria-labelledby="xray-title" focusable="false">
        <title id="xray-title">
          Rendgenski prikaz automobila sa strane: providna karoserija i delovi unutra. Dužina 4280 mm, međuosovinsko rastojanje 2620 mm, visina 1450 mm.
        </title>
        <defs>
          <linearGradient id="shellFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9fe9ff" stopOpacity="0.09" />
            <stop offset="0.55" stopColor="#4db5d6" stopOpacity="0.04" />
            <stop offset="1" stopColor="#123642" stopOpacity="0.16" />
          </linearGradient>
          <radialGradient id="floorGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#9fe9ff" stopOpacity="0.09" />
            <stop offset="1" stopColor="#9fe9ff" stopOpacity="0" />
          </radialGradient>
          <filter id="rimGlow" x="-10%" y="-20%" width="120%" height="140%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
        </defs>
        <style>{`
          .xr-tyre { fill: #101215; stroke: #434a52; stroke-width: 1; vector-effect: non-scaling-stroke; }
          .xr-rim { fill: none; stroke: #6e767f; stroke-width: 0.9; vector-effect: non-scaling-stroke; }
          .xr-spoke { stroke: #6e767f; stroke-width: 0.9; vector-effect: non-scaling-stroke; }
          .xr-disc { fill: #2b3138; stroke: #969088; stroke-width: 0.9; vector-effect: non-scaling-stroke; }
          .xr-hat { fill: #23282e; stroke: #6e767f; stroke-width: 0.8; vector-effect: non-scaling-stroke; }
          .xr-hub { fill: #16191d; stroke: #6e767f; stroke-width: 0.8; vector-effect: non-scaling-stroke; }
          .xr-caliper { fill: #434a52; stroke: #969088; stroke-width: 0.8; vector-effect: non-scaling-stroke; }
          .xr-part { fill: #262b31; stroke: #8f949a; stroke-width: 0.9; vector-effect: non-scaling-stroke; }
          .xr-partLight { fill: #343b43; stroke: #b0aaa1; stroke-width: 0.9; vector-effect: non-scaling-stroke; }
          .xr-partGhost { fill: #22272c; fill-opacity: 0.7; stroke: #6e767f; stroke-width: 0.8; vector-effect: non-scaling-stroke; }
          .xr-pipe { fill: none; stroke: #8f949a; stroke-width: 1.2; vector-effect: non-scaling-stroke; }
          .xr-spring { fill: none; stroke: #b0aaa1; stroke-width: 0.9; vector-effect: non-scaling-stroke; }
          .xr-fin { stroke: #4f565e; stroke-width: 0.7; vector-effect: non-scaling-stroke; }
          .xr-selected { fill: #3a2012; stroke: #ff6b1a; stroke-width: 1.4; vector-effect: non-scaling-stroke; }
          .xr-selectedCore { fill: #ff6b1a; stroke: #ffb38a; stroke-width: 0.8; vector-effect: non-scaling-stroke; }
          .xr-selectedPipe { fill: none; stroke: #ff6b1a; stroke-width: 1.4; vector-effect: non-scaling-stroke; }
          .xr-shell { fill: url(#shellFill); stroke: #9fe9ff; stroke-width: 1.25; vector-effect: non-scaling-stroke; }
          .xr-shellGlow { fill: none; stroke: #4db5d6; stroke-width: 22; opacity: 0.32; }
          .xr-glass { fill: #9fe9ff; fill-opacity: 0.05; stroke: #9fe9ff; stroke-opacity: 0.7; stroke-width: 0.8; vector-effect: non-scaling-stroke; }
          .xr-panel { fill: none; stroke: #9fe9ff; stroke-opacity: 0.3; stroke-width: 0.8; vector-effect: non-scaling-stroke; }
          .xr-lamp { fill: #9fe9ff; fill-opacity: 0.1; stroke: #9fe9ff; stroke-opacity: 0.55; stroke-width: 0.8; vector-effect: non-scaling-stroke; }
          .xr-ground { stroke: #434a52; stroke-width: 1; vector-effect: non-scaling-stroke; }
          .xr-tick { stroke: #2c3238; stroke-width: 1; vector-effect: non-scaling-stroke; }
          .xr-tickMajor { stroke: #434a52; stroke-width: 1; vector-effect: non-scaling-stroke; }
          .xr-dim { stroke: #6e767f; stroke-width: 0.8; vector-effect: non-scaling-stroke; fill: none; }
          .xr-ext { stroke: #434a52; stroke-width: 0.7; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
          .xr-leader { stroke: #ff6b1a; stroke-width: 1; fill: none; vector-effect: non-scaling-stroke; }
          .xr-anchor { fill: #ff6b1a; stroke: #0d0f11; stroke-width: 2; vector-effect: non-scaling-stroke; }
          @media (max-width: 639px) {
            .xr-leader, .xr-anchor { display: none; }
            .xr-selected { fill: #343b43; stroke: #b0aaa1; stroke-width: 0.9; }
            .xr-selectedCore { fill: #262b31; stroke: #8f949a; }
            .xr-selectedPipe { stroke: #8f949a; stroke-width: 1.2; }
          }
        `}</style>

        {/* floor with a true-scale ruler (ticks every 100 mm) */}
        <ellipse cx={2140} cy={GROUND} rx={2600} ry={150} fill="url(#floorGlow)" />
        <line x1={-60} y1={GROUND} x2={4560} y2={GROUND} className="xr-ground" />
        {TICKS.map((x) => (
          <line
            key={x}
            x1={x}
            y1={GROUND}
            x2={x}
            y2={GROUND + (x % 1000 === 0 ? 70 : x % 500 === 0 ? 45 : 22)}
            className={x % 500 === 0 ? "xr-tickMajor" : "xr-tick"}
          />
        ))}

        {/* solid parts, drawn under the glass shell */}
        <g>
          <rect x={2760} y={GROUND - 520} width={520} height={220} rx={40} className="xr-partGhost" />
          <path d={`M ${p(2050, 480)} L ${p(2520, 480)} L ${p(2520, 620)} L ${p(2050, 620)} Z M ${p(2420, 600)} L ${p(2520, 610)} L ${p(2640, 1180)} L ${p(2560, 1210)} Z`} className="xr-partGhost" />
          <path d={`M ${p(2800, 530)} L ${p(3300, 530)} L ${p(3300, 640)} L ${p(2800, 640)} Z M ${p(3250, 620)} L ${p(3330, 630)} L ${p(3400, 1100)} L ${p(3330, 1130)} Z`} className="xr-partGhost" />
          <path d={`M ${p(1430, 1000)} C ${p(1600, 960)} ${p(1800, 940)} ${p(1960, 900)}`} className="xr-pipe" />
          <path d={`M ${p(1100, 500)} L ${p(1720, 1010)}`} className="xr-pipe" />
          <ellipse cx={1740} cy={GROUND - 1040} rx={26} ry={180} transform={`rotate(-24 1740 ${GROUND - 1040})`} className="xr-partLight" />
          {/* exhaust with DPF and rear silencer */}
          <path d={`M ${p(1010, 590)} C ${p(1060, 420)} ${p(1100, 300)} ${p(1180, 262)} L ${p(3960, 258)} C ${p(4080, 262)} ${p(4160, 270)} ${p(4230, 290)}`} className="xr-pipe" />
          <rect x={1120} y={GROUND - 305} width={480} height={92} rx={30} className="xr-partLight" />
          <rect x={3720} y={GROUND - 330} width={460} height={100} rx={36} className="xr-partLight" />
          {/* engine: sump, block, head, cover */}
          <rect x={380} y={GROUND - 425} width={400} height={75} rx={14} className="xr-part" />
          <rect x={320} y={GROUND - 720} width={550} height={295} rx={10} className="xr-partLight" />
          <rect x={345} y={GROUND - 870} width={505} height={150} rx={10} className="xr-part" />
          <rect x={370} y={GROUND - 915} width={450} height={48} rx={22} className="xr-partLight" />
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={450 + i * 110} y1={GROUND - 440} x2={450 + i * 110} y2={GROUND - 700} className="xr-fin" />
          ))}
          {/* gearbox (DSG), ghosted where it overlaps the engine */}
          <path d={`M ${p(640, 380)} L ${p(1080, 395)} L ${p(1120, 560)} L ${p(980, 660)} L ${p(700, 640)} Z`} className="xr-partGhost" />
          {/* radiator + intercooler */}
          <rect x={170} y={GROUND - 760} width={60} height={440} rx={6} className="xr-part" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <line key={i} x1={172} y1={GROUND - 360 - i * 50} x2={228} y2={GROUND - 360 - i * 50} className="xr-fin" />
          ))}
          <rect x={80} y={GROUND - 520} width={78} height={220} rx={6} className="xr-partGhost" />
          {/* battery */}
          <rect x={1030} y={GROUND - 900} width={200} height={170} rx={8} className="xr-part" />
          <rect x={1055} y={GROUND - 925} width={34} height={25} className="xr-partLight" />
          <rect x={1170} y={GROUND - 925} width={34} height={25} className="xr-partLight" />
          {/* suspension struts */}
          <path d={`M ${p(905, 470)} L ${p(1000, 930)}`} className="xr-pipe" />
          <path
            d={`M ${p(925, 560)} L ${p(985, 590)} L ${p(935, 630)} L ${p(995, 660)} L ${p(945, 700)} L ${p(1005, 730)} L ${p(955, 770)} L ${p(1015, 800)}`}
            className="xr-spring"
          />
          <path d={`M ${p(3470, 420)} L ${p(3440, 790)}`} className="xr-pipe" />
          <path
            d={`M ${p(3425, 480)} L ${p(3495, 505)} L ${p(3420, 540)} L ${p(3490, 565)} L ${p(3415, 600)} L ${p(3485, 625)}`}
            className="xr-spring"
          />
          {/* steering rack + driveshaft */}
          <rect x={990} y={GROUND - 520} width={150} height={48} rx={12} className="xr-part" />
          <path d={`M ${p(FRONT_AXLE, WHEEL_R)} L ${p(900, 420)}`} className="xr-pipe" />
          {/* turbocharger — the selected category in this frame (housing, wheel, outlet) */}
          <circle cx={TURBO.x} cy={GROUND - TURBO.y} r={TURBO.r} className="xr-selected" />
          <circle cx={TURBO.x} cy={GROUND - TURBO.y} r={34} className="xr-selectedCore" />
          <path d={`M ${p(TURBO.x + TURBO.r, TURBO.y + 12)} L ${p(TURBO.x + 150, TURBO.y + 12)}`} className="xr-selectedPipe" />
        </g>

        <Wheel cx={FRONT_AXLE} disc={156} />
        <Wheel cx={REAR_AXLE} disc={136} />

        {/* X-ray shell: glow, body, glass, B-pillar, panel lines, lamps */}
        <path d={BODY} className="xr-shellGlow" filter="url(#rimGlow)" />
        <path d={BODY} className="xr-shell" />
        <path d={GLASS} className="xr-glass" />
        <path d={`M ${p(2470, 1014)} L ${p(2545, 1016)} L ${p(2555, 1392)} L ${p(2482, 1394)} Z`} className="xr-shell" />
        <path d={PANEL_LINES} className="xr-panel" />
        {LAMPS.map((d) => (
          <path key={d} d={d} className="xr-lamp" />
        ))}

        {/* dimension lines (true proportions, mm, values without grouping as on drawings) */}
        <g>
          <g className={styles.dimWheelbase}>
            <line x1={FRONT_AXLE} y1={GROUND + 20} x2={FRONT_AXLE} y2={GROUND + 200} className="xr-ext" />
            <line x1={REAR_AXLE} y1={GROUND + 20} x2={REAR_AXLE} y2={GROUND + 200} className="xr-ext" />
            <line x1={FRONT_AXLE} y1={GROUND + 180} x2={REAR_AXLE} y2={GROUND + 180} className="xr-dim" />
            <path d={`M ${FRONT_AXLE - 22} ${GROUND + 202} l 44 -44 M ${REAR_AXLE - 22} ${GROUND + 202} l 44 -44`} className="xr-dim" />
          </g>
          <line x1={0} y1={GROUND - 250} x2={0} y2={GROUND + 320} className="xr-ext" />
          <line x1={4280} y1={GROUND - 420} x2={4280} y2={GROUND + 320} className="xr-ext" />
          <line x1={0} y1={GROUND + 300} x2={4280} y2={GROUND + 300} className="xr-dim" />
          <path d={`M -22 ${GROUND + 322} l 44 -44 M ${4280 - 22} ${GROUND + 322} l 44 -44`} className="xr-dim" />
          <line x1={2800} y1={GROUND - 1452} x2={4500} y2={GROUND - 1452} className="xr-ext" />
          <line x1={4480} y1={GROUND} x2={4480} y2={GROUND - 1452} className="xr-dim" />
          <path d={`M 4458 ${GROUND + 22} l 44 -44 M 4458 ${GROUND - 1430} l 44 -44`} className="xr-dim" />
        </g>

        {/* callout leader to the selected category: straight up through the bonnet, then a shelf */}
        <path d={`M ${p(TURBO.x, TURBO.y + TURBO.r)} L ${p(TURBO.x, TOP)} L ${p(TURBO.x - 560, TOP)}`} className="xr-leader" />
        <circle cx={TURBO.x} cy={GROUND - TURBO.y - TURBO.r} r={22} className="xr-anchor" />
      </svg>

      <span className={`${styles.dimLabel} ${styles.dimWheelbase}`} style={at((FRONT_AXLE + REAR_AXLE) / 2, -180)} aria-hidden="true">
        2620
      </span>
      <span className={styles.dimLabel} style={at(2140, -300)} aria-hidden="true">
        4280
      </span>
      <span className={`${styles.dimLabel} ${styles.dimLabelVertical}`} style={at(4480, 726)} aria-hidden="true">
        1450
      </span>

      <div className={styles.callout} style={at(TURBO.x - 560, TOP)}>
        <span className={styles.calloutTitle}>Turbina (turbopunjač)</span>
        <span className={styles.calloutMeta}>Pre zamene proverite broj na kućištu turbine.</span>
        <a className={styles.calloutLink} href="#kartice">
          12 artikala za Golf VII
          <ArrowRight size={14} weight="bold" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
