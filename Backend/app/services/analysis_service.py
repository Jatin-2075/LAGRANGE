"""Orchestrates the landing-site analysis: hard constraints first, then ranking."""
import hashlib
import json
import uuid
from datetime import datetime, timezone

import numpy as np
from scipy.ndimage import distance_transform_edt

from app.engine.landing_zone import analyze_landing_zones, footprint_mean, select_top_sites
from app.engine.scoring import compute_weights, score_sites
from app.engine.terrain_layers import TerrainLayers
from app.schemas.mission import MissionRequest
from app.schemas.results import AnalysisResponse, AnalysisSummary, SiteMetrics, SiteResult
from app.utils.coordinates import south_polar_xy_to_latlon

ALGORITHM_VERSION = "0.2.0"
ANALYSIS_STAGE = "phase2_5_terrain_landing_scoring"
MIN_VALID_FRACTION = 0.95


def cache_key(request: MissionRequest, layers: TerrainLayers, weights: dict[str, float]) -> str:
    """Normalised request + dataset + algorithm + weights, so stale results cannot sneak back."""
    payload = {
        "request": request.model_dump(mode="json"),
        "dataset_version": layers.dem.dataset_version,
        "resolution_m": layers.pixel_m,
        "algorithm_version": ALGORITHM_VERSION,
        "weights": weights,
        "roughness_window_m": layers.roughness_window_m,
    }
    text = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode()).hexdigest()


def request_weights(request: MissionRequest, layers: TerrainLayers) -> dict[str, float]:
    return compute_weights(
        request.preferences.sunlight,
        request.preferences.resource_proximity,
        illumination_available=layers.illumination_pct is not None,
        resource_available=False,
        risk_tolerance=request.profile.risk_tolerance,
    )


def _confidence(layers: TerrainLayers, diameter_m: float, valid_fraction: float) -> str:
    if layers.dem.synthetic:
        return "low"
    pixels_across = diameter_m / layers.pixel_m
    level = 0 if pixels_across < 10 else 1 if pixels_across < 20 else 2
    if valid_fraction < 0.98:
        level = max(0, level - 1)
    return ("low", "medium", "high")[level]


def _footprint_geojson(layers: TerrainLayers, row: int, col: int, diameter_m: float) -> dict:
    dem = layers.dem
    centre_x = dem.transform.c + (col + 0.5) * dem.transform.a
    centre_y = dem.transform.f + (row + 0.5) * dem.transform.e
    angles = np.radians(np.arange(0, 361, 10))
    lat, lon = south_polar_xy_to_latlon(
        centre_x + diameter_m / 2 * np.cos(angles),
        centre_y + diameter_m / 2 * np.sin(angles),
        dem.radius_m,
    )
    ring = [[round(float(a), 6), round(float(b), 6)] for a, b in zip(lon, lat)]
    ring[-1] = ring[0]
    return {
        "type": "Feature",
        "properties": {"diameter_m": diameter_m},
        "geometry": {"type": "Polygon", "coordinates": [ring]},
    }


def _response(
    request: MissionRequest,
    layers: TerrainLayers,
    *,
    status: str,
    summary: AnalysisSummary,
    results: list[SiteResult],
    now: datetime,
) -> AnalysisResponse:
    return AnalysisResponse(
        analysis_id=f"LUNA-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}",
        status=status,
        mission_name=request.mission_name,
        dataset_version=layers.dem.dataset_version,
        resolution_m=layers.pixel_m,
        confidence="low" if not results else max((r.confidence for r in results), key=("low", "medium", "high").index),
        synthetic_data=layers.dem.synthetic,
        algorithm_version=ALGORITHM_VERSION,
        analysis_stage=ANALYSIS_STAGE,
        created_at=now,
        summary=summary,
        results=results,
    )


def run_analysis(request: MissionRequest, layers: TerrainLayers) -> AnalysisResponse:
    now = datetime.now(timezone.utc)
    dem = layers.dem
    region = request.region
    constraints = request.constraints
    diameter = constraints.min_landing_diameter_m

    in_region = (
        (layers.latitude >= region.latitude_min)
        & (layers.latitude <= region.latitude_max)
        & (layers.longitude >= region.longitude_min)
        & (layers.longitude <= region.longitude_max)
    )
    region_valid = in_region & layers.terrain_valid
    n_region = int(region_valid.sum())
    if n_region == 0:
        message = (
            "The requested region does not overlap any valid terrain data in the loaded DEM "
            f"({dem.dataset_version}). Nothing is assumed safe where data is missing."
        )
        return _response(
            request, layers, status="insufficient_data", now=now, results=[],
            summary=AnalysisSummary(
                candidate_centres_in_region=0, candidates_passing_constraints=0, sites_returned=0,
                detected_depressions=len(layers.depressions), message=message,
            ),
        )

    hazard = layers.hazard_mask if constraints.avoid_craters else np.zeros_like(layers.hazard_mask)
    landing = analyze_landing_zones(
        layers.slope_deg, layers.roughness_m, hazard, layers.terrain_valid, layers.pixel_m,
        diameter, constraints.max_slope_degrees, constraints.max_roughness, MIN_VALID_FRACTION,
    )
    if landing.status == "insufficient_resolution":
        message = (
            f"DEM resolution is {layers.pixel_m:g} m/pixel, too coarse to evaluate a {diameter:g} m "
            "landing footprint (needs at least 2 pixels of footprint radius)."
        )
        return _response(
            request, layers, status="insufficient_resolution", now=now, results=[],
            summary=AnalysisSummary(
                candidate_centres_in_region=n_region, candidates_passing_constraints=0, sites_returned=0,
                footprint_radius_px=landing.radius_px, detected_depressions=len(layers.depressions),
                message=message,
            ),
        )

    candidates = landing.mask & in_region
    n_pass = int(candidates.sum())
    weights = request_weights(request, layers)

    illumination_mean = None
    if layers.illumination_pct is not None:
        illumination_mean = footprint_mean(
            np.nan_to_num(layers.illumination_pct), layers.terrain_valid, landing.footprint
        )

    score_grid = np.zeros(layers.slope_deg.shape)
    if n_pass:
        score_grid = score_sites(
            landing.worst_slope, landing.worst_roughness, illumination_mean, None,
            constraints.max_slope_degrees, constraints.max_roughness, weights,
        )

    chosen = select_top_sites(score_grid, candidates, layers.pixel_m, diameter, request.top_k)

    hazard_distance = None
    if hazard.any():
        hazard_distance = distance_transform_edt(~hazard) * layers.pixel_m

    flags = ["roughness_window_%gm" % layers.roughness_window_m, "crater_detection_dem_morphology_only",
             "no_boulder_detection", "resource_proximity_unavailable"]
    if illumination_mean is not None:
        flags.append("illumination_dem_horizon_proxy")
    else:
        flags.append("illumination_unavailable")
    if dem.synthetic:
        flags.insert(0, "synthetic_dem_not_scientific")
    flags.extend(layers.notes)

    sites: list[SiteResult] = []
    for rank, (row, col) in enumerate(chosen, start=1):
        valid_fraction = float(landing.valid_fraction[row, col])
        illum = float(illumination_mean[row, col]) if illumination_mean is not None else None
        slope_w = float(landing.worst_slope[row, col])
        rough_w = float(landing.worst_roughness[row, col])
        explanation = [
            f"Worst slope in the {diameter:g} m footprint is {slope_w:.1f} deg (limit {constraints.max_slope_degrees:g} deg).",
            f"Worst local roughness is {rough_w:.2f} m (limit {constraints.max_roughness:g} m).",
            f"{valid_fraction * 100:.0f}% of the footprint has valid terrain data.",
        ]
        distances: dict[str, float] = {}
        if hazard_distance is not None:
            distances["nearest_detected_crater_m"] = round(float(hazard_distance[row, col]), 1)
            explanation.append(
                f"No detected crater inside the footprint; nearest detected crater is about "
                f"{distances['nearest_detected_crater_m']:.0f} m away (includes safety buffer)."
            )
        elif constraints.avoid_craters:
            explanation.append("No craters were detected in this DEM.")
        if illum is not None:
            explanation.append(f"Illumination proxy {illum:.0f}% (DEM horizon model, not LROC data).")
        if dem.synthetic:
            explanation.append("Synthetic development terrain: shows the pipeline works, not a lunar assessment.")

        x = dem.transform.c + (col + 0.5) * dem.transform.a
        y = dem.transform.f + (row + 0.5) * dem.transform.e
        lat, lon = south_polar_xy_to_latlon(x, y, dem.radius_m)
        sites.append(
            SiteResult(
                site_id=f"SITE-{rank:03d}",
                rank=rank,
                latitude=round(float(lat), 6),
                longitude=round(float(lon), 6),
                score=round(float(score_grid[row, col]), 2),
                metrics=SiteMetrics(
                    elevation_m=round(float(dem.elevation_m[row, col]), 2),
                    max_slope_degrees=round(slope_w, 2),
                    roughness_m=round(rough_w, 3),
                    illumination=round(illum, 1) if illum is not None else None,
                    resource_proximity=None,
                    valid_pixel_fraction=round(valid_fraction, 4),
                ),
                constraints_passed=True,
                confidence=_confidence(layers, diameter, valid_fraction),
                explanation=explanation,
                landing_footprint=_footprint_geojson(layers, row, col, diameter),
                hazard_distances_m=distances,
                data_source=dem.data_source,
                resolution_m=layers.pixel_m,
                quality_flags=list(flags),
                scoring_weights=weights,
                processed_at=now,
            )
        )

    message = None
    if not sites:
        message = "No candidate satisfied every hard constraint. Relax slope, roughness or footprint size."
    return _response(
        request, layers, status="completed", now=now, results=sites,
        summary=AnalysisSummary(
            candidate_centres_in_region=n_region,
            candidates_passing_constraints=n_pass,
            sites_returned=len(sites),
            footprint_radius_px=landing.radius_px,
            detected_depressions=len(layers.depressions),
            message=message,
        ),
    )
