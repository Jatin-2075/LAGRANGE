from fastapi import APIRouter, HTTPException

from app.schemas.mission import MissionRequest
from app.schemas.results import AnalysisResponse
from app.services import analysis_service, terrain_service

router = APIRouter(prefix="/api/v1/sites", tags=["sites"])


def _layers():
    try:
        return terrain_service.get_layers()
    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(status_code=503, detail=f"Terrain data unavailable: {error}") from error


@router.post("/analyze", response_model=AnalysisResponse)
def analyze_sites(request: MissionRequest) -> AnalysisResponse:
    """Run the terrain analysis for the submitted mission."""
    layers = _layers()
    return analysis_service.run_analysis(request, layers)
