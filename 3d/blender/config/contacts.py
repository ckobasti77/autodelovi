"""Declared assembled contacts (explode.py --check): pairs that touch or nest by design
(bolted flanges, pressed bearings, meshing belts, hoses on nozzles). Everything else that
overlaps in the assembled state is a packaging error. Regenerate the list only after
reviewing the new pairs (docs/3d/QA.md)."""

CONTACTS: list[tuple[str, str]] = [
    ("felne-gume__fl", "kocioni-diskovi__fl"),  # wheel bolts pass through the disc hat onto the hub
    ("felne-gume__fr", "kocioni-diskovi__fr"),  # wheel bolts pass through the disc hat onto the hub
    ("felne-gume__rl", "kocioni-diskovi__rl"),  # wheel bolts pass through the disc hat onto the hub
    ("felne-gume__rr", "kocioni-diskovi__rr"),  # wheel bolts pass through the disc hat onto the hub
    ("motor__head", "zupcasti-kais-vodena-pumpa__belt"),  # timing belt meshing with sprockets / pump bolted to the block
    ("dpf-katalizator__main", "turbina__main"),  # downpipe bolted into the turbine outlet
    ("brizgaljke-pumpa-goriva__injectors", "usisna-grana__manifold"),  # injectors seated in the manifold/head
    ("kocione-celjusti__fl", "kocioni-diskovi__fl"),  # caliper straddles the disc (carrier ears at the pad ends)
    ("kocione-celjusti__fr", "kocioni-diskovi__fr"),  # caliper straddles the disc (carrier ears at the pad ends)
    ("amortizeri-opruge__rr", "ramena-selen-blokovi__rear-axle"),  # spring seat / damper eye on the beam
    ("amortizeri-opruge__rl", "ramena-selen-blokovi__rear-axle"),  # spring seat / damper eye on the beam
    ("chassis__knuckle__fl", "lezaj-glavcina__fl"),  # pressed / bolted into the knuckle
    ("chassis__knuckle__fr", "lezaj-glavcina__fr"),  # pressed / bolted into the knuckle
    ("hladnjak-ventilator__radiator", "termostat-creva__hoses"),  # hose ends on their nozzles / routed tight
    ("interkuler__main", "interkuler__pipes"),  # couplers over the intercooler nozzles
    ("chassis__subframe", "ramena-selen-blokovi__fr"),  # bolted to / bushed in the subframe
    ("chassis__subframe", "ramena-selen-blokovi__fl"),  # bolted to / bushed in the subframe
    ("motor__block", "zupcasti-kais-vodena-pumpa__belt"),  # timing belt meshing with sprockets / pump bolted to the block
    ("kocione-celjusti__rl", "kocioni-diskovi__rl"),  # caliper straddles the disc (carrier ears at the pad ends)
    ("kocione-celjusti__rr", "kocioni-diskovi__rr"),  # caliper straddles the disc (carrier ears at the pad ends)
    ("motor__head", "paljenje-grejaci__coils"),  # coils seated in the head
    ("chassis__knuckle__fr", "kocione-celjusti__fr"),  # pressed / bolted into the knuckle
    ("chassis__knuckle__fl", "kocione-celjusti__fl"),  # pressed / bolted into the knuckle
    ("menjac__main", "poluosovine__l"),  # driveshafts plugged into the differential
    ("menjac__main", "poluosovine__r"),  # driveshafts plugged into the differential
    ("motor__block", "zupcasti-kais-vodena-pumpa__water-pump"),  # timing belt meshing with sprockets / pump bolted to the block
    ("kocioni-diskovi__fl", "lezaj-glavcina__fl"),  # disc hat on the hub flange
    ("kocioni-diskovi__fr", "lezaj-glavcina__fr"),  # disc hat on the hub flange
    ("kocioni-diskovi__rl", "lezaj-glavcina__rl"),  # disc hat on the hub flange
    ("kocioni-diskovi__rr", "lezaj-glavcina__rr"),  # disc hat on the hub flange
    ("zupcasti-kais-vodena-pumpa__belt", "zupcasti-kais-vodena-pumpa__water-pump"),  # crank damper hub through the timing-belt loop centre
    ("letva-volana__main", "spone-stabilizatori__tie-rod-l"),  # inner tie-rod joint in the rack end
    ("kocione-celjusti__rl", "lezaj-glavcina__rl"),  # caliper carrier beside the hub flange
    ("chassis__knuckle__fr", "kocione-plocice__fr"),  # pressed / bolted into the knuckle
    ("chassis__knuckle__fl", "kocione-plocice__fl"),  # pressed / bolted into the knuckle
    ("chassis__knuckle__fl", "abs-senzori__fl"),  # sensor head / cable against its mounting
    ("chassis__knuckle__fr", "abs-senzori__fr"),  # sensor head / cable against its mounting
    ("motor__head", "usisna-grana__manifold"),  # manifold bolted to the head
    ("chassis__knuckle__fl", "amortizeri-opruge__fl"),  # pressed / bolted into the knuckle
    ("kocione-celjusti__fl", "lezaj-glavcina__fl"),  # caliper carrier beside the hub flange
    ("chassis__knuckle__fr", "amortizeri-opruge__fr"),  # pressed / bolted into the knuckle
    ("chassis__knuckle__fl", "ramena-selen-blokovi__fl"),  # pressed / bolted into the knuckle
    ("chassis__knuckle__fr", "poluosovine__r"),  # pressed / bolted into the knuckle
    ("amortizeri-opruge__fr", "felne-gume__fr"),  # strut clamp inside the rim barrel envelope (hidden by the tyre)
    ("kocione-celjusti__fl", "kocione-plocice__fl"),  # pads held in the caliper
    ("kocione-celjusti__fr", "kocione-plocice__fr"),  # pads held in the caliper
    ("chassis__knuckle__fl", "poluosovine__l"),  # pressed / bolted into the knuckle
    ("chassis__knuckle__fr", "ramena-selen-blokovi__fr"),  # pressed / bolted into the knuckle
    ("amortizeri-opruge__fl", "felne-gume__fl"),  # strut clamp inside the rim barrel envelope (hidden by the tyre)
    ("chassis__subframe", "menjac__main"),  # bolted to / bushed in the subframe
    ("turbina__main", "usisna-grana__airbox"),  # intake hose on the compressor inlet
    ("kvacilo-zamajac__main", "poluosovine__r"),  # right shaft inner joint beside the flywheel
    ("kocione-celjusti__rr", "lezaj-glavcina__rr"),  # caliper carrier beside the hub flange
    ("felne-gume__fr", "lezaj-glavcina__fr"),  # wheel spigot / bolts in the hub
    ("felne-gume__rl", "lezaj-glavcina__rl"),  # wheel spigot / bolts in the hub
    ("felne-gume__fl", "lezaj-glavcina__fl"),  # wheel spigot / bolts in the hub
    ("felne-gume__rr", "lezaj-glavcina__rr"),  # wheel spigot / bolts in the hub
    ("kocione-celjusti__fr", "lezaj-glavcina__fr"),  # caliper carrier beside the hub flange
    ("kvacilo-zamajac__main", "menjac__main"),  # clutch inside the bellhousing
    ("abs-senzori__rl", "kocione-celjusti__rl"),  # sensor head / cable against its mounting
    ("menjac__main", "motor__block"),  # bellhousing bolted to the block
    ("motor__head", "turbina__main"),  # turbine inlet on the head exhaust flange
    ("kais-alternatora__belt", "zupcasti-kais-vodena-pumpa__belt"),  # crank damper hub through the timing-belt loop centre
    ("abs-senzori__rr", "kocione-celjusti__rr"),  # sensor head / cable against its mounting
    ("chassis__knuckle__fl", "spone-stabilizatori__tie-rod-l"),  # pressed / bolted into the knuckle
    ("chassis__knuckle__fr", "spone-stabilizatori__tie-rod-r"),  # pressed / bolted into the knuckle
    ("chassis__subframe", "nosaci-motora__rear"),  # bolted to / bushed in the subframe
    ("dpf-katalizator__main", "senzori__lambda"),  # sensor threaded into the downpipe boss
    ("termostat-creva__hoses", "termostat-creva__thermostat"),  # hose ends on their nozzles / routed tight
    ("hladnjak-ventilator__radiator", "interkuler__pipes"),  # charge pipe ends in their connections / routed tight
    ("kocione-celjusti__rl", "kocione-plocice__rl"),  # pads held in the caliper
    ("kocione-celjusti__rr", "kocione-plocice__rr"),  # pads held in the caliper
    ("interkuler__pipes", "usisna-grana__airbox"),  # charge pipe ends in their connections / routed tight
    ("abs-senzori__fl", "poluosovine__l"),  # sensor head / cable against its mounting
    ("abs-senzori__fr", "poluosovine__r"),  # sensor head / cable against its mounting
    ("auspuh__mid", "auspuh__rear"),  # slip joints / hangers
    ("abs-senzori__fl", "kocione-celjusti__fl"),  # sensor head / cable against its mounting
    ("abs-senzori__fr", "kocione-celjusti__fr"),  # sensor head / cable against its mounting
    ("abs-senzori__rl", "ramena-selen-blokovi__rear-axle"),  # sensor head / cable against its mounting
    ("abs-senzori__rr", "ramena-selen-blokovi__rear-axle"),  # sensor head / cable against its mounting
    ("interkuler__pipes", "usisna-grana__manifold"),  # charge pipe ends in their connections / routed tight
    ("kais-alternatora__belt", "termostat-creva__hoses"),  # hose ends on their nozzles / routed tight
    ("motor__block", "poluosovine__r"),  # right shaft under the block rear edge
    ("auspuh__mid", "dpf-katalizator__main"),  # slip joints / hangers
    ("anlaser__main", "menjac__main"),  # starter flange on the bellhousing
    ("termostat-creva__thermostat", "usisna-grana__airbox"),  # airbox against its neighbours
    ("kocione-celjusti__rl", "ramena-selen-blokovi__rear-axle"),  # rear caliper carrier bolted to the beam flange
    ("kocione-celjusti__rr", "ramena-selen-blokovi__rear-axle"),  # rear caliper carrier bolted to the beam flange
    ("auspuh__rear", "ramena-selen-blokovi__rear-axle"),  # slip joints / hangers
    ("hladnjak-ventilator__radiator", "klima__condenser"),  # condenser drier on the radiator tank
    ("abs-senzori__fl", "spone-stabilizatori__stabilizer"),  # sensor head / cable against its mounting
    ("abs-senzori__fr", "spone-stabilizatori__stabilizer"),  # sensor head / cable against its mounting
    ("amortizeri-opruge__fl", "spone-stabilizatori__stabilizer"),  # drop-link tab on the strut
    ("karter-dihtunzi__sump", "motor__block"),  # sump on the block
    ("brizgaljke-pumpa-goriva__pump", "usisna-grana__airbox"),  # injectors seated in the manifold/head
    ("chassis__subframe", "letva-volana__main"),  # bolted to / bushed in the subframe
    ("amortizeri-opruge__fr", "spone-stabilizatori__stabilizer"),  # drop-link tab on the strut
    ("motor__block", "motor__head"),  # head gasket face
    ("interkuler__pipes", "turbina__main"),  # charge pipe ends in their connections / routed tight
    ("chassis__knuckle__fl", "spone-stabilizatori__stabilizer"),  # pressed / bolted into the knuckle
    ("chassis__knuckle__fr", "spone-stabilizatori__stabilizer"),  # pressed / bolted into the knuckle
    ("brizgaljke-pumpa-goriva__injectors", "motor__block"),  # injector tips seated at the head/deck
    ("brizgaljke-pumpa-goriva__injectors", "motor__head"),  # injectors seated in the head ports
    ("motor__block", "termostat-creva__thermostat"),  # thermostat housing bolted to the block end
    ("motor__head", "termostat-creva__thermostat"),  # thermostat housing flange against the head
    ("menjac__main", "nosaci-motora__rear"),  # torque rod bolted to the gearbox lug
    ("egr-ventil__main", "usisna-grana__manifold"),  # EGR flange bolted to the manifold
    ("karter-dihtunzi__sump", "poluosovine__r"),  # right shaft runs close under the sump rail
]
