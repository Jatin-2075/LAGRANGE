import type { RegionBounds } from "../api/types";
import { KM_PER_DEGREE, clamp } from "./geo";

export interface SearchWindow {
  region: RegionBounds;
  coversPole: boolean;
}

const round = (value: number) => Math.round(value * 1e4) / 1e4;

export function buildSearchWindow(latitude: number, longitude: number, radiusKm: number): SearchWindow {
  const dLat = radiusKm / KM_PER_DEGREE;
  const latitudeMin = Math.max(-90, latitude - dLat);
  const latitudeMax = Math.min(90, latitude + dLat);
  const coversPole = latitudeMin <= -90 || latitudeMax >= 90;

  let longitudeMin = -180;
  let longitudeMax = 180;
  if (!coversPole) {
    const widestLatitude = Math.max(Math.abs(latitudeMin), Math.abs(latitudeMax));
    const dLon = dLat / Math.cos((widestLatitude * Math.PI) / 180);
    if (dLon < 180) {
      longitudeMin = clamp(longitude - dLon, -180, 180);
      longitudeMax = clamp(longitude + dLon, -180, 180);
    }
  }

  return {
    coversPole,
    region: {
      latitude_min: round(latitudeMin),
      latitude_max: round(latitudeMax),
      longitude_min: round(longitudeMin),
      longitude_max: round(longitudeMax),
    },
  };
}
