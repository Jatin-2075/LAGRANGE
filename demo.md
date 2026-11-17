# LAGRANGE Demo Scenarios

Use these five mission payloads to test the planner with different regions,
terrain limits, spacecraft configurations, and scoring preferences.

Start the backend:

```powershell
cd Backend
python -m uvicorn app.main:app --reload --port 8000
```

Start the frontend in another terminal:

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173`, enter the corresponding values in the mission
form, and select **Find landing sites**.

You can also send the payloads directly to:

```text
POST http://localhost:8000/api/v1/sites/analyze
```

## 1. South Pole baseline

Expected behavior: many passing candidates with balanced scores.

```json
{
  "mission_name": "South Pole baseline",
  "region": {
    "latitude_min": -90,
    "latitude_max": -80,
    "longitude_min": -180,
    "longitude_max": 180
  },
  "constraints": {
    "max_slope_degrees": 8,
    "max_roughness": 2,
    "min_landing_diameter_m": 100,
    "avoid_craters": true
  },
  "preferences": {
    "sunlight": 0.8,
    "resource_proximity": 0.5
  },
  "profile": {
    "vehicle_type": "lander",
    "surface_preference": "none",
    "risk_tolerance": "balanced"
  },
  "spacecraft": {
    "name": "Lunar Surveyor",
    "dry_mass_kg": 1200,
    "payload_mass_kg": 250,
    "propellant_mass_kg": 800,
    "landing_footprint_diameter_m": 80,
    "max_landing_slope_degrees": 8,
    "max_surface_roughness_m": 2,
    "mission_duration_days": 30
  },
  "top_k": 3
}
```

## 2. Strict terrain limits

Expected behavior: very few candidates pass because the terrain limits are
strict.

Use the same spacecraft and preferences as scenario 1, but change the mission
name, region, and constraints:

```json
{
  "mission_name": "Strict terrain limits",
  "region": {
    "latitude_min": -90,
    "latitude_max": -80,
    "longitude_min": -180,
    "longitude_max": 180
  },
  "constraints": {
    "max_slope_degrees": 3,
    "max_roughness": 0.35,
    "min_landing_diameter_m": 80,
    "avoid_craters": true
  },
  "preferences": {
    "sunlight": 0.8,
    "resource_proximity": 0.5
  },
  "profile": {
    "vehicle_type": "lander",
    "surface_preference": "none",
    "risk_tolerance": "balanced"
  },
  "spacecraft": {
    "name": "Lunar Surveyor",
    "dry_mass_kg": 1200,
    "payload_mass_kg": 250,
    "propellant_mass_kg": 800,
    "landing_footprint_diameter_m": 80,
    "max_landing_slope_degrees": 8,
    "max_surface_roughness_m": 2,
    "mission_duration_days": 30
  },
  "top_k": 3
}
```

## 3. Equatorial search

Expected behavior: a different region and different top-ranked coordinates.

```json
{
  "mission_name": "Equatorial search",
  "region": {
    "latitude_min": -10,
    "latitude_max": 10,
    "longitude_min": -60,
    "longitude_max": 60
  },
  "constraints": {
    "max_slope_degrees": 8,
    "max_roughness": 2,
    "min_landing_diameter_m": 100,
    "avoid_craters": true
  },
  "preferences": {
    "sunlight": 0.8,
    "resource_proximity": 0.5
  },
  "profile": {
    "vehicle_type": "lander",
    "surface_preference": "none",
    "risk_tolerance": "balanced"
  },
  "spacecraft": {
    "name": "Lunar Surveyor",
    "dry_mass_kg": 1200,
    "payload_mass_kg": 250,
    "propellant_mass_kg": 800,
    "landing_footprint_diameter_m": 80,
    "max_landing_slope_degrees": 8,
    "max_surface_roughness_m": 2,
    "mission_duration_days": 30
  },
  "top_k": 3
}
```

## 4. Sunlight-priority mission

Expected behavior: ranking favors high illumination and uses a cargo lander
profile.

```json
{
  "mission_name": "Sunlight-priority mission",
  "region": {
    "latitude_min": -75,
    "latitude_max": -55,
    "longitude_min": -120,
    "longitude_max": 120
  },
  "constraints": {
    "max_slope_degrees": 10,
    "max_roughness": 3,
    "min_landing_diameter_m": 60,
    "avoid_craters": false
  },
  "preferences": {
    "sunlight": 1,
    "resource_proximity": 0
  },
  "profile": {
    "vehicle_type": "cargo-lander",
    "surface_preference": "hard",
    "risk_tolerance": "aggressive"
  },
  "spacecraft": {
    "name": "Lunar Surveyor",
    "dry_mass_kg": 1200,
    "payload_mass_kg": 250,
    "propellant_mass_kg": 800,
    "landing_footprint_diameter_m": 80,
    "max_landing_slope_degrees": 8,
    "max_surface_roughness_m": 2,
    "mission_duration_days": 30
  },
  "top_k": 3
}
```

## 5. Large conservative lander

Expected behavior: a larger footprint and stricter spacecraft limits reduce
the candidate set and change the ranking.

```json
{
  "mission_name": "Large conservative lander",
  "region": {
    "latitude_min": -90,
    "latitude_max": -70,
    "longitude_min": 0,
    "longitude_max": 90
  },
  "constraints": {
    "max_slope_degrees": 5,
    "max_roughness": 1,
    "min_landing_diameter_m": 180,
    "avoid_craters": true
  },
  "preferences": {
    "sunlight": 0.8,
    "resource_proximity": 0.5
  },
  "profile": {
    "vehicle_type": "crewed-lander",
    "surface_preference": "hard",
    "risk_tolerance": "conservative"
  },
  "spacecraft": {
    "name": "Heavy Polar Lander",
    "dry_mass_kg": 5000,
    "payload_mass_kg": 1200,
    "propellant_mass_kg": 900,
    "landing_footprint_diameter_m": 180,
    "max_landing_slope_degrees": 5,
    "max_surface_roughness_m": 1,
    "mission_duration_days": 14
  },
  "top_k": 3
}
```

All results currently use the synthetic development terrain. Scores are
rankings for demonstration and are not real lunar safety probabilities.
