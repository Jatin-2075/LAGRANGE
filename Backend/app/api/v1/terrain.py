from fastapi import APIRouter, HTTPException, Query

from app.services import terrain_service

router = APIRouter(prefix="/api/v1/terrain", tags=["terrain"])


def _sample(latitude: float, longitude: float) -> dict:
    try:
        layers = terrain_service.get_layers()
    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(status_code=503, detail=f"Terrain data unavailable: {error}") from error
    point = terrain_service.sample_point(layers, latitude, longitude)
    if point is None:
        raise HTTPException(
            status_code=404,
            detail="insufficient_data: coordinate is outside the loaded DEM coverage",
        )
    return point


@router.get("/elevation")
def elevation(latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=180)) -> dict:
    point = _sample(latitude, longitude)
    return {k: point[k] for k in ("latitude", "longitude", "elevation_m", "valid", "dataset_version", "resolution_m")}


@router.get("/slope")
def slope(latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=180)) -> dict:
    point = _sample(latitude, longitude)
    return {
        k: point[k]
        for k in ("latitude", "longitude", "slope_degrees", "roughness_m", "in_detected_hazard",
                  "valid", "dataset_version", "resolution_m")
    }
