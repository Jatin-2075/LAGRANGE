export type AnalysisStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "insufficient_data"
  | "insufficient_resolution";

export type Confidence = "low" | "medium" | "high";

export interface RegionBounds {
  latitude_min: number;
  latitude_max: number;
  longitude_min: number;
  longitude_max: number;
}

export interface MissionConstraints {
  max_slope_degrees: number;
  max_roughness: number;
  min_landing_diameter_m: number;
  avoid_craters: boolean;
}

export interface MissionPreferences {
  sunlight: number;
  resource_proximity: number;
}

export interface MissionProfile {
  vehicle_type: "lander" | "crewed-lander" | "cargo-lander" | "rover-delivery";
  surface_preference: "none" | "hard" | "soft";
  risk_tolerance: "conservative" | "balanced" | "aggressive";
}

export interface SpacecraftConfig {
  name: string;
  dry_mass_kg: number;
  payload_mass_kg: number;
  propellant_mass_kg: number;
  landing_footprint_diameter_m: number;
  max_landing_slope_degrees: number;
  max_surface_roughness_m: number;
  mission_duration_days: number;
}

export interface MissionRequest {
  mission_name: string;
  region: RegionBounds;
  constraints: MissionConstraints;
  preferences: MissionPreferences;
  profile: MissionProfile;
  spacecraft: SpacecraftConfig;
  top_k: number;
}

export interface SiteMetrics {
  elevation_m: number | null;
  max_slope_degrees: number | null;
  roughness_m: number | null;
  illumination: number | null;
  resource_proximity: number | null;
  valid_pixel_fraction: number | null;
  spacecraft_fit: number | null;
}

export interface LandingFootprint {
  type: "Feature";
  properties: { diameter_m?: number } & Record<string, unknown>;
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

export interface SiteResult {
  site_id: string;
  rank: number;
  latitude: number;
  longitude: number;
  score: number;
  metrics: SiteMetrics;
  constraints_passed: boolean;
  confidence: Confidence;
  explanation: string[];
  landing_footprint: LandingFootprint | null;
  hazard_distances_m: Record<string, number>;
  data_source: string;
  resolution_m: number;
  quality_flags: string[];
  scoring_weights: Record<string, number>;
  processed_at: string;
}

export interface AnalysisSummary {
  candidate_centres_in_region: number;
  candidates_passing_constraints: number;
  sites_returned: number;
  footprint_radius_px: number | null;
  detected_depressions: number;
  message: string | null;
}

export interface AnalysisResponse {
  analysis_id: string;
  status: AnalysisStatus;
  mission_name: string;
  dataset_version: string;
  resolution_m: number;
  confidence: Confidence;
  synthetic_data: boolean;
  algorithm_version: string;
  analysis_stage: string;
  created_at: string;
  summary: AnalysisSummary;
  results: SiteResult[];
}
