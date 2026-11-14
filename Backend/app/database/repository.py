"""SQLite persistence for analyses. Rasters never go in the database, only results."""
import json
from contextlib import closing

from app.database.db import get_connection
from app.schemas.results import AnalysisResponse

_SCHEMA = """
CREATE TABLE IF NOT EXISTS analyses (
    analysis_id   TEXT PRIMARY KEY,
    cache_key     TEXT NOT NULL,
    status        TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    request_json  TEXT NOT NULL,
    response_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analyses_cache_key ON analyses (cache_key);
"""


def init_db() -> None:
    with closing(get_connection()) as connection:
        connection.executescript(_SCHEMA)
        connection.commit()


def find_by_cache_key(cache_key: str) -> AnalysisResponse | None:
    with closing(get_connection()) as connection:
        row = connection.execute(
            "SELECT response_json FROM analyses WHERE cache_key = ? ORDER BY created_at DESC LIMIT 1",
            (cache_key,),
        ).fetchone()
    return AnalysisResponse.model_validate_json(row["response_json"]) if row else None


def get_analysis(analysis_id: str) -> AnalysisResponse | None:
    with closing(get_connection()) as connection:
        row = connection.execute(
            "SELECT response_json FROM analyses WHERE analysis_id = ?", (analysis_id,)
        ).fetchone()
    return AnalysisResponse.model_validate_json(row["response_json"]) if row else None


def save_analysis(cache_key: str, request_payload: dict, response: AnalysisResponse) -> None:
    with closing(get_connection()) as connection:
        connection.execute(
            "INSERT OR REPLACE INTO analyses "
            "(analysis_id, cache_key, status, created_at, request_json, response_json) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                response.analysis_id,
                cache_key,
                response.status,
                response.created_at.isoformat(),
                json.dumps(request_payload, sort_keys=True),
                response.model_dump_json(),
            ),
        )
        connection.commit()
