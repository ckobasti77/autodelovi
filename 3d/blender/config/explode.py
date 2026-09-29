"""Explode intent (vehicle/glTF space [left, up, front]; docs/3d/PLAN.md §6.3).

dir is normalised in code; right-hand instances negate x unless listed explicitly.
order in [0, 1]; the runtime maps local = clamp((u - 0.35*order)/0.65, 0, 1) (PLAN §6.2).
explode.py --solve writes tuned values to 3d/build/explode.tuned.json (overrides this table).
"""

E: dict[str, tuple[tuple[float, float, float], float, float]] = {}


def e(node, d, dist, order):
    E[node] = (d, dist, order)


def lr(cat, d, dist, order, names=("l", "r")):
    x, y, z = d
    e(f"{cat}__{names[0]}", (x, y, z), dist, order)
    e(f"{cat}__{names[1]}", (-x, y, z), dist, order)


def corners(cat, d_front, d_rear, dist_f, dist_r, order_f, order_r=None):
    order_r = order_f if order_r is None else order_r
    x, y, z = d_front
    e(f"{cat}__fl", (x, y, z), dist_f, order_f)
    e(f"{cat}__fr", (-x, y, z), dist_f, order_f)
    x, y, z = d_rear
    e(f"{cat}__rl", (x, y, z), dist_r, order_r)
    e(f"{cat}__rr", (-x, y, z), dist_r, order_r)


# stage 1 — karoserija, stakla, svetla
e("brisaci__main", (0, 0.60, 0.80), 0.24, 0.00)
e("hauba__main", (0, 0.80, 0.60), 1.10, 0.10)
e("branici__front", (0, 0.10, 0.99), 0.55, 0.20)
e("branici__rear", (0, 0.10, -0.99), 0.50, 0.20)
e("stakla__windshield", (0, 0.84, 0.54), 0.36, 0.30)
e("stakla__rear", (0, 0.76, -0.65), 0.36, 0.30)
e("senzori__park-front", (0, 0.90, 0.44), 0.60, 0.35)
lr("farovi", (0.35, 0.45, 0.82), 0.50, 0.40)
lr("stop-svetla", (0.35, 0.40, -0.85), 0.45, 0.45)
lr("blatobrani", (0.62, 0.62, 0.48), 0.60, 0.55)
lr("retrovizori", (0.70, 0.62, 0.35), 0.70, 0.60)
corners("vrata", (0.80, 0.52, 0.30), (0.80, 0.52, -0.30), 0.60, 0.60, 0.70, 0.75)
e("stakla__side", (0, 1, 0), 0.55, 1.00)
# stage 2 — tockovi
corners("felne-gume", (1, 0, 0), (1, 0, 0), 0.72, 0.70, 0.00, 0.40)
# stage 3 — kocnice, vesanje, upravljanje
corners("kocione-celjusti", (0.50, 0.20, -0.84), (0.50, 0.20, -0.84), 0.46, 0.46, 0.00)
corners("kocione-plocice", (0.55, 0.15, -0.82), (0.55, 0.15, -0.82), 0.28, 0.28, 0.10)
corners("abs-senzori", (0.40, 0.80, -0.45), (0.40, 0.80, -0.45), 0.30, 0.30, 0.20)
corners("kocioni-diskovi", (1, 0, 0), (1, 0, 0), 0.21, 0.21, 0.35)
corners("lezaj-glavcina", (1, 0, 0), (1, 0, 0), 0.09, 0.09, 0.50)
corners("amortizeri-opruge", (0.20, 0.98, 0), (0.20, 0.98, 0), 0.45, 0.45, 0.60)
lr("ramena-selen-blokovi", (0.45, -0.45, 0.77), 0.28, 0.70, names=("fl", "fr"))
e("ramena-selen-blokovi__rear-axle", (0, -0.30, -0.95), 0.30, 0.70)
lr("spone-stabilizatori", (0.30, 0, -0.95), 0.22, 0.80, names=("tie-rod-l", "tie-rod-r"))
e("spone-stabilizatori__stabilizer", (0, -1, 0), 0.16, 0.85)
e("letva-volana__main", (0.90, 0.40, 0), 0.22, 0.95)
# stage 4 — agregati, hladjenje, usis
e("interkuler__main", (0, -0.13, 0.99), 0.45, 0.00)
e("interkuler__pipes", (0.30, 0.20, 0.93), 0.40, 0.10)
e("klima__condenser", (0, 0.12, 0.99), 0.40, 0.15)
e("akumulator__main", (0.39, 0.88, 0.29), 0.51, 0.20)
e("usisna-grana__airbox", (0.10, 0.99, -0.05), 0.72, 0.25)
e("hladnjak-ventilator__radiator", (0, 0.16, 0.99), 0.30, 0.30)
e("nosaci-motora__r", (-0.35, 0.50, 0.79), 0.60, 0.30)
e("kais-alternatora__belt", (-0.78, 0.58, 0.24), 0.51, 0.35)
e("hladnjak-ventilator__fan", (0, 0.27, 0.96), 0.26, 0.45)
e("alternator__main", (-0.69, 0.45, 0.57), 0.42, 0.50)
e("anlaser__main", (0.31, -0.16, 0.94), 0.32, 0.55)
e("klima__compressor", (-0.72, -0.05, 0.69), 0.44, 0.60)
e("usisna-grana__manifold", (0, 0.89, 0.46), 0.39, 0.70)
e("termostat-creva__thermostat", (0.45, 0.89, 0), 0.34, 0.75)
e("termostat-creva__hoses", (0, 0.62, 0.78), 0.32, 0.80)
e("nosaci-motora__l", (0.60, 0.30, 0.74), 0.55, 0.90)
e("nosaci-motora__rear", (0, -1, 0), 0.14, 1.00)
# stage 5 — motor, turbina, gorivo, paljenje
e("paljenje-grejaci__coils", (0, 0.978, -0.208), 0.85, 0.00)
e("brizgaljke-pumpa-goriva__injectors", (0, 0.40, 0.92), 0.35, 0.05)
e("brizgaljke-pumpa-goriva__pump", (0.05, 0.996, -0.08), 0.85, 0.10)
e("egr-ventil__main", (0.48, 0.84, 0.24), 0.42, 0.15)
e("senzori__coolant-temp", (0.45, 0.80, 0.40), 0.45, 0.20)
e("zupcasti-kais-vodena-pumpa__belt", (-0.55, 0.45, 0.70), 0.42, 0.20)
e("zupcasti-kais-vodena-pumpa__water-pump", (-0.30, 0.95, 0.10), 0.30, 0.25)
e("motor__head", (0, 1, 0), 0.60, 0.30)
e("turbina__main", (0.10, 0.994, 0.05), 0.50, 0.50)
e("motor__block", (0, 1, 0), 0.25, 0.80)
e("karter-dihtunzi__sump", (0, -1, 0), 0.03, 0.90)
# stage 6 — transmisija
e("menjac__main", (0.30, 0.35, 0.89), 0.45, 0.00)
e("kvacilo-zamajac__main", (0.55, 0.80, -0.25), 0.32, 0.25)
e("poluosovine__l", (-0.93, 0.15, 0.33), 0.24, 0.50)
e("poluosovine__r", (0.94, -0.03, -0.33), 0.22, 0.50)
# stage 7 — izduvni
e("senzori__lambda", (0.50, 0.87, 0), 0.35, 0.00)
e("auspuh__mid", (0.97, -0.24, 0), 0.50, 0.15)
e("dpf-katalizator__main", (0.93, 0.33, -0.16), 0.55, 0.35)
e("auspuh__rear", (0.85, -0.10, -0.52), 0.50, 0.60)

# label-anchor overrides (local offset in glTF space from the pivot) — computed by default
ANCHOR_OVERRIDES: dict[str, tuple[float, float, float]] = {}

# focus view overrides per category (camera direction in glTF space)
FOCUS_OVERRIDES: dict[str, tuple[float, float, float]] = {
    "zupcasti-kais-vodena-pumpa": (-0.62, 0.45, 0.64),
    "kais-alternatora": (-0.62, 0.45, 0.64),
    "alternator": (-0.55, 0.45, 0.70),
    "klima": (-0.45, 0.35, 0.82),
    "auspuh": (0.70, -0.05, -0.71),
    "dpf-katalizator": (0.75, 0.10, -0.65),
    "menjac": (0.85, 0.45, 0.27),
    "kvacilo-zamajac": (0.85, 0.45, 0.27),
}
