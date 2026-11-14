# Moon Landing Site Planner

## Overview

Moon Landing Site Planner is an interactive application for exploring potential
lunar landing locations. The user defines mission requirements, the backend
evaluates candidate sites, and the frontend displays the returned locations as
ranked cards and markers on an interactive 3D Moon.

The current backend returns demo data. The application is structured so that
the demo endpoint can later be replaced with real terrain, surface, hazard,
and mission-analysis services.

## End-to-End Workflow

```text
User requirements
        ↓
Landing planner form
        ↓
Frontend API request
        ↓
FastAPI backend
        ↓
Candidate locations
        ↓
Latitude/longitude → 3D Moon coordinates
        ↓
Ranked location cards + Moon markers
        ↓
User selects a candidate
        ↓
Moon camera focuses on the selected location
```

## 1. User Defines Mission Requirements

The user enters requirements in the **Site Requirements** panel:

1. **Area of interest** — location selected on the Moon map.
2. **Search radius** — 1 km, 5 km, 10 km, or custom.
3. **Vehicle type** — rover, lander, shuttle, or another vehicle.
4. **Minimum flat area** — required landing area in square metres.
5. **Maximum slope** — maximum acceptable terrain inclination.
6. **Surface preference** — hard, soft, rocky, or no preference.
7. **Risk tolerance** — conservative, moderate, or flexible.

The form keeps its values in component state. Submitting the form does not
reload the page.

## 2. Frontend Sends the Request

The form calls `handleCriteriaSubmit` in the dashboard. The dashboard:

- Sets the loading state.
- Clears the previous error.
- Sends the selected criteria to the API helper.
- Waits for the backend response.
- Replaces the current location results with the response.
- Displays an error if the request fails.

The request helper is located in
[`frontend/src/config/api.ts`](./frontend/src/config/api.ts).

The API base URL is configurable:

```text
VITE_API_URL=http://localhost:8000
```

If `VITE_API_URL` is not provided, the frontend uses
`http://localhost:8000`.

The current request is sent to:

```text
GET /api/locations/demo
```

The criteria are sent as URL query parameters. The demo endpoint currently
returns the same sample locations regardless of the criteria, but the request
shape is ready for real filtering logic.

## 3. Backend Receives the Request

The FastAPI application is defined in
[`Backend/app/main.py`](./Backend/app/main.py).

Available endpoints:

```text
GET /health
GET /api/locations/demo
```

### Health endpoint

`/health` verifies that the backend is running:

```json
{
  "status": "ok"
}
```

### Demo location endpoint

`/api/locations/demo` returns a typed response:

```json
{
  "locations": [
    {
      "id": "alpha",
      "name": "Candidate Alpha",
      "latitude": 14.2,
      "longitude": 42.8,
      "score": 94,
      "terrain": "hard",
      "risk": "low",
      "flat_area_m2": 420,
      "maximum_slope": 6.4
    }
  ]
}
```

The backend enables CORS for the local Vite development servers:

- `http://localhost:5173`
- `http://127.0.0.1:5173`

## 4. Frontend Validates the Response Shape

The frontend response types are defined in
[`frontend/src/config/type.ts`](./frontend/src/config/type.ts).

The important types are:

- `LandingSiteCriteria` — form input values.
- `BackendLocation` — one returned candidate.
- `LocationResponse` — the API response containing candidate locations.
- `TerrainType` — hard, soft, or rocky.
- `RiskLevel` — low, moderate, or high.

The API helper checks the HTTP response status. Non-success responses become
visible request errors instead of being silently treated as empty results.

## 5. Backend Coordinates Become 3D Moon Positions

The backend returns geographic coordinates:

- Latitude ranges from -90° to 90°.
- Longitude ranges from -180° to 180°.

The dashboard converts them to a unit-sphere position:

```text
x = cos(latitude) × cos(longitude)
y = sin(latitude)
z = cos(latitude) × sin(longitude)
```

The resulting `[x, y, z]` position is passed to the Moon renderer as a
`MoonMarker`.

This keeps the backend independent from Three.js. The backend only needs to
return geographic coordinates; the frontend handles visualization coordinates.

## 6. Results Appear as a Stack on the Moon

After a successful request:

- The result count changes from `WAITING` to the number of returned locations.
- Each returned location becomes a ranked card.
- Cards show the candidate name, coordinates, terrain, risk, and score.
- Each location becomes a glowing marker on the Moon.
- The previous result set is replaced by the newest response.

The result cards are positioned inside the left side of the Moon viewer. This
keeps the right side dedicated to mission requirements.

## 7. Marker Visibility and Depth

Markers are positioned slightly above the Moon surface so they do not
disappear inside the GLB model.

The renderer checks whether each marker faces the camera:

- Front-facing locations are visible.
- Locations on the far side are hidden.
- Rotating the Moon reveals markers again when their surface faces the user.

This prevents the map from showing a location through the Moon.

## 8. Selecting a Location

Each result card is clickable.

When the user selects a card:

1. The card receives the selected visual state.
2. Its marker becomes the focused marker.
3. The camera smoothly moves toward that marker.
4. The focus animation stops after reaching the target.
5. Orbit controls are released so the user can rotate, pan, or zoom manually.

The focus animation is intentionally slow so the user can follow the selected
location without losing control of the viewer.

## 9. Interactive Layout

The dashboard is designed like a VS Code workspace:

- The Moon viewer occupies the main workspace.
- Site Requirements occupies the right side.
- The vertical divider can be dragged to resize both columns.
- The planner can be collapsed and expanded.
- The location result stack lives inside the Moon viewer.

On smaller screens, the layout falls back to a vertical arrangement and hides
the desktop resize divider.

## 10. Database Configuration

Database configuration is separated from database access:

- [`Backend/app/core/settings.py`](./Backend/app/core/settings.py) loads
  `DATABASE_URL` from the process environment or `Backend/app/.env`.
- [`Backend/app/database/db.py`](./Backend/app/database/db.py) imports the
  setting and exposes a SQLite connection helper.

Example environment file:

```env
DATABASE_URL=sqlite:///./earthpulse.db
```

The current demo endpoint does not read from the database yet. Future location
analysis services can use the database helper for persisted mission requests,
terrain data, candidate sites, and analysis results.

## 11. Planned Real Analysis Workflow

The demo response can later be replaced with this processing pipeline:

### 11.1 Input validation

- Validate coordinate ranges.
- Validate positive area and radius values.
- Validate slope limits.
- Validate supported vehicle and surface values.
- Apply safe defaults where optional requirements are omitted.

### 11.2 Data collection

Collect datasets covering the selected area:

- Digital Elevation Models.
- Lunar imagery and surface classifications.
- Rock, crater, and obstacle data.
- Illumination and communication constraints.
- Historical deformation or stability observations where available.

### 11.3 Terrain analysis

For each search cell:

- Calculate elevation.
- Calculate slope and roughness.
- Detect continuous flat areas.
- Identify obstacles and exclusion zones.
- Estimate data quality and coverage.

### 11.4 Constraint filtering

Reject candidates that fail mandatory requirements:

- Outside the search radius.
- Smaller than the required flat area.
- Steeper than the maximum slope.
- Incompatible with the selected vehicle.
- In a known hazard or insufficient-data area.

### 11.5 Suitability scoring

Score remaining candidates using weighted factors:

- Slope suitability.
- Flat landing area.
- Surface compatibility.
- Hazard distance.
- Illumination and communication conditions.
- Data confidence.
- Mission risk tolerance.

### 11.6 Ranking and explanation

Return the highest-scoring candidates with:

- Candidate coordinates.
- Overall score.
- Terrain summary.
- Risk level.
- Constraint results.
- Explanation of why the candidate was recommended.

## 12. Running Locally

### Start the backend

From the `Backend` directory:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Verify it:

```text
http://localhost:8000/health
http://localhost:8000/api/locations/demo
```

### Start the frontend

From the `frontend` directory:

```powershell
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

### Production validation

```powershell
npm run build
npm run lint
```

## Complete Workflow Summary

```text
Enter mission requirements
  → Submit planner form
  → GET /api/locations/demo
  → Receive typed location response
  → Convert latitude/longitude to Moon coordinates
  → Render ranked cards and depth-aware 3D markers
  → Select a card
  → Focus the Moon camera
  → Continue rotating, panning, and zooming manually
```

> **Important:** The current recommendations are demo data only. They are not
> safe landing guidance. Real mission decisions require validated terrain,
> obstacle, illumination, communication, and spacecraft-specific analysis.
