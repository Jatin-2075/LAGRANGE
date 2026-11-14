import type { AnalysisResponse } from "../api/types";

export function toGeoJson(analysis: AnalysisResponse) {
  return {
    type: "FeatureCollection" as const,
    properties: {
      analysis_id: analysis.analysis_id,
      mission_name: analysis.mission_name,
      dataset_version: analysis.dataset_version,
      synthetic_data: analysis.synthetic_data,
      created_at: analysis.created_at,
    },
    features: analysis.results.map((site) => ({
      type: "Feature" as const,
      geometry: site.landing_footprint?.geometry ?? {
        type: "Point" as const,
        coordinates: [site.longitude, site.latitude],
      },
      properties: {
        site_id: site.site_id,
        rank: site.rank,
        score: site.score,
        latitude: site.latitude,
        longitude: site.longitude,
        confidence: site.confidence,
        ...site.metrics,
      },
    })),
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
