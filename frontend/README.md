# Lunar Landing Planner: Frontend

React 19 + TypeScript + Vite single-page app for the Moon Landing Site Planner API (`Backend/`).
Enter a target point and mission constraints, run the analysis, and see ranked landing sites on a 3D globe,
in a results list, and in a plan view of the landing footprints.

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173, proxies /api to http://localhost:8000
```

Start the backend first (`python -m uvicorn app.main:app --port 8000` in `Backend/`).
The LIVE badge turns red if the API's `/api/v1/health` is unreachable.

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then production build into `dist/` |
| `npm run preview` | Serve `dist/` on :4173 (same `/api` proxy) |
| `npm run typecheck` / `lint` / `test` | TypeScript, ESLint, Vitest |

## Configuration

Copy `.env.example` to `.env` if you need to change anything.

- `VITE_API_BASE_URL` (build time). **Leave empty** to call the API on the same origin (`/api/v1/...`).
  Set an absolute URL only if the API lives on another origin; then add this site to the backend's `CORS_ORIGINS`.
- `VITE_DEV_API_TARGET`: where the dev/preview server proxies `/api`.

## Deploy

### Static host (Netlify, Vercel, S3 + CDN)

Build with `VITE_API_BASE_URL=https://api.example.com npm run build`, upload `dist/`, add an SPA fallback to
`index.html`, and set `CORS_ORIGINS=https://your-site.example` on the backend.

## How it maps to the backend

- The form sends `POST /api/v1/sites/analyze`. Latitude/longitude + radius become the backend's lat/lon bounding box
  (`src/lib/region.ts`); a window that reaches a pole spans all longitudes. The computed box is shown under the radius field.
- "Minimum flat area" (legacy) is converted to an equivalent diameter and the larger of the two is sent.
- Risk tolerance is sent to the backend and changes ranking emphasis without changing hard safety gates.
  Vehicle type and surface preference are retained as mission context until matching datasets are available.
- `synthetic_data: true` shows a "Synthetic data" chip and a warning in the site detail. Scores are rankings, not safety probabilities.
- The bundled synthetic DEM covers only ~640 m around the south pole: use a window that includes the pole
  (the defaults do) or the API returns `insufficient_data`, which the UI explains.

## Structure

```
src/
  api/          fetch client, typed schemas, endpoints
  hooks/        useAnalysis (cancelable runs), useBackendHealth
  lib/          region + mission mapping/validation (unit tested), geo math, formatting, GeoJSON export,
                moonScene (three.js engine), moonTexture (procedural surface, no image assets)
  components/
    ui/         Panel, Button, Banner, StatusBadge, ErrorBoundary
    form/       Fields (text/slider/select/checkbox), MissionForm
    viewer/     VisualizationPanel, MoonViewer
    results/    ResultsOverlay, SiteCard, SiteDetail, FootprintMap
  styles/       design tokens + global CSS
```

The globe surface is a procedural, schematic texture, not real lunar imagery. To use a real texture, replace
the `renderMoonCanvas` call in `applySurfaceTexture` (`moonScene.ts`) with a loaded image (equirectangular, longitude 0 at the centre).
