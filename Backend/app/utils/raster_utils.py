from typing import Any

import rasterio


def inspect_raster(path: str) -> dict[str, Any]:
    with rasterio.open(path) as dataset:
        return {
            "path": str(path),
            "driver": dataset.driver,
            "width": dataset.width,
            "height": dataset.height,
            "bands": dataset.count,
            "dtype": dataset.dtypes[0],
            "crs": dataset.crs.to_string() if dataset.crs else None,
            "transform": tuple(dataset.transform),
            "pixel_size_m": [abs(dataset.transform.a), abs(dataset.transform.e)],
            "nodata": dataset.nodata,
            "bounds": [dataset.bounds.left, dataset.bounds.bottom, dataset.bounds.right, dataset.bounds.top],
        }
