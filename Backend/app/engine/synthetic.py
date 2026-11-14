"""Deterministic synthetic South Pole terrain for development and tests.

This is NOT scientific lunar data. It exists so the whole pipeline can run end to end.
"""
from __future__ import annotations

import numpy as np

from app.engine.dem_types import LUNAR_REFERENCE_RADIUS_M, DemRaster, GridTransform

SYNTHETIC_VERSION = "synthetic-south-pole-v1"
SYNTHETIC_SOURCE = "synthetic development fixture; not scientific lunar data"


def synthetic_south_pole_elevation(
    width: int = 128,
    height: int = 128,
    pixel_size_m: float = 10.0,
    nodata: float = -9999.0,
) -> np.ndarray:
    if width < 16 or height < 16:
        raise ValueError("Synthetic DEM dimensions must be at least 16 by 16 pixels")
    if pixel_size_m <= 0:
        raise ValueError("Synthetic DEM pixel size must be positive")

    y, x = np.mgrid[0:height, 0:width]
    x_m = (x - (width - 1) / 2) * pixel_size_m
    y_m = ((height - 1) / 2 - y) * pixel_size_m
    elevation = 100.0 + 0.035 * x_m + 0.018 * y_m

    for crater_x, crater_y, crater_radius, depth in (
        (-180.0, 130.0, 80.0, 18.0),
        (170.0, -150.0, 55.0, 10.0),
        (20.0, 20.0, 35.0, 7.0),
    ):
        distance = np.hypot(x_m - crater_x, y_m - crater_y)
        depression = np.clip(1.0 - distance / crater_radius, 0.0, 1.0)
        elevation -= depth * depression**2

    rough_patch = (x_m > 120.0) & (x_m < 260.0) & (y_m > -80.0) & (y_m < 80.0)
    elevation += rough_patch * (4.0 * np.sin(x_m / 7.0) + 2.0 * np.cos(y_m / 5.0))

    invalid = ((x - width * 0.22) ** 2 + (y - height * 0.75) ** 2 < (width * 0.07) ** 2) | (
        (x > width * 0.72) & (x < width * 0.78) & (y > height * 0.18) & (y < height * 0.33)
    )
    elevation = elevation.astype(np.float32)
    elevation[invalid] = nodata
    return elevation


def build_synthetic_dem(width: int = 128, height: int = 128, pixel_size_m: float = 10.0) -> DemRaster:
    """In-memory synthetic DemRaster (no rasterio needed)."""
    nodata = -9999.0
    raw = synthetic_south_pole_elevation(width, height, pixel_size_m, nodata)
    valid = raw != nodata
    elevation = np.where(valid, raw, np.nan).astype(np.float64)
    transform = GridTransform(
        pixel_size_m, 0.0, -width * pixel_size_m / 2, 0.0, -pixel_size_m, height * pixel_size_m / 2
    )
    return DemRaster(
        elevation_m=elevation,
        valid_mask=valid,
        transform=transform,
        crs=None,
        pixel_size_m=(pixel_size_m, pixel_size_m),
        nodata=nodata,
        source_path="<in-memory synthetic>",
        dataset_version=SYNTHETIC_VERSION,
        data_source=SYNTHETIC_SOURCE,
        synthetic=True,
        radius_m=LUNAR_REFERENCE_RADIUS_M,
    )
