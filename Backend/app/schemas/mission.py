from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RegionBounds(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude_min: float = Field(ge=-90, le=90)
    latitude_max: float = Field(ge=-90, le=90)
    longitude_min: float = Field(ge=-180, le=180)
    longitude_max: float = Field(ge=-180, le=180)

    @model_validator(mode="after")
    def validate_order(self) -> "RegionBounds":
        if self.latitude_min > self.latitude_max:
            raise ValueError("latitude_min must not exceed latitude_max")
        if self.longitude_min > self.longitude_max:
            raise ValueError("longitude_min must not exceed longitude_max")
        return self


class MissionConstraints(BaseModel):
    model_config = ConfigDict(extra="forbid")

    max_slope_degrees: float = Field(gt=0, le=90)
    max_roughness: float = Field(gt=0)
    min_landing_diameter_m: float = Field(gt=0)
    avoid_craters: bool = True


class MissionPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sunlight: float = Field(ge=0, le=1)
    resource_proximity: float = Field(ge=0, le=1)


class MissionProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vehicle_type: Literal["lander", "crewed-lander", "cargo-lander", "rover-delivery"] = "lander"
    surface_preference: Literal["none", "hard", "soft"] = "none"
    risk_tolerance: Literal["conservative", "balanced", "aggressive"] = "balanced"


class MissionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mission_name: str = Field(min_length=1, max_length=200)
    region: RegionBounds
    constraints: MissionConstraints
    preferences: MissionPreferences
    profile: MissionProfile = Field(default_factory=MissionProfile)
    top_k: int = Field(default=10, ge=1, le=100)
