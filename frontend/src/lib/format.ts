import type { Confidence } from "../api/types";

export function formatLatitude(value: number, digits = 1): string {
  return `${Math.abs(value).toFixed(digits)}° ${value < 0 ? "S" : "N"}`;
}

export function formatLongitude(value: number, digits = 1): string {
  return `${Math.abs(value).toFixed(digits)}° ${value < 0 ? "W" : "E"}`;
}

export function formatCoordinates(latitude: number, longitude: number, digits = 1): string {
  return `${formatLatitude(latitude, digits)} / ${formatLongitude(longitude, digits)}`;
}

export function formatNumber(value: number | null | undefined, digits = 1, unit = ""): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(digits)}${unit}`;
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

const FLAG_LABELS: Record<string, string> = {
  synthetic_dem_not_scientific: "Synthetic DEM, not scientific",
  crater_detection_dem_morphology_only: "Craters from DEM shape only",
  no_boulder_detection: "No boulder detection",
  resource_proximity_unavailable: "Resource proximity unavailable",
  illumination_dem_horizon_proxy: "Illumination is a DEM-horizon proxy",
  illumination_unavailable: "Illumination unavailable",
};

export function humanizeFlag(flag: string): string {
  const known = FLAG_LABELS[flag];
  if (known) return known;
  const window = /^roughness_window_(.+?)m$/.exec(flag);
  if (window) return `Roughness window ${window[1]} m`;
  const text = flag.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const WEIGHT_LABELS: Record<string, string> = {
  slope: "Slope",
  roughness: "Roughness",
  illumination: "Sunlight",
  resource_proximity: "Resources",
  resource: "Resources",
  sunlight: "Sunlight",
};

export function weightLabel(key: string): string {
  return WEIGHT_LABELS[key] ?? key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function humanizeKey(key: string): string {
  if (key === "nearest_detected_crater_m") return "Nearest detected crater";
  return key.replace(/_m$/, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
