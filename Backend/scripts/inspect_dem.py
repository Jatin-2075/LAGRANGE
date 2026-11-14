"""Print metadata for the configured DEM (or a path passed as the first argument)."""
import json
import sys

from app.core import settings
from app.utils.raster_utils import inspect_raster


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else str(settings.DEM_PATH)
    print(json.dumps(inspect_raster(path), indent=2, default=str))


if __name__ == "__main__":
    main()
