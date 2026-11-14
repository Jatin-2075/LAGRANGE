"""Point the app at throwaway storage before anything imports it."""
import os
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp(prefix="moon_planner_tests_"))
os.environ["DATABASE_URL"] = "sqlite:///" + str(_tmp / "test.db")
os.environ["DEM_PATH"] = str(_tmp / "synthetic.tif")
