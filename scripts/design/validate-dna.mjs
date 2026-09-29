// Checks docs/design/design-dna.json against every field of the design-dna schema
// (.claude/skills/design-dna/references/schema.md). Usage: node scripts/design/validate-dna.mjs
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const dna = JSON.parse(await readFile(path.join(ROOT, "docs/design/design-dna.json"), "utf8"));

const each = (prefix, keys) => keys.map((k) => `${prefix}.${k}`);
const typeRoles = ["display", "heading_1", "heading_2", "heading_3", "body", "body_small", "caption", "overline"];

const required = [
  ...each("meta", ["name", "description", "source_references", "created_at"]),
  ...each("design_system.color", [
    "palette_type", "primary.hex", "primary.role", "secondary.hex", "secondary.role", "accent.hex", "accent.role",
    "neutral.scale", "neutral.usage", "semantic.success", "semantic.warning", "semantic.error", "semantic.info",
    "surface.background", "surface.card", "surface.elevated", "contrast_strategy",
  ]),
  ...typeRoles.flatMap((role) => each(`design_system.typography.type_scale.${role}`, ["size", "weight", "line_height", "tracking"])),
  ...each("design_system.typography", ["font_families.heading", "font_families.body", "font_families.mono", "font_style_notes"]),
  ...each("design_system.spacing", ["base_unit", "scale", "content_density", "section_rhythm"]),
  ...each("design_system.layout", ["grid_system", "max_content_width", "columns", "gutter", "breakpoints", "alignment_tendency"]),
  ...each("design_system.shape", ["border_radius.small", "border_radius.medium", "border_radius.large", "border_radius.pill", "border_usage", "divider_style"]),
  ...each("design_system.elevation", ["shadow_style", "levels.low", "levels.medium", "levels.high", "depth_cues"]),
  ...each("design_system.iconography", ["style", "stroke_weight", "size_scale", "preferred_set"]),
  ...each("design_system.motion", ["easing", "duration_scale.micro", "duration_scale.normal", "duration_scale.macro", "entrance_pattern", "exit_pattern", "philosophy"]),
  ...each("design_system.components", ["button_style", "input_style", "card_style", "navigation_pattern", "modal_style", "list_style", "component_notes"]),
  ...each("design_style.aesthetic", ["mood", "visual_metaphor", "era_influence", "genre", "personality_traits", "adjectives"]),
  ...each("design_style.visual_language", ["complexity", "ornamentation", "whitespace_usage", "visual_weight_distribution", "focal_strategy", "contrast_level", "texture_usage"]),
  ...each("design_style.composition", ["hierarchy_method", "balance_type", "flow_direction", "grouping_strategy", "negative_space_role"]),
  ...each("design_style.imagery", ["photo_treatment", "illustration_style", "graphic_elements", "pattern_usage", "image_shape"]),
  ...each("design_style.interaction_feel", ["feedback_style", "hover_behavior", "transition_personality", "loading_style", "microinteraction_density"]),
  ...each("design_style.brand_voice_in_ui", ["tone", "formality", "cta_style", "empty_state_approach", "error_tone"]),
  ...each("visual_effects.overview", ["effect_intensity", "performance_tier", "fallback_strategy", "primary_technology"]),
  ...each("visual_effects.background_effects", ["type", "description", "technology", "params.color_palette", "params.speed", "params.density", "params.opacity", "params.blend_mode"]),
  ...each("visual_effects.particle_systems", ["enabled", "type", "description", "technology", "params.count", "params.shape", "params.size_range", "params.movement_pattern", "params.color_behavior", "params.interaction", "params.spawn_area"]),
  ...each("visual_effects.3d_elements", ["enabled", "type", "description", "technology", "params.renderer", "params.lighting", "params.camera", "params.materials", "params.geometry", "params.post_processing", "params.interaction_model"]),
  ...each("visual_effects.shader_effects", ["enabled", "type", "description", "technology", "params.uniforms", "params.vertex_manipulation", "params.fragment_output", "params.noise_type", "params.distortion"]),
  ...each("visual_effects.scroll_effects", [
    "parallax.enabled", "parallax.layers", "parallax.depth_range", "parallax.speed_curve",
    "scroll_triggered_animations.enabled", "scroll_triggered_animations.trigger_points", "scroll_triggered_animations.animation_type", "scroll_triggered_animations.scrub_behavior",
    "scroll_morphing.enabled", "scroll_morphing.description",
  ]),
  ...each("visual_effects.text_effects", ["type", "description", "technology", "params.split_strategy", "params.animation_per_unit", "params.stagger", "params.effect_style"]),
  ...each("visual_effects.cursor_effects", ["enabled", "type", "description", "params.shape", "params.size", "params.blend_mode", "params.trail", "params.interaction_zone"]),
  ...each("visual_effects.image_effects", ["type", "description", "technology", "params.filter_pipeline", "params.hover_transform", "params.reveal_animation", "params.distortion_type"]),
  ...each("visual_effects.glassmorphism_neumorphism", ["enabled", "style", "params.blur_radius", "params.transparency", "params.border_treatment", "params.shadow_type", "params.light_source_angle"]),
  ...each("visual_effects.canvas_drawings", ["enabled", "type", "description", "technology", "params.draw_method", "params.animation_loop", "params.color_scheme", "params.responsiveness", "params.interaction"]),
  ...each("visual_effects.svg_animations", ["enabled", "type", "description", "params.animation_method", "params.path_morphing", "params.stroke_animation", "params.filter_effects"]),
  "visual_effects.composite_notes",
];

// An empty post_processing array is a deliberate value ("no post-processing").
const allowedEmpty = new Set(["visual_effects.3d_elements.params.post_processing"]);
const get = (p) => p.split(".").reduce((node, key) => (node == null ? undefined : node[key]), dna);
const missing = required.filter((p) => {
  const v = get(p);
  if (v === undefined || v === null || v === "") return true;
  return Array.isArray(v) && v.length === 0 && !allowedEmpty.has(p);
});
console.log(`${required.length} schema fields checked, ${missing.length} missing or empty${missing.length ? ": " + missing.join(", ") : ""}`);
if (missing.length) process.exit(1);
