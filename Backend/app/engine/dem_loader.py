from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import Affine

from app.engine.dem_types import LUNAR_REFERENCE_RADIUS_M, DemRaster
from app.engine.synthetic import (
    SYNTHETIC_SOURCE,
    SYNTHETIC_VERSION,
    synthetic_south_pole_elevation,
)

__all__ = ["DemRaster", "load_dem", "create_synthetic_south_pole_dem"]

SOUTH_POLE_AEQD_PROJ4 = "+proj=aeqd +lat_0=-90 +lon_0=0 +R=1737400 +units=m +no_defs"


def _projection_radius(crs: CRS) -> float:
    """Check the CRS is a south-polar azimuthal equidistant projection; return the sphere radius.

    Only a positively different projection is rejected. If pyproj cannot describe the CRS we
    assume the file follows the documented convention rather than blocking the load.
    """
    try:
        from pyproj import CRS as ProjCRS

        info = ProjCRS.from_wkt(crs.to_wkt()).to_dict()
    except Exception:
        return LUNAR_REFERENCE_RADIUS_M

    projection = info.get("proj")
    if projection is not None and projection != "aeqd":
        raise ValueError(
            f"Unsupported projection '{projection}'. The analysis engine needs a south-polar "
            "azimuthal equidistant (aeqd, lat_0=-90) DEM in metres."
        )
    if "lat_0" in info and float(info["lat_0"]) != -90.0:
        raise ValueError("Unsupported projection centre. Reproject the DEM to lat_0=-90.")
    if info.get("units", "m") != "m":
        raise ValueError("DEM projection units must be metres.")
    return float(info.get("R", info.get("a", LUNAR_REFERENCE_RADIUS_M)))


def load_dem(
    path: str | Path,
    dataset_version: str = "unknown",
    data_source: str | None = None,
) -> DemRaster:
    """Load one-band elevation data, converting NoData cells to NaN."""
    source_path = Path(path)
    if not source_path.is_file():
        raise FileNotFoundError(f"DEM raster does not exist: {source_path}")

    with rasterio.open(source_path) as dataset:
        if dataset.count < 1:
            raise ValueError(f"DEM raster has no bands: {source_path}")
        if dataset.crs is None:
            raise ValueError(f"DEM raster has no coordinate reference system: {source_path}")
        if dataset.transform.b != 0 or dataset.transform.d != 0:
            raise ValueError("Rotated rasters are not supported; use a north-up DEM")

        radius = _projection_radius(dataset.crs)
        tags = dataset.tags()
        band = dataset.read(1, masked=True)
        elevation = np.asarray(band.filled(np.nan), dtype=np.float64)
        valid_mask = ~np.ma.getmaskarray(band) & np.isfinite(elevation)
        pixel_size = (abs(dataset.transform.a), abs(dataset.transform.e))

        if dataset_version == "unknown":
            dataset_version = tags.get("dataset_version", "unknown")
        source_text = data_source or tags.get("data_source", "unknown")
        synthetic = "synthetic" in dataset_version.lower() or "synthetic" in source_text.lower()

        return DemRaster(
            elevation_m=elevation,
            valid_mask=valid_mask,
            transform=dataset.transform,
            crs=dataset.crs,
            pixel_size_m=pixel_size,
            nodata=dataset.nodata,
            source_path=str(source_path.resolve()),
            dataset_version=dataset_version,
            data_source=source_text,
            synthetic=synthetic,
            radius_m=radius,
        )


def create_synthetic_south_pole_dem(
    path: str | Path,
    *,
    width: int = 128,
    height: int = 128,
    pixel_size_m: float = 10.0,
    nodata: float = -9999.0,
) -> Path:
    """Write the deterministic synthetic lunar DEM used for development."""
    elevation = synthetic_south_pole_elevation(width, height, pixel_size_m, nodata)

    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    transform = Affine.translation(-width * pixel_size_m / 2, height * pixel_size_m / 2) @ Affine.scale(
        pixel_size_m, -pixel_size_m
    )
    crs = CRS.from_proj4(SOUTH_POLE_AEQD_PROJ4)
    with rasterio.open(
        destination,
        "w",
        driver="GTiff",
        width=width,
        height=height,
        count=1,
        dtype="float32",
        crs=crs,
        transform=transform,
        nodata=nodata,
        compress="deflate",
    ) as dataset:
        dataset.write(elevation, 1)
        dataset.update_tags(
            dataset_version=SYNTHETIC_VERSION,
            data_source=SYNTHETIC_SOURCE,
            lunar_reference_radius_m="1737400",
        )
    return destination
