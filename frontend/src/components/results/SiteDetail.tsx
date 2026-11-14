import { useState } from "react";
import type { SiteResult } from "../../api/types";
import {
  CONFIDENCE_LABEL,
  formatCoordinates,
  formatNumber,
  humanizeFlag,
  humanizeKey,
  weightLabel,
} from "../../lib/format";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { FootprintMap } from "./FootprintMap";
import "./SiteDetail.css";

interface SiteDetailProps {
  site: SiteResult;
  allSites: SiteResult[];
  syntheticData: boolean;
  onSelectSite: (siteId: string) => void;
  onClose: () => void;
}

export function SiteDetail({ site, allSites, syntheticData, onSelectSite, onClose }: SiteDetailProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const { metrics } = site;

  const copyCoordinates = async () => {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(`${site.latitude}, ${site.longitude}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError(true);
    }
  };

  const weights = Object.entries(site.scoring_weights).filter(([, w]) => w > 0);

  return (
    <aside className="detail" aria-label={`Details for ${site.site_id}`}>
      <header className="detail__head">
        <div>
          <p className="eyebrow">Rank #{site.rank}</p>
          <h3 className="detail__title">{site.site_id}</h3>
          <p className="detail__coords">{formatCoordinates(site.latitude, site.longitude, 4)}</p>
        </div>
        <div className="detail__score" title="Ranking score out of 100. Not a probability of landing safely.">
          <span className="detail__score-value">{site.score.toFixed(1)}</span>
          <span className="detail__score-label">score / 100</span>
        </div>
        <button type="button" className="detail__close" onClick={onClose} aria-label="Close details">
          ×
        </button>
      </header>

      <div className="detail__body">
        {syntheticData ? (
          <Banner tone="warn" compact title="Synthetic terrain">
            This demonstrates the pipeline. It is not lunar landing guidance.
          </Banner>
        ) : null}

        <p className={`detail__confidence detail__confidence--${site.confidence}`}>{CONFIDENCE_LABEL[site.confidence]}</p>

        <FootprintMap sites={allSites} selectedSiteId={site.site_id} onSelectSite={onSelectSite} />

        <dl className="detail__metrics">
          <Metric label="Elevation" value={formatNumber(metrics.elevation_m, 1, " m")} />
          <Metric label="Worst slope" value={formatNumber(metrics.max_slope_degrees, 1, "°")} />
          <Metric label="Roughness" value={formatNumber(metrics.roughness_m, 2, " m")} />
          <Metric label="Illumination" value={formatNumber(metrics.illumination, 0, "%")} />
          <Metric
            label="Valid data"
            value={metrics.valid_pixel_fraction === null ? "n/a" : `${(metrics.valid_pixel_fraction * 100).toFixed(0)}%`}
          />
          <Metric label="Resources" value={metrics.resource_proximity === null ? "No data" : formatNumber(metrics.resource_proximity, 2)} />
        </dl>

        <section>
          <h4 className="detail__heading">Why this site</h4>
          <ul className="detail__list">
            {site.explanation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        {Object.keys(site.hazard_distances_m).length > 0 ? (
          <section>
            <h4 className="detail__heading">Hazard distance</h4>
            <dl className="detail__metrics detail__metrics--single">
              {Object.entries(site.hazard_distances_m).map(([key, value]) => (
                <Metric key={key} label={humanizeKey(key)} value={`${value.toFixed(0)} m`} />
              ))}
            </dl>
          </section>
        ) : null}

        <section>
          <h4 className="detail__heading">Scoring weights</h4>
          <ul className="detail__weights">
            {weights.map(([key, weight]) => (
              <li key={key}>
                <span>{weightLabel(key)}</span>
                <span className="detail__weight-bar" aria-hidden="true">
                  <span style={{ width: `${Math.round(weight * 100)}%` }} />
                </span>
                <span className="detail__weight-value">{Math.round(weight * 100)}%</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h4 className="detail__heading">Data quality</h4>
          <p className="detail__source">
            {site.data_source} · {site.resolution_m} m/px
          </p>
          <ul className="detail__flags">
            {site.quality_flags.map((flag) => (
              <li key={flag}>{humanizeFlag(flag)}</li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="detail__foot">
        {copyError ? <Banner tone="error" compact title="Clipboard access was blocked. Copy the coordinates manually." /> : null}
        <Button variant="ghost" onClick={copyCoordinates}>
          {copied ? "Copied" : "Copy coordinates"}
        </Button>
      </footer>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail__metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
