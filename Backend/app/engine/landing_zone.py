from dataclasses import dataclass

import numpy as np
from scipy.ndimage import convolve, maximum_filter


def disk(radius: int) -> np.ndarray:
    y, x = np.ogrid[-radius : radius + 1, -radius : radius + 1]
    return (x * x + y * y) <= radius * radius


@dataclass(frozen=True)
class LandingAnalysis:
    status: str
    radius_px: int
    mask: np.ndarray | None = None
    worst_slope: np.ndarray | None = None
    worst_roughness: np.ndarray | None = None
    valid_fraction: np.ndarray | None = None
    footprint: np.ndarray | None = None


def footprint_radius_px(diameter_m: float, pixel_m: float) -> int:
    return int(np.ceil(diameter_m / 2.0 / pixel_m))


def analyze_landing_zones(
    slope: np.ndarray,
    roughness: np.ndarray,
    hazard: np.ndarray,
    valid: np.ndarray,
    pixel_m: float,
    diameter_m: float,
    max_slope: float,
    max_roughness: float,
    min_valid: float = 0.95,
) -> LandingAnalysis:
    radius = footprint_radius_px(diameter_m, pixel_m)
    if radius < 2:
        return LandingAnalysis(status="insufficient_resolution", radius_px=radius)

    fp = disk(radius)
    weights = fp / fp.sum()
    cell_valid = valid & np.isfinite(slope) & np.isfinite(roughness)

    valid_fraction = convolve(cell_valid.astype(np.float64), weights, mode="constant")
    worst_slope = maximum_filter(np.where(cell_valid, slope, 0.0), footprint=fp, mode="constant")
    worst_rough = maximum_filter(np.where(cell_valid, roughness, 0.0), footprint=fp, mode="constant")
    hazard_hit = maximum_filter(hazard.astype(np.uint8), footprint=fp, mode="constant") > 0

    ok = (
        cell_valid
        & (valid_fraction >= min_valid)
        & (worst_slope <= max_slope)
        & (worst_rough <= max_roughness)
        & ~hazard_hit
    )
    return LandingAnalysis(
        status="ok",
        radius_px=radius,
        mask=ok,
        worst_slope=worst_slope,
        worst_roughness=worst_rough,
        valid_fraction=valid_fraction,
        footprint=fp,
    )


def footprint_mean(values: np.ndarray, valid: np.ndarray, footprint: np.ndarray) -> np.ndarray:
    weights = footprint / footprint.sum()
    total = convolve(np.where(valid, values, 0.0), weights, mode="constant")
    fraction = convolve(valid.astype(np.float64), weights, mode="constant")
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(fraction > 0, total / fraction, np.nan)


def select_top_sites(
    score: np.ndarray,
    candidates: np.ndarray,
    pixel_m: float,
    min_separation_m: float,
    top_k: int,
) -> list[tuple[int, int]]:
    rows, cols = np.nonzero(candidates)
    if rows.size == 0:
        return []
    values = score[rows, cols]
    order = np.lexsort((cols, rows, -values))
    rows, cols = rows[order], cols[order]

    separation_sq = (min_separation_m / pixel_m) ** 2
    alive = np.ones(rows.size, dtype=bool)
    chosen: list[tuple[int, int]] = []
    for i in range(rows.size):
        if not alive[i]:
            continue
        chosen.append((int(rows[i]), int(cols[i])))
        if len(chosen) >= top_k:
            break
        alive &= ((rows - rows[i]) ** 2 + (cols - cols[i]) ** 2) >= separation_sq
    return chosen
