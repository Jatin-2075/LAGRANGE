"""Pure numerical tests (NumPy/SciPy only)."""
import numpy as np

from app.engine.craters import detect_depressions
from app.engine.landing_zone import analyze_landing_zones, select_top_sites
from app.engine.roughness import calculate_roughness
from app.engine.scoring import compute_weights, normalize_low_is_good, score_sites
from app.engine.slope import calculate_slope
from app.engine.synthetic import build_synthetic_dem
from app.engine.terrain_layers import build_layers
from app.utils.coordinates import south_polar_latlon_to_xy, south_polar_xy_to_latlon


def _plane(angle_deg: float, size: int = 64, pixel_m: float = 10.0) -> np.ndarray:
    _, x = np.mgrid[0:size, 0:size]
    return np.tan(np.radians(angle_deg)) * x * pixel_m


def test_slope_of_a_known_plane():
    slope = calculate_slope(_plane(10.0), 10.0)
    assert np.allclose(slope, 10.0, atol=1e-6)


def test_slope_uses_true_pixel_size():
    slope = calculate_slope(_plane(10.0, pixel_m=5.0), 5.0)
    assert np.allclose(slope, 10.0, atol=1e-6)


def test_slope_keeps_nan_for_missing_data():
    dem = _plane(5.0)
    dem[30, 30] = np.nan
    slope = calculate_slope(dem, 10.0)
    assert np.isnan(slope[30, 31]) and np.isnan(slope[29, 30])
    assert np.isfinite(slope[10, 10])


def test_tilted_plane_has_zero_roughness():
    dem = _plane(15.0)
    rough = calculate_roughness(dem, np.ones_like(dem, dtype=bool), 10.0, window_m=50.0)
    assert np.nanmax(rough) < 1e-4


def test_roughness_recovers_noise_level():
    rng = np.random.default_rng(1)
    dem = _plane(3.0, size=128) + rng.normal(0, 0.5, (128, 128))
    rough = calculate_roughness(dem, np.ones(dem.shape, dtype=bool), 10.0, window_m=50.0)
    expected = 0.5 * np.sqrt((25 - 3) / 25)
    assert abs(np.nanmean(rough) - expected) < 0.03


def test_roughness_is_nan_where_data_is_missing():
    dem = _plane(2.0)
    valid = np.ones(dem.shape, dtype=bool)
    valid[20:40, 20:40] = False
    rough = calculate_roughness(dem, valid, 10.0)
    assert np.isnan(rough[30, 30])


def test_south_polar_projection_round_trip():
    lat = np.array([-89.99, -89.5, -85.0])
    lon = np.array([0.0, 35.2, -170.0])
    x, y = south_polar_latlon_to_xy(lat, lon)
    lat2, lon2 = south_polar_xy_to_latlon(x, y)
    assert np.allclose(lat, lat2, atol=1e-9) and np.allclose(lon, lon2, atol=1e-9)


def test_pole_is_the_projection_origin():
    x, y = south_polar_latlon_to_xy(-90.0, 123.0)
    assert abs(x) < 1e-9 and abs(y) < 1e-9


def test_synthetic_craters_are_detected_with_correct_scale():
    dem = build_synthetic_dem()
    found, mask = detect_depressions(dem.elevation_m, dem.valid_mask, 10.0)
    assert len(found) >= 3
    crater_centres = [(-180.0, 130.0), (170.0, -150.0), (20.0, 20.0)]
    for cx, cy in crater_centres:
        col = int(round(cx / 10.0 + 63.5))
        row = int(round(63.5 - cy / 10.0))
        assert mask[row, col], f"crater at {cx},{cy} not flagged"
    assert not mask[64 + 10, 64 - 30]


def test_landing_filter_rejects_steep_rough_hazardous_and_invalid_footprints():
    size = 60
    slope = np.full((size, size), 2.0)
    rough = np.full((size, size), 0.2)
    hazard = np.zeros((size, size), dtype=bool)
    valid = np.ones((size, size), dtype=bool)
    slope[10, 10] = 20.0
    rough[10, 40] = 5.0
    hazard[40, 10] = True
    valid[40, 40] = False

    result = analyze_landing_zones(slope, rough, hazard, valid, 10.0, 60.0, 8.0, 2.0, min_valid=0.99)
    assert result.status == "ok" and result.radius_px == 3
    mask = result.mask
    assert not mask[10, 10] and not mask[10, 40] and not mask[40, 10] and not mask[40, 40]
    assert not mask[10, 12]
    assert mask[25, 25]
    assert not mask[0, 0]


def test_coarse_resolution_is_refused_not_assumed_safe():
    flat = np.zeros((20, 20))
    result = analyze_landing_zones(
        flat, flat, flat.astype(bool), np.ones((20, 20), dtype=bool), 60.0, 100.0, 8.0, 2.0
    )
    assert result.status == "insufficient_resolution" and result.mask is None


def test_selected_sites_do_not_overlap_and_are_ranked():
    score = np.zeros((40, 40))
    score[10, 10], score[10, 12], score[30, 30] = 90.0, 95.0, 80.0
    chosen = select_top_sites(score, score > 0, 10.0, 50.0, 10)
    assert chosen == [(10, 12), (30, 30)]


def test_weights_sum_to_one_and_drop_unavailable_layers():
    w = compute_weights(0.8, 0.6, illumination_available=True, resource_available=False)
    assert abs(sum(w.values()) - 1.0) < 1e-5 and w["resource_proximity"] == 0.0
    w = compute_weights(0.0, 0.0, True, True)
    assert w["illumination"] == 0.0 and abs(w["slope"] + w["roughness"] - 1.0) < 1e-5
    conservative = compute_weights(1.0, 1.0, True, True, "conservative")
    aggressive = compute_weights(1.0, 1.0, True, True, "aggressive")
    assert conservative["slope"] > aggressive["slope"]
    assert aggressive["illumination"] > conservative["illumination"]


def test_scores_favour_gentler_terrain_and_cap_at_the_limit():
    weights = compute_weights(1.0, 0.0, True, False)
    gentle = score_sites(2.0, 0.5, 70.0, None, 8.0, 2.0, weights)
    steep = score_sites(7.0, 0.5, 70.0, None, 8.0, 2.0, weights)
    assert gentle > steep
    assert normalize_low_is_good(10.0, 8.0) == 0.0


def test_layers_on_synthetic_terrain_are_sensible():
    layers = build_layers(build_synthetic_dem())
    assert 0.0 < layers.terrain_valid.mean() < 1.0
    assert np.nanmax(layers.roughness_m) > 2.0
    assert np.nanmedian(layers.roughness_m) < 0.1
    assert layers.latitude.max() < -89.9
    assert 0.0 <= np.nanmin(layers.illumination_pct) <= np.nanmax(layers.illumination_pct) <= 100.0
