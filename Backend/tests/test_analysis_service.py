import pytest

from app.engine.synthetic import build_synthetic_dem
from app.engine.terrain_layers import build_layers
from app.schemas.mission import MissionRequest
from app.services import analysis_service


@pytest.fixture(scope="module")
def layers():
    return build_layers(build_synthetic_dem())


def _request(**overrides) -> MissionRequest:
    payload = {
        "mission_name": "Test",
        "region": {"latitude_min": -90, "latitude_max": -85, "longitude_min": -180, "longitude_max": 180},
        "constraints": {"max_slope_degrees": 8, "max_roughness": 2.0, "min_landing_diameter_m": 100},
        "preferences": {"sunlight": 0.8, "resource_proximity": 0.6},
        "top_k": 5,
    }
    payload.update(overrides)
    return MissionRequest.model_validate(payload)


def test_returns_ranked_sites_that_respect_constraints(layers):
    response = analysis_service.run_analysis(_request(), layers)
    assert response.status == "completed" and response.synthetic_data
    assert 1 <= len(response.results) <= 5
    scores = [site.score for site in response.results]
    assert scores == sorted(scores, reverse=True)
    for site in response.results:
        assert site.metrics.max_slope_degrees <= 8 and site.metrics.roughness_m <= 2.0
        assert site.confidence == "low"
        assert site.landing_footprint["geometry"]["type"] == "Polygon"
        assert abs(sum(site.scoring_weights.values()) - 1.0) < 1e-4


def test_region_outside_the_dem_is_insufficient_data_not_safe(layers):
    request = _request(region={"latitude_min": -70, "latitude_max": -60, "longitude_min": 0, "longitude_max": 90})
    response = analysis_service.run_analysis(request, layers)
    assert response.status == "insufficient_data" and response.results == []


def test_too_coarse_for_the_footprint_is_flagged(layers):
    request = _request(constraints={"max_slope_degrees": 8, "max_roughness": 2.0, "min_landing_diameter_m": 15})
    assert analysis_service.run_analysis(request, layers).status == "insufficient_resolution"


def test_impossible_constraints_return_no_sites(layers):
    request = _request(constraints={"max_slope_degrees": 0.5, "max_roughness": 2.0, "min_landing_diameter_m": 100})
    response = analysis_service.run_analysis(request, layers)
    assert response.status == "completed" and response.results == []
    assert response.summary.message


def test_spacecraft_capabilities_change_the_landing_solution(layers):
    baseline = analysis_service.run_analysis(_request(), layers)
    constrained = analysis_service.run_analysis(
        _request(
            spacecraft={
                "name": "Heavy cargo lander",
                "dry_mass_kg": 2000,
                "payload_mass_kg": 1000,
                "propellant_mass_kg": 900,
                "landing_footprint_diameter_m": 120,
                "max_landing_slope_degrees": 4,
                "max_surface_roughness_m": 0.8,
                "mission_duration_days": 180,
            }
        ),
        layers,
    )
    assert constrained.summary.footprint_radius_px != baseline.summary.footprint_radius_px
    assert constrained.results[0].metrics.spacecraft_fit is not None
    assert "Heavy cargo lander" in constrained.results[0].explanation[2]
