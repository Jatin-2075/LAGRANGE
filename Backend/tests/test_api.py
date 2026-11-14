from fastapi.testclient import TestClient

from app.main import app

PAYLOAD = {
    "mission_name": "Lunar Explorer",
    "region": {"latitude_min": -90, "latitude_max": -85, "longitude_min": -180, "longitude_max": 180},
    "constraints": {"max_slope_degrees": 8, "max_roughness": 2.0, "min_landing_diameter_m": 100, "avoid_craters": True},
    "preferences": {"sunlight": 0.8, "resource_proximity": 0.6},
    "top_k": 5,
}


def test_health_and_demo_endpoints():
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        assert client.get("/api/v1/health").json() == {"status": "ok"}
        assert len(client.get("/api/locations/demo").json()["locations"]) == 3


def test_analyze_store_retrieve_and_cache():
    with TestClient(app) as client:
        first = client.post("/api/v1/sites/analyze", json=PAYLOAD)
        assert first.status_code == 200
        body = first.json()
        assert body["status"] == "completed" and body["results"]
        assert body["summary"]["cache_hit"] is False

        again = client.post("/api/v1/sites/analyze", json=PAYLOAD).json()
        assert again["analysis_id"] == body["analysis_id"] and again["summary"]["cache_hit"] is True

        analysis_id = body["analysis_id"]
        assert client.get(f"/api/v1/sites/{analysis_id}").json()["analysis_id"] == analysis_id
        results = client.get(f"/api/v1/sites/{analysis_id}/results").json()
        assert results[0]["site_id"] == "SITE-001"
        site = client.get(f"/api/v1/sites/{analysis_id}/results/SITE-001").json()
        assert site["rank"] == 1
        assert client.get(f"/api/v1/sites/{analysis_id}/results/SITE-999").status_code == 404
        assert client.get("/api/v1/sites/nope").status_code == 404


def test_validation_rejects_bad_requests():
    with TestClient(app) as client:
        bad = {**PAYLOAD, "constraints": {**PAYLOAD["constraints"], "max_slope_degrees": 120}}
        assert client.post("/api/v1/sites/analyze", json=bad).status_code == 422
        extra = {**PAYLOAD, "surprise": 1}
        assert client.post("/api/v1/sites/analyze", json=extra).status_code == 422
        bad_profile = {**PAYLOAD, "profile": {"risk_tolerance": "reckless"}}
        assert client.post("/api/v1/sites/analyze", json=bad_profile).status_code == 422


def test_terrain_point_queries_and_coverage():
    with TestClient(app) as client:
        inside = client.get("/api/v1/terrain/elevation", params={"latitude": -89.9999, "longitude": 10})
        assert inside.status_code == 200 and "elevation_m" in inside.json()
        slope = client.get("/api/v1/terrain/slope", params={"latitude": -89.9999, "longitude": 10})
        assert slope.status_code == 200 and "slope_degrees" in slope.json()
        outside = client.get("/api/v1/terrain/elevation", params={"latitude": -60, "longitude": 10})
        assert outside.status_code == 404


def test_datasets_lists_installed_and_planned():
    with TestClient(app) as client:
        body = client.get("/api/v1/datasets").json()
        assert body["installed"][0]["synthetic"] is True
        assert body["planned_not_installed"]
