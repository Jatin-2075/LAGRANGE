from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.datasets import router as datasets_router
from app.api.v1.sites import router as sites_router
from app.api.v1.terrain import router as terrain_router
from app.core.settings import CORS_ORIGINS
app = FastAPI(title="Moon Landing API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(CORS_ORIGINS),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
app.include_router(sites_router)
app.include_router(terrain_router)
app.include_router(datasets_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/health")
def versioned_health_check() -> dict[str, str]:
    return {"status": "ok"}
