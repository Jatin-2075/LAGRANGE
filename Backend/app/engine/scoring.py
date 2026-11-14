import numpy as np

RISK_WEIGHTS = {
    "conservative": (0.45, 0.35, 0.20),
    "balanced": (0.35, 0.25, 0.40),
    "aggressive": (0.25, 0.15, 0.60),
}


def normalize_low_is_good(value, limit: float):
    return np.clip(1.0 - np.asarray(value, dtype=np.float64) / limit, 0.0, 1.0)


def compute_weights(
    sunlight_preference: float,
    resource_preference: float,
    illumination_available: bool,
    resource_available: bool,
    risk_tolerance: str = "balanced",
) -> dict[str, float]:
    """Weights that sum to 1. Unavailable layers are dropped, never scored as zero or as good."""
    try:
        slope_base, roughness_base, soft_total = RISK_WEIGHTS[risk_tolerance]
    except KeyError as error:
        raise ValueError(f"Unknown risk tolerance: {risk_tolerance}") from error
    soft_sum = sunlight_preference + resource_preference
    weights = {
        "slope": slope_base,
        "roughness": roughness_base,
        "illumination": soft_total * sunlight_preference / soft_sum if soft_sum > 0 else 0.0,
        "resource_proximity": soft_total * resource_preference / soft_sum if soft_sum > 0 else 0.0,
    }
    if not illumination_available:
        weights["illumination"] = 0.0
    if not resource_available:
        weights["resource_proximity"] = 0.0
    total = sum(weights.values())
    return {name: round(value / total, 6) for name, value in weights.items()}


def score_sites(
    worst_slope,
    worst_roughness,
    illumination_pct,
    resource_proximity,
    max_slope: float,
    max_roughness: float,
    weights: dict[str, float],
):
    """Vectorised 0-100 suitability score. Only call it on cells that passed the hard constraints."""
    score = weights["slope"] * normalize_low_is_good(worst_slope, max_slope)
    score = score + weights["roughness"] * normalize_low_is_good(worst_roughness, max_roughness)
    if weights["illumination"] > 0 and illumination_pct is not None:
        score = score + weights["illumination"] * np.clip(np.asarray(illumination_pct) / 100.0, 0.0, 1.0)
    if weights["resource_proximity"] > 0 and resource_proximity is not None:
        score = score + weights["resource_proximity"] * np.clip(resource_proximity, 0.0, 1.0)
    return 100.0 * score
