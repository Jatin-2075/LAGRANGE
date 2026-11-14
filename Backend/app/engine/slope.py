import numpy as np


def calculate_slope(elevation_m: np.ndarray, pixel_size_m: float | tuple[float, float]) -> np.ndarray:
    """Slope in degrees. Needs a metric projection and the true pixel size.

    Cells whose neighbours are NaN come out as NaN, never as zero.
    """
    if isinstance(pixel_size_m, tuple):
        px, py = pixel_size_m
    else:
        px = py = pixel_size_m
    if px <= 0 or py <= 0:
        raise ValueError("pixel size must be positive")
    dz_dy, dz_dx = np.gradient(elevation_m, py, px)
    return np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))
