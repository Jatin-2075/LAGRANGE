from fastapi import APIRouter, HTTPException

from app.database import repository
from app.schemas.mission import MissionRequest
from app.schemas.results import AnalysisResponse, SiteResult
from app.services import analysis_service, terrain_service

router = APIRouter(prefix="/api/v1/sites", tags=["sites"])


def _layers():
    try:
        return terrain_service.get_layers()
    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(status_code=503, detail=f"Terrain data unavailable: {error}") from error


@router.post("/analyze", response_model=AnalysisResponse)
def analyze_sites(request: MissionRequest) -> AnalysisResponse:
    """Hard constraints first, then ranking. Identical requests are served from the cache."""
    layers = _layers()
    weights = analysis_service.request_weights(request, layers)
    key = analysis_service.cache_key(request, layers, weights)

    cached = repository.find_by_cache_key(key)
    if cached is not None:
        cached.summary.cache_hit = True
        return cached

    response = analysis_service.run_analysis(request, layers)
    repository.save_analysis(key, request.model_dump(mode="json"), response)
    return response


def _get_or_404(analysis_id: str) -> AnalysisResponse:
    analysis = repository.get_analysis(analysis_id)
    if analysis is None:
        raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found")
    return analysis


@router.get("/{analysis_id}", response_model=AnalysisResponse)
def get_analysis(analysis_id: str) -> AnalysisResponse:
    return _get_or_404(analysis_id)


@router.get("/{analysis_id}/results", response_model=list[SiteResult])
def get_results(analysis_id: str) -> list[SiteResult]:
    return _get_or_404(analysis_id).results


@router.get("/{analysis_id}/results/{site_id}", response_model=SiteResult)
def get_site(analysis_id: str, site_id: str) -> SiteResult:
    for site in _get_or_404(analysis_id).results:
        if site.site_id == site_id:
            return site
    raise HTTPException(status_code=404, detail=f"Site {site_id} not found in {analysis_id}")
