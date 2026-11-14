from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.api.v1.datasets import router as datasets_router
from app.api.v1.sites import router as sites_router
from app.api.v1.terrain import router as terrain_router
from app.core.settings import CORS_ORIGINS, ENABLE_DEMO_ENDPOINT
from app.database.repository import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Moon Landing API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(CORS_ORIGINS),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
app.include_router(sites_router)
app.include_router(terrain_router)
app.include_router(datasets_router)


class LocationResult(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    score: int
    terrain: Literal["hard", "soft", "rocky"]
    risk: Literal["low", "moderate", "high"]
    flat_area_m2: int
    maximum_slope: float


class LocationResponse(BaseModel):
    locations: list[LocationResult]


DEMO_LOCATIONS = LocationResponse(
    locations=[
        LocationResult(id="alpha", name="Candidate Alpha", latitude=14.2, longitude=42.8, score=94,
                       terrain="hard", risk="low", flat_area_m2=420, maximum_slope=6.4),
        LocationResult(id="beta", name="Candidate Beta", latitude=8.7, longitude=-16.4, score=87,
                       terrain="rocky", risk="moderate", flat_area_m2=310, maximum_slope=9.8),
        LocationResult(id="gamma", name="Candidate Gamma", latitude=-31.5, longitude=5.1, score=79,
                       terrain="soft", risk="moderate", flat_area_m2=260, maximum_slope=11.2),
    ]
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/health")
def versioned_health_check() -> dict[str, str]:
    return {"status": "ok"}


if ENABLE_DEMO_ENDPOINT:

    @app.get("/api/locations/demo", response_model=LocationResponse)
    def get_demo_locations() -> LocationResponse:
        return DEMO_LOCATIONS
