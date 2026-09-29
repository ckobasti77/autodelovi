"""Category thumbnail compositions (PLAN §8.4, DS §6.3).

Default: the first instance in the order fl, l, front, main, windshield (the left/front-left part
faces the three-quarter front-left camera). Kits show several nodes as assembled; `row` lays the
nodes side by side along the screen axis instead. `yaw` turns the set 180 degrees about its centre
for parts whose working face points to the vehicle's right (-x). `az`/`el` override the camera.
"""

THUMBS: dict[str, dict] = {
    "motor": {"nodes": ["motor__block", "motor__head"]},
    "interkuler": {"nodes": ["interkuler__main"]},
    "usisna-grana": {"nodes": ["usisna-grana__manifold"], "el": 26, "yaw": 180},
    "brizgaljke-pumpa-goriva": {"nodes": ["brizgaljke-pumpa-goriva__injectors"], "el": 26},
    "zupcasti-kais-vodena-pumpa": {"nodes": ["zupcasti-kais-vodena-pumpa__belt", "zupcasti-kais-vodena-pumpa__water-pump"], "yaw": 180},
    "kais-alternatora": {"nodes": ["kais-alternatora__belt"], "yaw": 180},
    "alternator": {"nodes": ["alternator__main"], "yaw": 180},
    "nosaci-motora": {"nodes": ["nosaci-motora__r"], "yaw": 180},
    "auspuh": {"nodes": ["auspuh__rear"], "az": 150, "el": 18},
    "hladnjak-ventilator": {"nodes": ["hladnjak-ventilator__radiator", "hladnjak-ventilator__fan"]},
    "termostat-creva": {"nodes": ["termostat-creva__thermostat"]},
    "klima": {"nodes": ["klima__compressor", "klima__condenser"], "row": True},
    "poluosovine": {"nodes": ["poluosovine__r"]},
    "spone-stabilizatori": {"nodes": ["spone-stabilizatori__tie-rod-l"], "el": 24},
    "brisaci": {"nodes": ["brisaci__main"], "az": 20, "el": 38, "focus_x": [0.0, 1.0]},
    "senzori": {"nodes": ["senzori__lambda", "senzori__coolant-temp"], "row": True},
    "stop-svetla": {"nodes": ["stop-svetla__l"], "az": 150, "el": 16},
    "stakla": {"nodes": ["stakla__windshield"]},
    "branici": {"nodes": ["branici__front"]},
    "felne-gume": {"nodes": ["felne-gume__fl"], "az": 60, "el": 14},
    "kocione-celjusti": {"nodes": ["kocione-celjusti__fl"], "yaw": 180, "el": 24},
}

# service categories and filter subcategories: props built by parts/props.py
PROPS = ["filteri", "ulja-tecnosti", "filter-ulja", "filter-vazduha", "filter-goriva", "filter-kabine"]

PREFERRED = ("fl", "l", "front", "main", "windshield", "block", "radiator", "belt", "compressor", "manifold", "injectors", "thermostat", "tie-rod-l", "lambda", "mid")
