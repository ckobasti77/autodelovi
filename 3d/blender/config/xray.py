"""X-ray shell and glass shader values (DESIGN-SYSTEM §7.2) used by every render and handed to the
runtime shader (step 10). Posters must be rendered with the same values the canvas uses."""

XRAY = {
    "body": {
        "rim_power": 2.6,
        "rim_power_mobile": 2.2,
        "rim_scale": 1.0,
        "base_alpha": 0.22,
        "base_alpha_exploded": 0.10,
        "tint": "#123642",
        "rim": "#9FE9FF",
    },
    "glass": {"rim_power": 3.2, "rim_scale": 0.7, "base_alpha": 0.06, "tint": "#9FE9FF", "rim": "#9FE9FF"},
    "env": 0.35,
}
