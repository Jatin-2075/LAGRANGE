"""Derived terrain layers computed once per DEM (slope, roughness, hazards, illumination, lat/lon)."""
from dataclasses import dataclass, field

import numpy as np

from app.engine.craters import Depression, buffer_mask, detect_depressions
from app.engine.dem_types import DemRaster
from app.engine.illumination import illumination_percent
from app.engine.roughness import calculate_roughness
from app.engine.slope import calculate_slope
from app.utils.coordinates import south_polar_xy_to_latlon


@dataclass(frozen=True, eq=False)
class TerrainLayers:
    dem: DemRaster
    pixel_m: float
    slope_deg: np.ndarray
    roughness_m: np.ndarray
    terrain_valid: np.ndarray
    hazard_mask: np.ndarray
    depressions: list[Depression]
    illumination_pct: np.ndarray | None
    latitude: np.ndarray
    longitude: np.ndarray
    roughness_window_m: float
    notes: list[str] = field(default_factory=list)


def build_layers(
    dem: DemRaster,
    *,
    roughness_window_m: float = 50.0,
    hazard_buffer_m: float = 10.0,
    crater_min_depth_m: float = 2.0,
    crater_min_diameter_m: float = 20.0,
    sun_elevation_deg: float = 1.5,
    illumination_max_pixels: int = 4_000_000,
) -> TerrainLayers:
    px, py = dem.pixel_size_m
    if abs(px - py) > 1e-6 * max(px, py):
        raise ValueError("Non-square pixels are not supported; resample the DEM first")
    pixel_m = float(px)

    slope = calculate_slope(dem.elevation_m, (px, py))
    roughness = calculate_roughness(dem.elevation_m, dem.valid_mask, pixel_m, roughness_window_m)
    terrain_valid = dem.valid_mask & np.isfinite(slope) & np.isfinite(roughness)

    depressions, crater_extent = detect_depressions(
        dem.elevation_m,
        dem.valid_mask,
        pixel_m,
        min_depth_m=crater_min_depth_m,
        min_diameter_m=crater_min_diameter_m,
    )
    hazard = buffer_mask(crater_extent, pixel_m, hazard_buffer_m)

    notes: list[str] = []
    if dem.valid_mask.size <= illumination_max_pixels:
        illumination = illumination_percent(
            dem.elevation_m, dem.valid_mask, pixel_m, sun_elevation_deg=sun_elevation_deg
        )
    else:
        illumination = None
        notes.append("illumination_skipped_raster_too_large")

    x, y = dem.pixel_centres_xy()
    latitude, longitude = south_polar_xy_to_latlon(x, y, dem.radius_m)
    return TerrainLayers(
        dem=dem,
        pixel_m=pixel_m,
        slope_deg=slope,
        roughness_m=roughness,
        terrain_valid=terrain_valid,
        hazard_mask=hazard,
        depressions=depressions,
        illumination_pct=illumination,
        latitude=latitude,
        longitude=longitude,
        roughness_window_m=roughness_window_m,
        notes=notes,
    )
