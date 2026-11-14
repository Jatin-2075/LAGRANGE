from fastapi import APIRouter

from app.services import terrain_service
from app.utils.raster_utils import inspect_raster

router = APIRouter(prefix="/api/v1/datasets", tags=["datasets"])

PLANNED = [
    {"name": "LOLA GDR", "use": "elevation, polar data"},
    {"name": "SLDEM2015", "use": "merged terrain (about 60N to 60S only, about 60 m/pixel)"},
    {"name": "LOLA surface roughness", "use": "regional roughness"},
    {"name": "LROC NAC imagery / DTMs", "use": "local hazards (craters, boulders)"},
    {"name": "LROC illumination maps", "use": "sunlight availability, shadowed regions"},
]


@router.get("")
def list_datasets() -> dict:
    dem = terrain_service.get_dem()
    return {
        "installed": [
            {
                "dataset_version": dem.dataset_version,
                "data_source": dem.data_source,
                "synthetic": dem.synthetic,
                "resolution_m": dem.resolution_m,
                "shape": list(dem.shape),
                "raster": inspect_raster(dem.source_path),
            }
        ],
        "planned_not_installed": PLANNED,
    }
