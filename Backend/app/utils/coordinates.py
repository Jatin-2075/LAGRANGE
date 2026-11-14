import math


LUNAR_REFERENCE_RADIUS_M = 1_737_400.0
LATITUDE_MIN_DEG = -90.0
LATITUDE_MAX_DEG = 90.0
LONGITUDE_MIN_DEG = -180.0
LONGITUDE_MAX_DEG = 180.0


def lunar_to_threejs_unit_sphere(latitude_deg: float, longitude_deg: float) -> tuple[float, float, float]:
    """Convert planetocentric, east-positive lunar coordinates to Three.js XYZ."""
    _validate_coordinates(latitude_deg, longitude_deg)
    latitude = math.radians(latitude_deg)
    longitude = math.radians(longitude_deg)
    return (
        math.cos(latitude) * math.cos(longitude),
        math.sin(latitude),
        math.cos(latitude) * math.sin(longitude),
    )


def threejs_unit_sphere_to_lunar(
    x: float, y: float, z: float, *, tolerance: float = 1e-9
) -> tuple[float, float]:
    """Convert a Three.js unit-sphere XYZ position to lunar latitude/longitude."""
    radius = math.sqrt(x * x + y * y + z * z)
    if radius == 0:
        raise ValueError("Three.js position cannot be the zero vector")
    if abs(radius - 1.0) > tolerance:
        raise ValueError("Three.js position must be a unit-sphere coordinate")

    latitude = math.degrees(math.asin(max(-1.0, min(1.0, y / radius))))
    longitude = math.degrees(math.atan2(z, x))
    return latitude, longitude


def _validate_coordinates(latitude_deg: float, longitude_deg: float) -> None:
    if not LATITUDE_MIN_DEG <= latitude_deg <= LATITUDE_MAX_DEG:
        raise ValueError("Planetocentric latitude must be between -90 and 90 degrees")
    if not LONGITUDE_MIN_DEG <= longitude_deg <= LONGITUDE_MAX_DEG:
        raise ValueError("East-positive longitude must be between -180 and 180 degrees")


import numpy as np


def south_polar_latlon_to_xy(latitude_deg, longitude_deg, radius_m: float = LUNAR_REFERENCE_RADIUS_M):
    latitude = np.asarray(latitude_deg, dtype=np.float64)
    longitude = np.radians(np.asarray(longitude_deg, dtype=np.float64))
    rho = radius_m * np.radians(latitude + 90.0)
    return rho * np.sin(longitude), rho * np.cos(longitude)


def south_polar_xy_to_latlon(x, y, radius_m: float = LUNAR_REFERENCE_RADIUS_M):
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    rho = np.hypot(x, y)
    latitude = -90.0 + np.degrees(rho / radius_m)
    longitude = np.degrees(np.arctan2(x, y))
    return latitude, longitude
