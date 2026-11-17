import argparse
from pathlib import Path

import numpy as np
import rasterio

from app.engine.landing_zone import analyze_landing_zones
from app.services import terrain_service


def main() -> None:
    parser = argparse.ArgumentParser(description="Export derived terrain layers")
    parser.add_argument("--diameter", type=float, default=100.0, help="landing footprint diameter (m)")
    parser.add_argument("--max-slope", type=float, default=8.0, help="maximum slope (degrees)")
    parser.add_argument("--max-roughness", type=float, default=2.0, help="maximum roughness (m)")
    parser.add_argument("--out", type=Path, default=Path("data/processed"))
    args = parser.parse_args()

    layers = terrain_service.get_layers()
    dem = layers.dem
    landing = analyze_landing_zones(
        layers.slope_deg, layers.roughness_m, layers.hazard_mask, layers.terrain_valid,
        layers.pixel_m, args.diameter, args.max_slope, args.max_roughness,
    )
    if landing.status != "ok":
        raise SystemExit(f"Cannot evaluate a {args.diameter} m footprint: {landing.status}")

    outputs = {
        "elevation_m": dem.elevation_m,
        "slope_deg": layers.slope_deg,
        "roughness_m": layers.roughness_m,
        "hazard_mask": layers.hazard_mask.astype(np.float32),
        "landing_zone_mask": landing.mask.astype(np.float32),
    }
    if layers.illumination_pct is not None:
        outputs["illumination_pct_proxy"] = layers.illumination_pct

    args.out.mkdir(parents=True, exist_ok=True)
    for name, array in outputs.items():
        path = args.out / f"{name}.tif"
        with rasterio.open(
            path, "w", driver="GTiff", height=array.shape[0], width=array.shape[1], count=1,
            dtype="float32", crs=dem.crs, transform=dem.transform, nodata=np.nan, compress="deflate",
        ) as destination:
            destination.write(array.astype(np.float32), 1)
        print("wrote", path)
    print(f"landing-zone cells passing: {int(landing.mask.sum())} of {landing.mask.size}")


if __name__ == "__main__":
    main()
