import sqlite3
from pathlib import Path

from app.core.settings import DATABASE_URL


def _sqlite_path(database_url: str) -> str:
    prefix = "sqlite:///"
    if not database_url.startswith(prefix):
        raise ValueError("Only sqlite DATABASE_URL values are currently supported")

    database_path = database_url.removeprefix(prefix)
    if database_path == ":memory:":
        return database_path

    path = Path(database_path)
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[2] / path
    path.parent.mkdir(parents=True, exist_ok=True)
    return str(path)


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(_sqlite_path(DATABASE_URL))
    connection.row_factory = sqlite3.Row
    return connection