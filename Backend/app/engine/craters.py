from dataclasses import dataclass

import numpy as np
from scipy.ndimage import binary_dilation, grey_closing, label

from app.engine.roughness import fill_invalid, odd_window


@dataclass(frozen=True)
class Depression:
    row: float
    col: float
    diameter_m: float
    depth_m: float


def _disk(radius: int) -> np.ndarray:
    y, x = np.ogrid[-radius : radius + 1, -radius : radius + 1]
    return (x * x + y * y) <= radius * radius


def _detrend(filled: np.ndarray, valid: np.ndarray) -> np.ndarray:
    rows, cols = np.indices(filled.shape)
    r, c, z = rows[valid], cols[valid], filled[valid]
    if z.size < 3:
        return filled
    design = np.column_stack([np.ones_like(z), r, c])
    coeffs, *_ = np.linalg.lstsq(design, z, rcond=None)
    plane = coeffs[0] + coeffs[1] * rows + coeffs[2] * cols
    return filled - plane


def detect_depressions(
    elevation_m: np.ndarray,
    valid: np.ndarray,
    pixel_m: float,
    *,
    min_depth_m: float = 2.0,
    min_diameter_m: float = 20.0,
    closing_window_m: float = 300.0,
    min_extent: float = 0.5,
    min_aspect: float = 0.5,
) -> tuple[list[Depression], np.ndarray]:
    if not valid.any():
        return [], np.zeros(elevation_m.shape, dtype=bool)

    detrended = _detrend(fill_invalid(elevation_m, valid), valid)
    window = odd_window(closing_window_m, pixel_m, minimum=5)

    depth = grey_closing(detrended, size=(window, window), mode="nearest") - detrended
    depth[~valid] = 0.0

    low_threshold = max(0.25 * min_depth_m, 1e-6)
    labels, count = label((depth >= low_threshold) & valid, structure=np.ones((3, 3)))
    mask = np.zeros(elevation_m.shape, dtype=bool)
    found: list[Depression] = []

    for index in range(1, count + 1):
        component = labels == index
        peak = float(depth[component].max())
        if peak < min_depth_m:
            continue
        rows, cols = np.nonzero(component)
        height = rows.max() - rows.min() + 1
        width = cols.max() - cols.min() + 1
        area = int(component.sum())
        diameter_m = 2.0 * np.sqrt(area / np.pi) * pixel_m
        extent = area / float(height * width)
        aspect = min(height, width) / float(max(height, width))
        if diameter_m < min_diameter_m or extent < min_extent or aspect < min_aspect:
            continue
        mask |= component
        found.append(
            Depression(
                row=float(rows.mean()),
                col=float(cols.mean()),
                diameter_m=float(diameter_m),
                depth_m=peak,
            )
        )
    return found, mask


def buffer_mask(mask: np.ndarray, pixel_m: float, buffer_m: float) -> np.ndarray:
    radius = int(np.ceil(buffer_m / pixel_m))
    if radius <= 0 or not mask.any():
        return mask.copy()
    return binary_dilation(mask, structure=_disk(radius))
