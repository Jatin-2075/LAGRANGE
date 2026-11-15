from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


AnalysisStatus = Literal[
    "idle",
    "running",
    "completed",
    "failed",
    "insufficient_data",
    "insufficient_resolution",
]
Confidence = Literal["low", "medium", "high"]


class SiteMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    elevation_m: float | None = None
    max_slope_degrees: float | None = None
    roughness_m: float | None = None
    illumination: float | None = None
    resource_proximity: float | None = None
    valid_pixel_fraction: float | None = None
    spacecraft_fit: float | None = None


class SiteResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    site_id: str
    rank: int
    latitude: float
    longitude: float
    score: float
    metrics: SiteMetrics
    constraints_passed: bool
    confidence: Confidence
    explanation: list[str]
    landing_footprint: dict[str, Any] | None = None
    hazard_distances_m: dict[str, float] = Field(default_factory=dict)
    data_source: str
    resolution_m: float
    quality_flags: list[str]
    scoring_weights: dict[str, float]
    processed_at: datetime


class AnalysisSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidate_centres_in_region: int
    candidates_passing_constraints: int
    sites_returned: int
    footprint_radius_px: int | None = None
    detected_depressions: int = 0
    message: str | None = None


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    analysis_id: str
    status: AnalysisStatus
    mission_name: str
    dataset_version: str
    resolution_m: float
    confidence: Confidence
    synthetic_data: bool
    algorithm_version: str
    analysis_stage: str
    created_at: datetime
    summary: AnalysisSummary
    results: list[SiteResult]
