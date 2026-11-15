# Moon Landing Site Planner: Backend

FastAPI backend that takes mission requirements and ranks landing sites from a lunar elevation raster.

Pipeline: DEM -> slope -> roughness -> crater hazards -> circular landing footprints (hard constraints)
-> weighted score -> top-k sites with evidence.

> **Read this first.** The bundled terrain is a **synthetic** 1.28 km South Pole fixture. Results prove
> the pipeline works; they are not lunar landing guidance. Every response says `synthetic_data: true`
> and confidence is forced to `low` for it.

## Install and run

Python 3.11+ (tested on 3.12).

```powershell
cd Backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for the interactive API. Run the tests with `python -m pytest`.

If `pip install rasterio` fails on Windows, upgrade pip first (`python -m pip install -U pip`); wheels exist for current Python versions.

## Try it

```powershell
curl -X POST http://localhost:8000/api/v1/sites/analyze -H "Content-Type: application/json" -d '{
  "mission_name": "Lunar Explorer",
  "region": {"latitude_min": -90, "latitude_max": -85, "longitude_min": -180, "longitude_max": 180},
  "constraints": {"max_slope_degrees": 8, "max_roughness": 2.0, "min_landing_diameter_m": 100, "avoid_craters": true},
  "preferences": {"sunlight": 0.8, "resource_proximity": 0.6},
  "profile": {"vehicle_type": "lander", "surface_preference": "none", "risk_tolerance": "conservative"},
  "top_k": 5
}'
```

The synthetic DEM covers only about 640 m around the pole, so use a region that includes the pole
(longitude -180..180). A region with no overlap returns `status: "insufficient_data"`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/sites/analyze` | Run an analysis and return ranked sites |
| GET | `/api/v1/terrain/elevation?latitude=&longitude=` | Elevation at a point |
| GET | `/api/v1/terrain/slope?latitude=&longitude=` | Slope, roughness, hazard flag at a point |
| GET | `/api/v1/datasets` | Installed and planned datasets |
| GET | `/health`, `/api/v1/health` | Liveness |

Each site returns coordinates, score, metrics, confidence, plain-language explanation, a GeoJSON landing
footprint, hazard distance, data source and resolution, quality flags and the scoring weights used.

## How the analysis works

1. **Validate** the request (Pydantic). Constraints are pass/fail; preferences and risk tolerance only change the score.
2. **Slope** from `np.gradient` with the true pixel size. **Roughness** is the RMS residual after removing a
   least-squares plane in a sliding window (default 50 m), so a smooth tilted surface is not rough.
3. **Craters** are roughly circular depressions found by morphological closing on the detrended DEM, plus a
   safety buffer (default 10 m). DEM-only: no imagery, no boulders.
4. **Landing footprints**: for every cell the whole disk of the requested diameter must have >= 95% valid data,
   worst slope and roughness within limits, and no hazard. Footprints over the raster edge fail. If the DEM is
   too coarse to resolve the footprint (< 2 px radius) the status is `insufficient_resolution`.
5. **Score** (0-100) = weighted slope, roughness and illumination terms, each normalised to 0-1. Risk tolerance
   sets the terrain-vs-soft-preference split: conservative (0.45 / 0.35 / 0.20), balanced (0.35 / 0.25 / 0.40),
   or aggressive (0.25 / 0.15 / 0.60). The soft share is split by `sunlight` / `resource_proximity`.
   Unavailable layers are dropped and the weights renormalised, never scored as zero or as good.
   Weights are illustrative, not validated.
6. **Rank** with greedy non-maximum suppression so returned footprints never overlap.
7. **Return the analysis** directly to the client. Results are not persisted between requests.

A score of 94 is not a 94% chance of landing safely.

## Known limits (deliberate, flagged in responses)

- **Illumination** is a DEM-horizon proxy (low sun, 24 azimuths), not LROC illumination data; rays leaving the DEM are treated as open sky.
- **Resource proximity** has no dataset yet, so it is excluded from scoring (`resource_proximity_unavailable`).
- Craters come from DEM morphology only. No boulder detection.
- The working CRS must be a north-up, square-pixel, **south-polar azimuthal equidistant** raster in metres (`+proj=aeqd +lat_0=-90 +R=1737400`). Latitude is planetocentric, longitude is east-positive in [-180, 180].
- Synchronous only. Large analyses will need background jobs (Celery/RQ + Redis) and PostGIS later.

## Using a real DEM

1. Preprocess a polar LOLA (or merged) DEM to the projection above, with true metric pixel size, NoData set.
2. Set in `app/.env` (or the environment):

```env
DEM_PATH=C:/data/lola_south_pole_20m.tif
DATASET_VERSION=lola-gdr-south-pole-v1
DATA_SOURCE=LOLA GDR south polar, resampled to 20 m
```

3. Inspect it: `python -m scripts.inspect_dem`
4. Export the Phase 1-3 maps for QGIS: `python -m scripts.export_layers --diameter 100`

Mind the resolution: a 60 m DEM cannot validate a 100 m pad (about 1.7 px across) and cannot see boulders.
Rasters above ~4 million pixels skip the illumination proxy (`ILLUMINATION_MAX_PIXELS`).

## Configuration (env or `app/.env`)

`CORS_ORIGINS`, `DEM_PATH`, `DATASET_VERSION`, `DATA_SOURCE`,
`ROUGHNESS_WINDOW_M` (50), `HAZARD_BUFFER_M` (10), `CRATER_MIN_DEPTH_M` (2), `CRATER_MIN_DIAMETER_M` (20),
`SUN_ELEVATION_DEG` (1.5), `ILLUMINATION_MAX_PIXELS` (4000000).

## Layout

```
app/
  main.py              FastAPI app, CORS, routers
  api/v1/              sites.py  terrain.py  datasets.py
  schemas/             mission.py  results.py
  services/            analysis_service.py  terrain_service.py
  engine/              slope  roughness  craters  illumination  landing_zone  scoring  terrain_layers
                       dem_loader (rasterio)  dem_types  synthetic
  utils/               coordinates.py  raster_utils.py
scripts/               generate_synthetic_dem  inspect_dem  export_layers
tests/                 engine, service and API tests
data/                  raw/ (synthetic DEM)  processed/  metadata/
```
