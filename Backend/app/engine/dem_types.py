"""DEM container that does not depend on rasterio, so the numerical engine stays testable."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, NamedTuple

import numpy as np

LUNAR_REFERENCE_RADIUS_M = 1_737_400.0


class GridTransform(NamedTuple):
    """Same field names as rasterio's Affine (north-up rasters only)."""

    a: float
    b: float
    c: float
    d: float
    e: float
    f: float


@dataclass(frozen=True, eq=False)
class DemRaster:
    """A DEM array plus everything needed to interpret it.

    The raster must be in a south-polar azimuthal-equidistant metric projection.
    """

    elevation_m: np.ndarray
    valid_mask: np.ndarray
    transform: Any
    crs: Any
    pixel_size_m: tuple[float, float]
    nodata: float | None
    source_path: str
    dataset_version: str
    data_source: str = "unknown"
    synthetic: bool = False
    radius_m: float = LUNAR_REFERENCE_RADIUS_M

    @property
    def resolution_m(self) -> float:
        return max(self.pixel_size_m)

    @property
    def shape(self) -> tuple[int, int]:
        return self.elevation_m.shape

    def pixel_centres_xy(self) -> tuple[np.ndarray, np.ndarray]:
        """Projected x/y (metres) of every pixel centre, as 2D arrays."""
        rows, cols = np.indices(self.shape)
        x = self.transform.c + (cols + 0.5) * self.transform.a
        y = self.transform.f + (rows + 0.5) * self.transform.e
        return x, y

    def xy_to_rowcol(self, x: float, y: float) -> tuple[int, int]:
        col = int(np.floor((x - self.transform.c) / self.transform.a))
        row = int(np.floor((y - self.transform.f) / self.transform.e))
        return row, col

    def contains(self, row: int, col: int) -> bool:
        return 0 <= row < self.shape[0] and 0 <= col < self.shape[1]
