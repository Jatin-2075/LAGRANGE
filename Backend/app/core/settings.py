import os
from pathlib import Path


APP_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = APP_DIR.parent
ENV_FILE = APP_DIR / ".env"


def _load_env_file() -> None:
    if not ENV_FILE.exists():
        return

    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        entry = line.strip()
        if not entry or entry.startswith("#") or "=" not in entry:
            continue

        key, value = entry.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


_load_env_file()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./earthpulse.db")


def _read_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
)
CORS_ORIGINS = tuple(
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", ",".join(DEFAULT_CORS_ORIGINS)).split(",")
    if origin.strip()
)
DEM_PATH = Path(
    os.getenv(
        "DEM_PATH",
        str(BACKEND_DIR / "data" / "raw" / "synthetic_south_pole.tif"),
    )
)
DATASET_VERSION = os.getenv("DATASET_VERSION", "")
DATA_SOURCE = os.getenv("DATA_SOURCE", "")

ROUGHNESS_WINDOW_M = float(os.getenv("ROUGHNESS_WINDOW_M", "50"))
HAZARD_BUFFER_M = float(os.getenv("HAZARD_BUFFER_M", "10"))
CRATER_MIN_DEPTH_M = float(os.getenv("CRATER_MIN_DEPTH_M", "2"))
CRATER_MIN_DIAMETER_M = float(os.getenv("CRATER_MIN_DIAMETER_M", "20"))
SUN_ELEVATION_DEG = float(os.getenv("SUN_ELEVATION_DEG", "1.5"))
ILLUMINATION_MAX_PIXELS = int(os.getenv("ILLUMINATION_MAX_PIXELS", "4000000"))
