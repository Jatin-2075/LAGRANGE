import { ApiError } from "../../api/client";
import type { AnalysisResponse } from "../../api/types";
import { downloadJson, toGeoJson } from "../../lib/export";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { SiteCard } from "./SiteCard";
import "./ResultsOverlay.css";

interface ResultsOverlayProps {
  analysis: AnalysisResponse | null;
  loading: boolean;
  error: Error | null;
  selectedSiteId: string | null;
  onSelectSite: (siteId: string) => void;
}

const STATUS_TITLES: Record<string, string> = {
  insufficient_data: "No terrain data for this area",
  insufficient_resolution: "Terrain too coarse for this footprint",
  failed: "Analysis failed",
};

export function ResultsOverlay({ analysis, loading, error, selectedSiteId, onSelectSite }: ResultsOverlayProps) {
  const sites = analysis?.results ?? [];

  return (
    <aside className="results" aria-label="Recommended landing sites" aria-busy={loading}>
      <div className="results__head">
        <div>
          <p className="eyebrow">Backend output</p>
          <h3 className="results__title">Recommended locations</h3>
        </div>
        {analysis ? (
          <span className="results__count">{sites.length} found</span>
        ) : null}
      </div>

      <div className={`results__body${loading ? " results__body--loading" : ""}`}>
        {error ? (
          <Banner tone="error" compact title={error.message}>
            {error instanceof ApiError && error.details.length > 0 ? (
              <ul>
                {error.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </Banner>
        ) : null}

        {!analysis && !error ? (
          <p className="results__empty">
            {loading ? "Analysing terrain…" : "Set your mission parameters and choose Find landing sites. Ranked candidates will appear here and on the globe."}
          </p>
        ) : null}

        {analysis && analysis.status !== "completed" ? (
          <Banner tone="warn" compact title={STATUS_TITLES[analysis.status] ?? "Analysis did not complete"}>
            {analysis.summary.message}
          </Banner>
        ) : null}

        {analysis && analysis.status === "completed" && sites.length === 0 ? (
          <Banner tone="warn" compact title="No site passed every constraint">
            {analysis.summary.message ?? "Relax slope, roughness or landing diameter and try again."}
          </Banner>
        ) : null}

        {sites.length > 0 ? (
          <ul className="results__list">
            {sites.map((site) => (
              <li key={site.site_id}>
                <SiteCard site={site} selected={site.site_id === selectedSiteId} onSelect={onSelectSite} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {analysis && sites.length > 0 ? (
        <div className="results__foot">
          <p className="results__meta">
            {analysis.summary.candidates_passing_constraints.toLocaleString()} of{" "}
            {analysis.summary.candidate_centres_in_region.toLocaleString()} candidate cells passed
            {analysis.summary.cache_hit ? " · cached" : ""}
          </p>
          <Button
            variant="ghost"
            onClick={() => downloadJson(`${analysis.analysis_id}.geojson`, toGeoJson(analysis))}
          >
            Export GeoJSON
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
