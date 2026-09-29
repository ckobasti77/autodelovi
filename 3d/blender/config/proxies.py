"""Graybox proxies: pivot, size and material list for every clickable node (vehicle space).

Used for any node a real builder has not produced yet, so the whole pipeline (export ->
optimize -> validate -> manifest) always runs end to end. Right-hand instances mirror x.
`thin` proxies (pipes, hoses, belts) are skipped by the packaging check while graybox.
"""

M = lambda *names: [f"mat_{n}" for n in names]  # noqa: E731

P: dict[str, dict] = {}


def add(node, pivot, size, mats, thin=False):
    P[node] = {"pivot": pivot, "size": size, "mats": mats, "thin": thin}


def lr(cat, pivot, size, mats, names=("l", "r"), thin=False):
    x, y, z = pivot
    add(f"{cat}__{names[0]}", (x, y, z), size, mats, thin)
    add(f"{cat}__{names[1]}", (-x, y, z), size, mats, thin)


def corners(cat, front, rear, size_f, size_r, mats):
    for side, s in (("l", 1), ("r", -1)):
        x, y, z = front
        add(f"{cat}__f{side}", (s * x, y, z), size_f, mats)
        x, y, z = rear
        add(f"{cat}__r{side}", (s * x, y, z), size_r, mats)


# --- karoserija
add("hauba__main", (0, 0.90, 1.45), (1.36, 0.08, 1.22), M("body_xray"))
add("branici__front", (0, 0.42, 2.03), (1.76, 0.44, 0.32), M("body_xray", "steel_dark"))
add("branici__rear", (0, 0.45, -1.94), (1.74, 0.42, 0.30), M("body_xray"))
lr("blatobrani", (0.85, 0.72, 1.36), (0.10, 0.52, 1.10), M("body_xray"))
corners("vrata", (0.87, 0.85, 0.31), (0.87, 0.85, -0.60), (0.08, 1.08, 0.96), (0.08, 1.02, 0.82), M("body_xray"))
lr("retrovizori", (0.95, 1.02, 0.66), (0.16, 0.12, 0.20), M("body_xray", "plastic_black", "machined_steel"))
add("stakla__windshield", (0, 1.21, 0.45), (1.36, 0.40, 0.66), M("glass_xray"))
add("stakla__rear", (0, 1.21, -1.64), (1.18, 0.36, 0.42), M("glass_xray"))
add("stakla__side", (0, 1.18, -0.30), (1.66, 0.38, 2.10), M("glass_xray"), thin=True)
add("brisaci__main", (0.05, 1.02, 0.74), (1.10, 0.05, 0.12), M("painted_black", "rubber"), thin=True)
# --- elektrika
lr("farovi", (0.66, 0.725, 2.02), (0.36, 0.14, 0.18), M("glass_lens", "plastic_black", "brushed_alu", "emissive_led"))
lr("stop-svetla", (0.72, 0.95, -1.88), (0.30, 0.14, 0.14), M("glass_lens", "plastic_black", "emissive_tail"))
add("senzori__park-front", (0, 0.45, 2.15), (1.06, 0.03, 0.04), M("plastic_black"), thin=True)
add("akumulator__main", (0.58, 0.595, 1.745), (0.278, 0.19, 0.175), M("battery", "plastic_grey"))
add("senzori__coolant-temp", (0.11, 0.71, 1.52), (0.03, 0.03, 0.05), M("plastic_grey"))
add("senzori__lambda", (-0.02, 0.55, 1.06), (0.03, 0.03, 0.09), M("machined_steel", "plastic_black"))
# --- tockovi
corners("felne-gume", (0.77, 0.316, 1.31), (0.755, 0.316, -1.31), (0.205, 0.632, 0.632), (0.205, 0.632, 0.632), M("brushed_alu", "painted_black", "tyre"))
# --- kocnice
corners("kocioni-diskovi", (0.771, 0.316, 1.31), (0.756, 0.316, -1.31), (0.03, 0.288, 0.288), (0.02, 0.272, 0.272), M("machined_steel", "cast_iron"))
corners("kocione-plocice", (0.771, 0.34, 1.19), (0.756, 0.34, -1.425), (0.07, 0.06, 0.11), (0.06, 0.05, 0.10), M("steel_dark", "rubber"))
corners("kocione-celjusti", (0.77, 0.34, 1.18), (0.755, 0.34, -1.435), (0.12, 0.16, 0.10), (0.13, 0.16, 0.12), M("caliper", "rubber"))
corners("abs-senzori", (0.70, 0.40, 1.25), (0.70, 0.40, -1.25), (0.03, 0.03, 0.06), (0.03, 0.03, 0.06), M("plastic_black"))
# --- vesanje i upravljanje
corners("lezaj-glavcina", (0.79, 0.316, 1.31), (0.775, 0.316, -1.31), (0.07, 0.14, 0.14), (0.07, 0.14, 0.14), M("machined_steel"))
corners("amortizeri-opruge", (0.615, 0.68, 1.275), (0.57, 0.50, -1.32), (0.16, 0.44, 0.16), (0.20, 0.48, 0.24), M("steel_dark", "painted_black", "machined_steel", "rubber"))
lr("ramena-selen-blokovi", (0.55, 0.21, 1.18), (0.40, 0.06, 0.34), M("steel_dark", "rubber"), names=("fl", "fr"))
add("ramena-selen-blokovi__rear-axle", (0, 0.28, -1.12), (1.40, 0.15, 0.60), M("painted_black", "rubber"))
lr("spone-stabilizatori", (0.51, 0.315, 1.16), (0.30, 0.04, 0.04), M("steel_dark", "rubber"), names=("tie-rod-l", "tie-rod-r"), thin=True)
add("spone-stabilizatori__stabilizer", (0, 0.27, 1.14), (1.20, 0.08, 0.30), M("steel_dark", "rubber"), thin=True)
add("letva-volana__main", (0.02, 0.33, 1.16), (0.80, 0.10, 0.12), M("cast_alu", "rubber", "steel_dark"))
# --- motor i usis
add("motor__block", (-0.17, 0.45, 1.46), (0.46, 0.50, 0.32), M("cast_iron", "cast_alu"))
add("motor__head", (-0.17, 0.81, 1.43), (0.46, 0.22, 0.30), M("cast_alu", "plastic_black", "steel_dark"))
add("turbina__main", (-0.06, 0.64, 1.16), (0.26, 0.22, 0.20), M("cast_iron", "cast_alu", "machined_steel", "steel_dark", "heat_shield"))
add("interkuler__main", (0, 0.27, 2.07), (0.80, 0.18, 0.06), M("core_fins", "cast_alu"))
add("interkuler__pipes", (0, 0.45, 1.60), (0.80, 0.40, 0.80), M("brushed_alu", "hose"), thin=True)
add("usisna-grana__manifold", (-0.15, 0.75, 1.71), (0.40, 0.26, 0.14), M("plastic_black", "cast_alu"))
add("usisna-grana__airbox", (0.38, 0.84, 1.36), (0.30, 0.16, 0.30), M("plastic_black", "rubber"))
add("brizgaljke-pumpa-goriva__injectors", (-0.17, 0.66, 1.62), (0.28, 0.06, 0.05), M("steel_dark", "plastic_black"))
add("brizgaljke-pumpa-goriva__pump", (0.10, 0.90, 1.30), (0.08, 0.12, 0.08), M("cast_alu", "machined_steel"))
add("zupcasti-kais-vodena-pumpa__belt", (-0.43, 0.65, 1.40), (0.03, 0.62, 0.38), M("rubber", "steel_dark"), thin=True)
add("zupcasti-kais-vodena-pumpa__water-pump", (-0.41, 0.52, 1.32), (0.06, 0.10, 0.10), M("cast_alu", "steel_dark"))
add("kais-alternatora__belt", (-0.47, 0.46, 1.60), (0.03, 0.42, 0.42), M("rubber", "cast_alu"), thin=True)
add("alternator__main", (-0.34, 0.48, 1.72), (0.20, 0.15, 0.15), M("cast_alu", "copper", "steel_dark"))
add("anlaser__main", (0.25, 0.30, 1.66), (0.22, 0.10, 0.10), M("painted_black", "cast_alu", "machined_steel"))
add("paljenje-grejaci__coils", (-0.17, 1.00, 1.40), (0.30, 0.10, 0.05), M("plastic_black", "ceramic", "machined_steel"))
add("karter-dihtunzi__sump", (-0.18, 0.22, 1.46), (0.44, 0.16, 0.32), M("cast_alu", "steel_dark"))
add("egr-ventil__main", (0.09, 0.80, 1.66), (0.10, 0.08, 0.08), M("cast_alu", "plastic_black"))
add("nosaci-motora__r", (-0.52, 0.82, 1.52), (0.12, 0.10, 0.12), M("cast_alu", "rubber"))
add("nosaci-motora__l", (0.52, 0.74, 1.50), (0.12, 0.10, 0.12), M("cast_alu", "rubber"))
add("nosaci-motora__rear", (0.05, 0.22, 1.10), (0.06, 0.06, 0.20), M("cast_alu", "rubber"))
# --- hladjenje i klima
add("hladnjak-ventilator__radiator", (0, 0.57, 1.95), (0.70, 0.50, 0.04), M("core_fins", "plastic_black"))
add("hladnjak-ventilator__fan", (0, 0.57, 1.86), (0.60, 0.48, 0.10), M("plastic_black", "steel_dark"))
add("termostat-creva__thermostat", (0.11, 0.71, 1.45), (0.10, 0.10, 0.10), M("plastic_grey"))
add("termostat-creva__hoses", (-0.10, 0.55, 1.70), (0.80, 0.50, 0.50), M("hose", "steel_dark"), thin=True)
add("klima__compressor", (-0.33, 0.29, 1.72), (0.22, 0.13, 0.13), M("cast_alu", "steel_dark"))
add("klima__condenser", (0, 0.56, 2.01), (0.70, 0.46, 0.02), M("core_fins", "steel_dark"))
# --- transmisija
add("kvacilo-zamajac__main", (0.13, 0.43, 1.46), (0.12, 0.30, 0.30), M("machined_steel", "cast_iron", "steel_dark", "rubber"))
add("menjac__main", (0.32, 0.41, 1.41), (0.52, 0.38, 0.42), M("cast_alu", "plastic_black", "steel_dark"))
add("poluosovine__l", (0.56, 0.32, 1.31), (0.33, 0.09, 0.09), M("machined_steel", "rubber", "steel_dark"))
add("poluosovine__r", (-0.32, 0.32, 1.31), (0.76, 0.09, 0.09), M("machined_steel", "rubber", "steel_dark"))
# --- izduvni
add("dpf-katalizator__main", (0, 0.34, 0.80), (0.16, 0.40, 0.72), M("steel_dark", "heat_shield"))
add("auspuh__mid", (0.02, 0.22, -0.50), (0.20, 0.12, 1.10), M("steel_dark", "rubber"))
add("auspuh__rear", (0.02, 0.26, -1.80), (0.95, 0.20, 0.50), M("steel_dark", "chrome", "rubber"))

STATIC = {
    "chassis__subframe": {"system": "vesanje-i-upravljanje", "pivot": (0, 0.23, 1.11), "size": (0.90, 0.12, 0.34), "mats": M("painted_black")},
    "chassis__knuckle__fl": {"system": "vesanje-i-upravljanje", "pivot": (0.68, 0.32, 1.31), "size": (0.06, 0.44, 0.16), "mats": M("cast_iron")},
    "chassis__knuckle__fr": {"system": "vesanje-i-upravljanje", "pivot": (-0.68, 0.32, 1.31), "size": (0.06, 0.44, 0.16), "mats": M("cast_iron")},
}
