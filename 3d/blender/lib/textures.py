"""Procedural tangent-space normal maps (numpy height fields, seeded, OpenGL +Y).

Masters are written to 3d/assets/textures/*.png (git-ignored, regenerated on every build) and
embedded by the glTF exporter; optimize.mjs re-encodes them as near-lossless WebP.
"""

from __future__ import annotations

import math

import bpy
import numpy as np

from .scene import ASSETS, log

TEX_DIR = ASSETS / "textures"


def _normal_from_height(h: np.ndarray, strength: float) -> np.ndarray:
    """Periodic central differences -> RGB normal map (rows = v from bottom, cols = u)."""
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 0.5
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 0.5
    nx = -dx * strength
    ny = -dy * strength
    nz = np.ones_like(h)
    inv = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.stack([nx * inv, ny * inv, nz * inv], axis=-1) * 0.5 + 0.5
    return rgb


def _save(name: str, rgb: np.ndarray) -> str:
    TEX_DIR.mkdir(parents=True, exist_ok=True)
    hgt, wid, _ = rgb.shape
    rgba = np.concatenate([rgb, np.ones((hgt, wid, 1))], axis=-1).astype(np.float32)
    img = bpy.data.images.get(name)
    if img is not None:
        bpy.data.images.remove(img)
    img = bpy.data.images.new(name, wid, hgt, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(rgba.ravel())
    path = TEX_DIR / f"{name}.png"
    img.filepath_raw = str(path)
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return str(path)


def _smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def tyre(size: int = 1024) -> str:
    """Top half: tread tile (repeats along u around the tyre). Bottom half: sidewall band."""
    rng = np.random.default_rng(205)
    h = np.ones((size, size), dtype=np.float64)
    half = size // 2
    u = np.linspace(0, 1, size, endpoint=False)[None, :]
    # --- tread (rows half..size): v across the tread width 0..1
    v = np.linspace(0, 1, half, endpoint=False)[:, None]
    tread = np.ones((half, size))
    # shoulder lateral slots (outer 18 % each side), 3 per tile, slanted
    for k in range(3):
        c = (k + 0.5) / 3
        slant = (v - 0.5) * 0.08
        d = np.abs(((u - c - slant + 0.5) % 1.0) - 0.5)
        shoulder = (v < 0.2) | (v > 0.8)
        slot = (d < 0.035) & shoulder
        tread = np.where(slot, np.minimum(tread, 0.25 + 0.5 * _smoothstep(0.0, 0.035, d)), tread)
    # rib sipes: thin angled slits in the middle ribs, 6 per tile
    for k in range(6):
        c = (k + 0.5) / 6
        slant = (v - 0.5) * 0.25
        d = np.abs(((u - c - slant + 0.5) % 1.0) - 0.5)
        mid = (v > 0.26) & (v < 0.74)
        slit = (d < 0.008) & mid
        tread = np.where(slit, 0.45, tread)
    tread += rng.normal(0, 0.004, tread.shape)
    h[half:, :] = tread
    # --- sidewall (rows 0..half): v = 0 at the bead, 1 at the shoulder
    vs = np.linspace(0, 1, half, endpoint=False)[:, None]
    side = np.ones((half, size)) * 0.8
    ribs = 0.5 + 0.5 * np.cos(vs * math.tau * 22)
    side += np.where(vs < 0.22, 0.12 * ribs, 0.0)
    side += np.where((vs > 0.70) & (vs < 0.78), 0.06, 0.0)
    side = side + np.zeros((1, size))
    h[:half, :] = side
    return _save("tex_tyre_n", _normal_from_height(h * 3.0, 2.0))


def fins(size: int = 512) -> str:
    """Flat tubes every 1/8 of the tile + louvred zig-zag fins between them."""
    y = np.linspace(0, 1, size, endpoint=False)[:, None]
    x = np.linspace(0, 1, size, endpoint=False)[None, :]
    tubes = 8
    fy = (y * tubes) % 1.0
    tube_mask = _smoothstep(0.0, 0.05, fy) * (1 - _smoothstep(0.26, 0.31, fy))
    fin_pitch = 64
    zig = np.abs(((x * fin_pitch + fy * 0.5) % 1.0) - 0.5) * 2
    fin_h = 0.35 + 0.35 * zig
    louver = 0.06 * np.sin((fy * 6) * math.tau) * (1 - tube_mask)
    h = np.where(tube_mask > 0.5, 1.0, fin_h + louver) + 0 * x
    return _save("tex_fins_n", _normal_from_height(h * 4.0, 2.5))


def machined(size: int = 512) -> str:
    """Fine turning/grinding lines along u (constant along u), periodic, seeded jitter."""
    rng = np.random.default_rng(288)
    v = np.linspace(0, 1, size, endpoint=False)[:, None]
    u = np.linspace(0, 1, size, endpoint=False)[None, :]
    h = np.zeros((size, 1))
    for f in (97, 131, 173, 211, 257):
        h = h + rng.uniform(0.2, 1.0) * np.sin(v * math.tau * f + rng.uniform(0, math.tau))
    h = h / 5.0
    h = h + 0.15 * np.sin(u * math.tau * 3 + v * math.tau * 11) * 0.2
    return _save("tex_machined_n", _normal_from_height(h, 1.2))


def emboss(size: int = 512) -> str:
    """Hex dimple emboss (periodic lattice: 8 x 14 cells per tile)."""
    y = np.linspace(0, 1, size, endpoint=False)[:, None]
    x = np.linspace(0, 1, size, endpoint=False)[None, :]
    cols, rows = 8, 14
    h = np.zeros((size, size))
    for r in range(rows):
        for c in range(cols):
            cx = (c + 0.5 * (r % 2)) / cols
            cy = (r + 0.5) / rows
            dx = ((x - cx + 0.5) % 1.0) - 0.5
            dy = ((y - cy + 0.5) % 1.0) - 0.5
            d = np.sqrt((dx * cols) ** 2 + (dy * rows * 0.87) ** 2)
            h = np.maximum(h, np.clip(1 - d / 0.42, 0, 1) ** 2)
    return _save("tex_emboss_n", _normal_from_height(h * 6.0, 1.6))


def cast(size: int = 512) -> str:
    """Sand-cast surface: periodic band-limited noise (fine grain + soft blotches), seeded."""
    rng = np.random.default_rng(1998)
    fy = np.fft.fftfreq(size)[:, None]
    fx = np.fft.fftfreq(size)[None, :]
    f2 = fx * fx + fy * fy

    def band(sigma: float, amp: float) -> np.ndarray:
        noise = rng.normal(0.0, 1.0, (size, size))
        spec = np.fft.fft2(noise) * np.exp(-f2 / (2 * sigma * sigma))
        field = np.real(np.fft.ifft2(spec))
        return amp * field / (np.abs(field).max() + 1e-9)

    h = band(0.12, 1.0) + band(0.05, 0.35) + band(0.02, 0.10)
    return _save("tex_cast_n", _normal_from_height(h * 2.0, 1.0))


def generate_all() -> dict[str, str]:
    out = {
        "tex_tyre_n": tyre(),
        "tex_fins_n": fins(),
        "tex_machined_n": machined(),
        "tex_emboss_n": emboss(),
        "tex_cast_n": cast(),
    }
    log("textures", ", ".join(out))
    return out
