"""Loads the configured DEM once and caches its derived layers."""
from functools import lru_cache
from pathlib import Path

from app.core import settings
from app.engine.dem_loader import create_synthetic_south_pole_dem, load_dem
from app.engine.dem_types import DemRaster
from app.engine.terrain_layers import TerrainLayers, build_layers
from app.utils.coordinates import south_polar_latlon_to_xy


def _ensure_dem(path: Path) -> Path:
    if not path.exists():
        create_synthetic_south_pole_dem(path)
    return path


@lru_cache(maxsize=1)
def get_dem() -> DemRaster:
    path = _ensure_dem(settings.DEM_PATH)
    return load_dem(
        path,
        dataset_version=settings.DATASET_VERSION or "unknown",
        data_source=settings.DATA_SOURCE or None,
    )


@lru_cache(maxsize=1)
def get_layers() -> TerrainLayers:
    return build_layers(
        get_dem(),
        roughness_window_m=settings.ROUGHNESS_WINDOW_M,
        hazard_buffer_m=settings.HAZARD_BUFFER_M,
        crater_min_depth_m=settings.CRATER_MIN_DEPTH_M,
        crater_min_diameter_m=settings.CRATER_MIN_DIAMETER_M,
        sun_elevation_deg=settings.SUN_ELEVATION_DEG,
        illumination_max_pixels=settings.ILLUMINATION_MAX_PIXELS,
    )


def sample_point(layers: TerrainLayers, latitude: float, longitude: float) -> dict | None:
    """Terrain values at a coordinate, or None when it lies outside the DEM."""
    dem = layers.dem
    x, y = south_polar_latlon_to_xy(latitude, longitude, dem.radius_m)
    row, col = dem.xy_to_rowcol(float(x), float(y))
    if not dem.contains(row, col):
        return None
    valid = bool(layers.terrain_valid[row, col])
    return {
        "latitude": latitude,
        "longitude": longitude,
        "row": row,
        "col": col,
        "valid": valid,
        "elevation_m": float(dem.elevation_m[row, col]) if dem.valid_mask[row, col] else None,
        "slope_degrees": float(layers.slope_deg[row, col]) if valid else None,
        "roughness_m": float(layers.roughness_m[row, col]) if valid else None,
        "in_detected_hazard": bool(layers.hazard_mask[row, col]),
        "dataset_version": dem.dataset_version,
        "resolution_m": dem.resolution_m,
    }
