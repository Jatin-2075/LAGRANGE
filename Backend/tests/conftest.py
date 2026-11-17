import os
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp(prefix="moon_planner_tests_"))
os.environ["DEM_PATH"] = str(_tmp / "synthetic.tif")
