import numpy as np
from scipy.ndimage import map_coordinates

from app.engine.roughness import fill_invalid


def illumination_percent(
    elevation_m: np.ndarray,
    valid: np.ndarray,
    pixel_m: float,
    *,
    sun_elevation_deg: float = 1.5,
    azimuths: int = 24,
    max_distance_m: float | None = None,
    samples: int = 24,
) -> np.ndarray:
    filled = fill_invalid(elevation_m, valid)
    rows, cols = np.indices(filled.shape).astype(np.float64)
    extent_m = max(filled.shape) * pixel_m
    max_distance_m = max_distance_m or extent_m / 2.0
    max_steps = max(1, int(max_distance_m / pixel_m))
    steps = np.unique(np.round(np.geomspace(1, max_steps, samples)).astype(int))
    tan_sun = np.tan(np.radians(sun_elevation_deg))

    lit = np.zeros(filled.shape, dtype=np.float64)
    for azimuth in np.linspace(0.0, 2.0 * np.pi, azimuths, endpoint=False):
        d_col, d_row = np.sin(azimuth), -np.cos(azimuth)
        horizon = np.full(filled.shape, -np.inf)
        for step in steps:
            sample_rows = rows + step * d_row
            sample_cols = cols + step * d_col
            inside = (
                (sample_rows >= 0) & (sample_rows <= filled.shape[0] - 1)
                & (sample_cols >= 0) & (sample_cols <= filled.shape[1] - 1)
            )
            height = map_coordinates(filled, [sample_rows, sample_cols], order=1, mode="nearest")
            slope = (height - filled) / (step * pixel_m)
            slope = np.where(inside, slope, -np.inf)
            horizon = np.maximum(horizon, slope)
        lit += horizon < tan_sun
    result = 100.0 * lit / azimuths
    result[~valid] = np.nan
    return result
