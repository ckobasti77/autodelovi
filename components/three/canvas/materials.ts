/**
 * Runtime materials (DESIGN-SYSTEM §7.2, §7.3, §7.5).
 *
 * X-ray shell and glass: MeshBasicMaterial + shader injection that reproduces the poster
 * material (`3d/blender/lib/views.py` `xray_material`) and how the poster layer was made:
 * Blender mixes Transparent with Add(Emission E, Mix(Transparent, Glossy G, env)) by α, so a
 * pixel is only env·α opaque and its straight colour is E/env + G (tone-mapped, then blended
 * "over" in display space — exactly what three.js does per fragment). E = mix(tint → rim) by an
 * N·V fresnel, α = mix(base → 0.92) by the same rim, back faces at half α, G = the studio
 * reflection at world strength 0.6 (D99). Unlit, so it costs a fraction of a PBR pass on
 * phones (§7.2 budget ≤ 1.5 ms on the mid tier).
 *
 * Parts: the glTF PBR materials, cloned per category so hover/selection can tint a whole
 * category (rim + emissive in accent orange) and dim everything else — uniforms only, no
 * post-processing, one shader program per material feature set.
 */
import {
  AddOperation,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";

import { DOCK, HIGHLIGHT, LIGHT_RIG, XRAY, XRAY_RUNTIME } from "@/constants/xray";

type Uniform<T> = { value: T };

/** Uniforms shared by every material of one kind (one tween updates all of them). */
export type SharedUniforms = {
  /** Body shell base alpha (0.22 → 0.10 during stage 1). */
  bodyBaseAlpha: Uniform<number>;
  /** 0 → 1 while a category is selected: shell base alpha → 0.06 (§7.5). */
  selectFade: Uniform<number>;
  highlightColor: Uniform<Color>;
};

export function createSharedUniforms(): SharedUniforms {
  return {
    bodyBaseAlpha: { value: XRAY.body.baseAlpha },
    selectFade: { value: 0 },
    highlightColor: { value: new Color(HIGHLIGHT.color) },
  };
}

/** Per-category highlight state. */
export type HighlightUniforms = {
  hover: Uniform<number>;
  select: Uniform<number>;
  dim: Uniform<number>;
  /** 0 on the car … 1 seated in a grid slot (HERO-V2 §6.3). */
  dock: Uniform<number>;
};

export function createHighlightUniforms(): HighlightUniforms {
  return { hover: { value: 0 }, select: { value: 0 }, dim: { value: 0 }, dock: { value: 0 } };
}

const DOCK_FILL = `vec3( ${DOCK.fill.map((v) => v.toFixed(2)).join(", ")} )`;

export type XrayKind = "body" | "glass";

export type XrayOptions = {
  kind: XrayKind;
  mobile: boolean;
  envMap: Texture | null;
  shared: SharedUniforms;
  highlight: HighlightUniforms;
};

/** X-ray shell/glass material (transparent, no depth write, both faces in two passes). */
export function createXrayMaterial(o: XrayOptions): MeshBasicMaterial {
  const v = o.kind === "body" ? XRAY.body : XRAY.glass;
  const rimPower = o.kind === "body" && o.mobile ? XRAY.body.rimPowerMobile : v.rimPower;
  const material = new MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    envMap: o.envMap,
    combine: AddOperation,
    // Straight colour carries the full glossy reflection of the world at strength 0.6.
    reflectivity: LIGHT_RIG.environmentIntensity,
  });
  material.name = o.kind === "body" ? "sk_xray_body" : "sk_xray_glass";
  const uniforms = {
    uXrTint: { value: new Color(v.tint) },
    uXrRim: { value: new Color(v.rim) },
    uXrRimPower: { value: rimPower },
    uXrRimScale: { value: v.rimScale },
    uXrBaseAlpha: o.kind === "body" ? o.shared.bodyBaseAlpha : { value: XRAY.glass.baseAlpha },
    uXrSelectFade: o.shared.selectFade,
    uXrSelectedAlpha: { value: XRAY_RUNTIME.selectedBaseAlpha },
    uXrRimAlpha: { value: XRAY_RUNTIME.rimAlpha },
    uXrBackAlpha: { value: XRAY_RUNTIME.backFaceAlpha },
    uXrEnv: { value: XRAY.env },
    uHiColor: o.shared.highlightColor,
    uHiHover: o.highlight.hover,
    uHiSelect: o.highlight.select,
    uXrDock: o.highlight.dock,
    uXrDockColor: { value: new Color(o.kind === "body" ? DOCK.primer : DOCK.glassTint) },
    uXrDockAlpha: { value: o.kind === "body" ? DOCK.bodyAlpha : DOCK.glassAlpha },
  };
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vXrN;\nvarying vec3 vXrV;",
      )
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvXrN = normalize( normalMatrix * normal );\nvXrV = - mvPosition.xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vXrN;
varying vec3 vXrV;
uniform vec3 uXrTint;
uniform vec3 uXrRim;
uniform float uXrRimPower;
uniform float uXrRimScale;
uniform float uXrBaseAlpha;
uniform float uXrSelectFade;
uniform float uXrSelectedAlpha;
uniform float uXrRimAlpha;
uniform float uXrBackAlpha;
uniform float uXrEnv;
uniform vec3 uHiColor;
uniform float uHiHover;
uniform float uHiSelect;
uniform float uXrDock;
uniform vec3 uXrDockColor;
uniform float uXrDockAlpha;`,
      )
      .replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        `float xrNdv = abs( dot( normalize( vXrN ), normalize( vXrV ) ) );
float xrRim = clamp( pow( clamp( 1.0 - xrNdv, 0.0, 1.0 ), uXrRimPower ) * uXrRimScale, 0.0, 1.0 );
float xrHi = clamp( max( uHiHover * ${HIGHLIGHT.hoverRim.toFixed(2)}, uHiSelect * ${HIGHLIGHT.selectedRim.toFixed(2)} ), 0.0, 1.0 );
vec3 xrCol = mix( mix( uXrTint, uXrRim, xrRim ), uHiColor, xrRim * xrHi );
xrCol += uHiColor * ( uHiHover * ${HIGHLIGHT.hoverEmissive.toFixed(2)} + uHiSelect * ${HIGHLIGHT.selectedEmissive.toFixed(2)} );
float xrBase = mix( uXrBaseAlpha, min( uXrBaseAlpha, uXrSelectedAlpha ), uXrSelectFade );
float xrAlpha = mix( xrBase, uXrRimAlpha, xrRim );
xrAlpha *= gl_FrontFacing ? 1.0 : uXrBackAlpha;
// Blender: only env·α of the pixel is opaque; the straight colour is E / env (+ G below).
vec4 diffuseColor = vec4( xrCol / uXrEnv, xrAlpha * uXrEnv * opacity );
// Docked in a grid slot: a solid primer panel under a camera-locked half-Lambert.
vec3 xrN = normalize( vXrN ) * ( gl_FrontFacing ? 1.0 : -1.0 );
float xrLam = 0.5 + 0.5 * dot( xrN, normalize( ${DOCK_FILL} ) );
vec3 xrDocked = uXrDockColor * ( 0.3 + 0.95 * xrLam * xrLam ) + uXrRim * xrRim * 0.18;
xrDocked = mix( xrDocked, uHiColor, xrRim * xrHi );
diffuseColor = mix( diffuseColor, vec4( xrDocked, uXrDockAlpha * opacity ), uXrDock );`,
      );
  };
  material.customProgramCacheKey = () => `sk-xray-${o.kind}`;
  return material;
}

/** Adds the category highlight + dimming to a PBR part material (in place). */
function injectHighlight(
  material: MeshStandardMaterial,
  shared: SharedUniforms,
  highlight: HighlightUniforms,
): void {
  const uniforms = {
    uHiColor: shared.highlightColor,
    uHiHover: highlight.hover,
    uHiSelect: highlight.select,
    uHiDim: highlight.dim,
    uHiRimPower: { value: HIGHLIGHT.rimPower },
    uHiDock: highlight.dock,
    uHiDockColor: { value: new Color(DOCK.liftColor) },
    uHiDockRim: { value: new Color(DOCK.rimColor) },
  };
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform vec3 uHiColor;
uniform float uHiHover;
uniform float uHiSelect;
uniform float uHiDim;
uniform float uHiRimPower;
uniform float uHiDock;
uniform vec3 uHiDockColor;
uniform vec3 uHiDockRim;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
{
  float hiRim = pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), uHiRimPower );
  float hiRimAmt = min( uHiHover * ${HIGHLIGHT.hoverRim.toFixed(2)} + uHiSelect * ${HIGHLIGHT.selectedRim.toFixed(2)}, 1.0 );
  float hiEmi = uHiHover * ${HIGHLIGHT.hoverEmissive.toFixed(2)} + uHiSelect * ${HIGHLIGHT.selectedEmissive.toFixed(2)};
  totalEmissiveRadiance += uHiColor * ( hiRim * hiRimAmt + hiEmi );
  // Docked in a grid slot: an exposure floor — higher the darker the base colour — shaded by a
  // camera-locked fill, and a cool edge light: black rubber and plastic keep their form and get
  // an outline on the night field.
  float hiNdv = saturate( dot( normal, normalize( vViewPosition ) ) );
  float hiLam = 0.5 + 0.5 * dot( normal, normalize( ${DOCK_FILL} ) );
  float hiDark = 1.0 - smoothstep( ${DOCK.darkFrom.toFixed(2)}, ${DOCK.darkTo.toFixed(2)}, dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) );
  float hiFloor = ${DOCK.lift.toFixed(2)} + ${DOCK.liftDark.toFixed(2)} * hiDark;
  totalEmissiveRadiance += uHiDockColor * ( uHiDock * hiFloor * ( ${DOCK.liftShade.toFixed(2)} + ${(1 - DOCK.liftShade).toFixed(2)} * hiLam * hiLam ) );
  totalEmissiveRadiance += uHiDockRim * ( uHiDock * ${DOCK.rim.toFixed(2)} * pow( 1.0 - hiNdv, ${DOCK.rimPower.toFixed(1)} ) );
}`,
      )
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
{
  float hiLum = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( hiLum ), ${HIGHLIGHT.dimDesaturate.toFixed(2)} * uHiDim ) * ( 1.0 - ${(1 - HIGHLIGHT.dimBrightness).toFixed(2)} * uHiDim );
}`,
      );
  };
  material.customProgramCacheKey = () => "sk-part";
}

/** Standard → Physical with every standard property kept. */
function toPhysical(source: MeshStandardMaterial): MeshPhysicalMaterial {
  const physical = new MeshPhysicalMaterial();
  MeshStandardMaterial.prototype.copy.call(physical, source);
  // Standard#copy resets the defines; the physical chunks need PHYSICAL back.
  physical.defines = { STANDARD: "", PHYSICAL: "" };
  physical.name = source.name;
  return physical;
}

/** Slot-specific tuning on top of the exported glTF values (DS §7.3). */
function tune(material: MeshStandardMaterial): MeshStandardMaterial {
  let out = material;
  if (material.name === "mat_painted_black" && material instanceof MeshPhysicalMaterial) {
    material.clearcoatRoughness = 0.25;
  } else if (material.name === "mat_caliper") {
    // Graphite anodised caliper: a thin lacquer catches the key light.
    const physical = toPhysical(material);
    physical.clearcoat = 0.2;
    physical.clearcoatRoughness = 0.3;
    out = physical;
  } else if (material.name === "mat_glass_lens") {
    const physical = toPhysical(material);
    physical.ior = 1.5;
    physical.specularIntensity = 1;
    physical.depthWrite = false;
    out = physical;
  }
  out.dithering = true;
  return out;
}

/**
 * Per-category clone of an exported part material with the highlight injected. Clones share
 * their shader program with every other material of the same feature set.
 */
export function createPartMaterial(
  source: Material,
  shared: SharedUniforms,
  highlight: HighlightUniforms,
): MeshStandardMaterial {
  const base =
    source instanceof MeshStandardMaterial
      ? (source.clone() as MeshStandardMaterial)
      : new MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.6, metalness: 0.5 });
  base.name = source.name;
  const tuned = tune(base);
  injectHighlight(tuned, shared, highlight);
  return tuned;
}

export function isXraySlot(name: string): XrayKind | null {
  if (name === "mat_body_xray") return "body";
  if (name === "mat_glass_xray") return "glass";
  return null;
}
