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

ALGORITHM_VERSION = "0.3.0"
ANALYSIS_STAGE = "spacecraft_aware_terrain_landing_scoring"
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


def _synthetic_global_footprint(latitude: float, longitude: float, diameter_m: float) -> dict:
    radius_deg = diameter_m / (2 * 1_737_400) * 180 / np.pi
    angles = np.radians(np.arange(0, 361, 15))
    lat = np.clip(latitude + radius_deg * np.cos(angles), -90, 90)
    lon = longitude + radius_deg * np.sin(angles) / max(np.cos(np.radians(latitude)), 0.15)
    lon = (lon + 180) % 360 - 180
    ring = [[round(float(item_lon), 6), round(float(item_lat), 6)] for item_lon, item_lat in zip(lon, lat)]
    ring[-1] = ring[0]
    return {
        "type": "Feature",
        "properties": {"diameter_m": diameter_m},
        "geometry": {"type": "Polygon", "coordinates": [ring]},
    }


def _run_synthetic_global_analysis(
    request: MissionRequest, layers: TerrainLayers, now: datetime
) -> AnalysisResponse:
    """Provide deterministic whole-Moon planning coverage while only demo data is installed."""
    region = request.region
    spacecraft = request.spacecraft
    max_slope = min(request.constraints.max_slope_degrees, spacecraft.max_landing_slope_degrees)
    max_roughness = min(request.constraints.max_roughness, spacecraft.max_surface_roughness_m)
    diameter = max(request.constraints.min_landing_diameter_m, spacecraft.landing_footprint_diameter_m)
    lat_step = max(1.0, min(5.0, (region.latitude_max - region.latitude_min) / 18))
    lon_step = max(1.0, min(5.0, (region.longitude_max - region.longitude_min) / 36))
    latitudes = np.arange(region.latitude_min, region.latitude_max + lat_step * 0.5, lat_step)
    longitudes = np.arange(region.longitude_min, region.longitude_max + lon_step * 0.5, lon_step)
    propellant_fraction = spacecraft.propellant_mass_kg / (
        spacecraft.dry_mass_kg + spacecraft.payload_mass_kg + spacecraft.propellant_mass_kg
    )
    propellant_per_day = spacecraft.propellant_mass_kg / spacecraft.mission_duration_days
    propellant_fit = float(np.clip(propellant_fraction / 0.35, 0, 1) * np.clip(propellant_per_day / 20, 0.5, 1))

    candidates: list[tuple[float, float, float, float, float, float]] = []
    for latitude in latitudes:
        for longitude in longitudes:
            terrain_wave = np.sin(np.radians(latitude * 3.7)) + np.cos(np.radians(longitude * 2.3))
            slope = 2.2 + abs(terrain_wave) * 2.7 + abs(np.sin(np.radians(longitude * 5))) * 1.4
            roughness = 0.18 + abs(np.cos(np.radians(latitude * 4 + longitude))) * 0.85
            illumination = float(
                np.clip(52 + 38 * np.cos(np.radians(latitude + 12)) - 12 * np.sin(np.radians(longitude * 2)), 0, 100)
            )
            crater_risk = np.sin(np.radians(latitude * 8 + longitude * 3)) > 0.96
            if slope > max_slope or roughness > max_roughness or (request.constraints.avoid_craters and crater_risk):
                continue
            terrain_fit = float(np.clip(1 - 0.55 * slope / max_slope - 0.45 * roughness / max_roughness, 0, 1))
            score = 100 * (0.55 * terrain_fit + 0.3 * illumination / 100 + 0.15 * propellant_fit)
            candidates.append((score, float(latitude), float(longitude), slope, roughness, illumination))

    candidates.sort(reverse=True)
    results: list[SiteResult] = []
    for rank, (score, latitude, longitude, slope, roughness, illumination) in enumerate(candidates[: request.top_k], 1):
        craft_fit = float(np.clip(1 - 0.55 * slope / max_slope - 0.45 * roughness / max_roughness, 0, 1))
        results.append(
            SiteResult(
                site_id=f"SITE-{rank:03d}",
                rank=rank,
                latitude=round(latitude, 6),
                longitude=round(longitude, 6),
                score=round(score, 2),
                metrics=SiteMetrics(
                    max_slope_degrees=round(slope, 2),
                    roughness_m=round(roughness, 3),
                    illumination=round(illumination, 1),
                    valid_pixel_fraction=1.0,
                    spacecraft_fit=round(craft_fit * 100, 1),
                ),
                constraints_passed=True,
                confidence="low",
                explanation=[
                    f"Deterministic global planning model for {spacecraft.name}; replace the synthetic DEM before flight decisions.",
                    f"Worst slope is {slope:.1f} deg and local roughness is {roughness:.2f} m.",
                    f"{spacecraft.name} fit is {craft_fit * 100:.0f}% for this terrain and landing footprint.",
                    f"Illumination proxy is {illumination:.0f}%.",
                ],
                landing_footprint=_synthetic_global_footprint(latitude, longitude, diameter),
                data_source="synthetic global planning model",
                resolution_m=10,
                quality_flags=["synthetic_global_model_not_scientific", "spacecraft_capability_constraints"],
                scoring_weights={"terrain_fit": 0.55, "illumination": 0.3, "spacecraft_fit": 0.15},
                processed_at=now,
            )
        )

    return _response(
        request,
        layers,
        status="completed",
        summary=AnalysisSummary(
            candidate_centres_in_region=len(latitudes) * len(longitudes),
            candidates_passing_constraints=len(candidates),
            sites_returned=len(results),
            message=None if results else "No deterministic synthetic candidate met the spacecraft and terrain limits.",
        ),
        results=results,
        now=now,
    )


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
    if dem.synthetic and request.spacecraft.name != "Unnamed spacecraft":
        return _run_synthetic_global_analysis(request, layers, now)
    region = request.region
    constraints = request.constraints
    spacecraft = request.spacecraft
    diameter = max(constraints.min_landing_diameter_m, spacecraft.landing_footprint_diameter_m)
    max_slope = min(constraints.max_slope_degrees, spacecraft.max_landing_slope_degrees)
    max_roughness = min(constraints.max_roughness, spacecraft.max_surface_roughness_m)

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
        diameter,         max_slope, max_roughness, MIN_VALID_FRACTION,
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
            max_slope, max_roughness, weights,
        )
        terrain_fit = np.clip(
            1.0
            - 0.55 * landing.worst_slope / max_slope
            - 0.45 * landing.worst_roughness / max_roughness,
            0.0,
            1.0,
        )
        propellant_fraction = spacecraft.propellant_mass_kg / (
            spacecraft.dry_mass_kg + spacecraft.payload_mass_kg + spacecraft.propellant_mass_kg
        )
        propellant_per_day = spacecraft.propellant_mass_kg / spacecraft.mission_duration_days
        duration_fit = float(np.clip(propellant_per_day / 20.0, 0.5, 1.0))
        propellant_fit = float(np.clip(propellant_fraction / 0.35, 0.0, 1.0)) * duration_fit
        spacecraft_fit = terrain_fit * (0.7 + 0.3 * propellant_fit)
        score_grid = score_grid * 0.85 + spacecraft_fit * 15.0
    else:
        spacecraft_fit = np.zeros_like(score_grid)

    chosen = select_top_sites(score_grid, candidates, layers.pixel_m, diameter, request.top_k)

    hazard_distance = None
    if hazard.any():
        hazard_distance = distance_transform_edt(~hazard) * layers.pixel_m

    response_weights = {name: round(value * 0.85, 6) for name, value in weights.items()}
    response_weights["spacecraft_fit"] = 0.15
    flags = ["roughness_window_%gm" % layers.roughness_window_m, "spacecraft_capability_constraints",
             "crater_detection_dem_morphology_only",
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
            f"Worst slope in the {diameter:g} m footprint is {slope_w:.1f} deg (limit {max_slope:g} deg).",
            f"Worst local roughness is {rough_w:.2f} m (limit {max_roughness:g} m).",
            f"{spacecraft.name} fit is {spacecraft_fit[row, col] * 100:.0f}% for this terrain and landing footprint.",
            f"Landing footprint is sized for a {spacecraft.landing_footprint_diameter_m:g} m spacecraft.",
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
                    spacecraft_fit=round(float(spacecraft_fit[row, col]) * 100, 1),
                ),
                constraints_passed=True,
                confidence=_confidence(layers, diameter, valid_fraction),
                explanation=explanation,
                landing_footprint=_footprint_geojson(layers, row, col, diameter),
                hazard_distances_m=distances,
                data_source=dem.data_source,
                resolution_m=layers.pixel_m,
                quality_flags=list(flags),
                scoring_weights=response_weights,
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
