import type { MissionRequest } from "../api/types";
import { buildSearchWindow, type SearchWindow } from "./region";

export interface MissionFormState {
  targetName: string;
  latitude: string;
  longitude: string;
  searchRadiusKm: string;
  maxSlopeDeg: string;
  maxRoughnessM: string;
  minLandingDiameterM: string;
  avoidCraters: boolean;
  minFlatAreaM2: string;
  sunlight: number;
  resourceProximity: number;
  vehicleType: string;
  surfacePreference: string;
  riskTolerance: string;
  topK: string;
}

export const DEFAULT_FORM: MissionFormState = {
  targetName: "South Pole selected point",
  latitude: "-89.5",
  longitude: "0",
  searchRadiusKm: "25",
  maxSlopeDeg: "8",
  maxRoughnessM: "2",
  minLandingDiameterM: "100",
  avoidCraters: true,
  minFlatAreaM2: "",
  sunlight: 1,
  resourceProximity: 1,
  vehicleType: "lander",
  surfacePreference: "none",
  riskTolerance: "conservative",
  topK: "10",
};

export const VEHICLE_OPTIONS = [
  { value: "lander", label: "Lander" },
  { value: "crewed-lander", label: "Crewed lander" },
  { value: "cargo-lander", label: "Cargo lander" },
  { value: "rover-delivery", label: "Rover delivery" },
];

export const SURFACE_OPTIONS = [
  { value: "none", label: "No preference" },
  { value: "hard", label: "Hard, compact" },
  { value: "soft", label: "Soft regolith" },
];

export const RISK_OPTIONS = [
  { value: "conservative", label: "Conservative" },
  { value: "balanced", label: "Balanced" },
  { value: "aggressive", label: "Aggressive" },
];

export type FormErrors = Partial<Record<keyof MissionFormState, string>>;

export function parseNumber(raw: string): number {
  const trimmed = raw.trim();
  return trimmed === "" ? Number.NaN : Number(trimmed);
}

function checkRange(
  errors: FormErrors,
  key: keyof MissionFormState,
  raw: string,
  label: string,
  bounds: { min?: number; max?: number; exclusiveMin?: boolean; integer?: boolean },
) {
  const value = parseNumber(raw);
  if (!Number.isFinite(value)) {
    errors[key] = `${label} is required`;
    return;
  }
  if (bounds.integer && !Number.isInteger(value)) {
    errors[key] = `${label} must be a whole number`;
    return;
  }
  if (bounds.min !== undefined && (bounds.exclusiveMin ? value <= bounds.min : value < bounds.min)) {
    errors[key] = bounds.exclusiveMin ? `Must be greater than ${bounds.min}` : `Must be at least ${bounds.min}`;
    return;
  }
  if (bounds.max !== undefined && value > bounds.max) {
    errors[key] = `Must be at most ${bounds.max}`;
  }
}

export function validateForm(form: MissionFormState): FormErrors {
  const errors: FormErrors = {};

  const name = form.targetName.trim();
  if (!name) errors.targetName = "Name is required";
  else if (name.length > 200) errors.targetName = "Keep the name under 200 characters";

  checkRange(errors, "latitude", form.latitude, "Latitude", { min: -90, max: 90 });
  checkRange(errors, "longitude", form.longitude, "Longitude", { min: -180, max: 180 });
  checkRange(errors, "searchRadiusKm", form.searchRadiusKm, "Radius", { min: 0, exclusiveMin: true, max: 5000 });
  checkRange(errors, "maxSlopeDeg", form.maxSlopeDeg, "Max slope", { min: 0, exclusiveMin: true, max: 90 });
  checkRange(errors, "maxRoughnessM", form.maxRoughnessM, "Max roughness", { min: 0, exclusiveMin: true });
  checkRange(errors, "minLandingDiameterM", form.minLandingDiameterM, "Diameter", { min: 0, exclusiveMin: true, max: 100_000 });
  checkRange(errors, "topK", form.topK, "Results", { min: 1, max: 100, integer: true });
  if (form.minFlatAreaM2.trim() !== "") {
    checkRange(errors, "minFlatAreaM2", form.minFlatAreaM2, "Flat area", { min: 0, exclusiveMin: true });
  }

  return errors;
}

export const areaToDiameter = (areaM2: number) => 2 * Math.sqrt(areaM2 / Math.PI);

export interface BuiltMission {
  request: MissionRequest;
  window: SearchWindow;
  effectiveDiameterM: number;
}

export function buildMission(form: MissionFormState): BuiltMission {
  const latitude = parseNumber(form.latitude);
  const longitude = parseNumber(form.longitude);
  const window = buildSearchWindow(latitude, longitude, parseNumber(form.searchRadiusKm));

  let diameter = parseNumber(form.minLandingDiameterM);
  const flatArea = parseNumber(form.minFlatAreaM2);
  if (Number.isFinite(flatArea)) diameter = Math.max(diameter, areaToDiameter(flatArea));
  diameter = Math.round(diameter * 100) / 100;

  return {
    window,
    effectiveDiameterM: diameter,
    request: {
      mission_name: form.targetName.trim(),
      region: window.region,
      constraints: {
        max_slope_degrees: parseNumber(form.maxSlopeDeg),
        max_roughness: parseNumber(form.maxRoughnessM),
        min_landing_diameter_m: diameter,
        avoid_craters: form.avoidCraters,
      },
      preferences: {
        sunlight: form.sunlight,
        resource_proximity: form.resourceProximity,
      },
      profile: {
        vehicle_type: form.vehicleType as MissionRequest["profile"]["vehicle_type"],
        surface_preference: form.surfacePreference as MissionRequest["profile"]["surface_preference"],
        risk_tolerance: form.riskTolerance as MissionRequest["profile"]["risk_tolerance"],
      },
      top_k: parseNumber(form.topK),
    },
  };
}

export function parseTarget(form: Pick<MissionFormState, "latitude" | "longitude">) {
  const latitude = parseNumber(form.latitude);
  const longitude = parseNumber(form.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}
