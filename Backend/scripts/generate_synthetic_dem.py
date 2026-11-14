from pathlib import Path

from app.engine.dem_loader import create_synthetic_south_pole_dem, load_dem
from app.utils.raster_utils import inspect_raster


def main() -> None:
    output = Path(__file__).resolve().parents[1] / "data" / "raw" / "synthetic_south_pole.tif"
    create_synthetic_south_pole_dem(output)
    dem = load_dem(output, dataset_version="synthetic-south-pole-v1")
    print(inspect_raster(str(output)))
    print(
        f"loaded shape={dem.shape}, valid_pixels={int(dem.valid_mask.sum())}, "
        f"resolution_m={dem.resolution_m}"
    )


if __name__ == "__main__":
    main()
