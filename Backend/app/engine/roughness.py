import numpy as np
from scipy.ndimage import correlate, distance_transform_edt


def fill_invalid(values: np.ndarray, valid: np.ndarray) -> np.ndarray:
    if valid.all():
        return values.astype(np.float64)
    if not valid.any():
        return np.zeros_like(values, dtype=np.float64)
    indices = distance_transform_edt(~valid, return_distances=False, return_indices=True)
    return values[tuple(indices)].astype(np.float64)


def odd_window(size_m: float, pixel_m: float, minimum: int = 3) -> int:
    pixels = max(minimum, int(round(size_m / pixel_m)))
    return pixels if pixels % 2 == 1 else pixels + 1


def calculate_roughness(
    elevation_m: np.ndarray,
    valid: np.ndarray,
    pixel_m: float,
    window_m: float = 50.0,
    min_valid_fraction: float = 0.8,
) -> np.ndarray:
    window = odd_window(window_m, pixel_m)
    half = window // 2
    offsets = np.arange(-half, half + 1, dtype=np.float64) * pixel_m
    u_grid, v_grid = np.meshgrid(offsets, offsets)
    n = window * window

    filled = fill_invalid(elevation_m, valid)
    filled = filled - filled[valid].mean() if valid.any() else filled

    mean = correlate(filled, np.full((window, window), 1.0 / n), mode="nearest")
    mean_sq = correlate(filled * filled, np.full((window, window), 1.0 / n), mode="nearest")
    cov_u = correlate(filled, u_grid / n, mode="nearest")
    cov_v = correlate(filled, v_grid / n, mode="nearest")
    var_u = float((u_grid**2).sum() / n)
    var_v = float((v_grid**2).sum() / n)

    variance = mean_sq - mean**2 - cov_u**2 / var_u - cov_v**2 / var_v
    roughness = np.sqrt(np.clip(variance, 0.0, None))

    valid_fraction = correlate(valid.astype(np.float64), np.full((window, window), 1.0 / n), mode="constant")
    roughness[valid_fraction < min_valid_fraction] = np.nan
    roughness[~valid] = np.nan
    roughness[:half, :] = np.nan
    roughness[-half:, :] = np.nan
    roughness[:, :half] = np.nan
    roughness[:, -half:] = np.nan
    return roughness
