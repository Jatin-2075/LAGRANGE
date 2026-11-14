from pathlib import Path

import numpy as np

from app.engine.dem_loader import create_synthetic_south_pole_dem, load_dem
from app.utils.coordinates import (
    lunar_to_threejs_unit_sphere,
    threejs_unit_sphere_to_lunar,
)
from app.utils.raster_utils import inspect_raster


def test_synthetic_dem_loads_with_nodata_mask(tmp_path: Path) -> None:
    path = create_synthetic_south_pole_dem(tmp_path / "synthetic.tif", width=32, height=32)

    dem = load_dem(path, dataset_version="test-v1")

    assert dem.shape == (32, 32)
    assert dem.pixel_size_m == (10.0, 10.0)
    assert dem.crs is not None
    assert dem.valid_mask.any()
    assert (~dem.valid_mask).any()
    assert np.isnan(dem.elevation_m[~dem.valid_mask]).all()
    assert np.isfinite(dem.elevation_m[dem.valid_mask]).all()


def test_raster_metadata_exposes_projection_and_resolution(tmp_path: Path) -> None:
    path = create_synthetic_south_pole_dem(tmp_path / "synthetic.tif")

    metadata = inspect_raster(str(path))

    assert metadata["width"] == 128
    assert metadata["height"] == 128
    assert metadata["pixel_size_m"] == [10.0, 10.0]
    assert "1737400" in metadata["crs"]
    assert metadata["nodata"] == -9999.0


def test_lunar_threejs_conversion_round_trip() -> None:
    for latitude, longitude in ((-89.5, 35.2), (-85.0, -179.9), (0.0, 180.0)):
        position = lunar_to_threejs_unit_sphere(latitude, longitude)
        result = threejs_unit_sphere_to_lunar(*position)
        assert np.allclose(result, (latitude, longitude), atol=1e-10)
