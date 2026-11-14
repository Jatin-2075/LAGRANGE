import type { SiteResult } from "../../api/types";
import { formatCoordinates, formatNumber } from "../../lib/format";
import "./SiteCard.css";

interface SiteCardProps {
  site: SiteResult;
  selected: boolean;
  onSelect: (siteId: string) => void;
}

export function SiteCard({ site, selected, onSelect }: SiteCardProps) {
  return (
    <button
      type="button"
      className={`site-card${selected ? " site-card--selected" : ""}`}
      aria-pressed={selected}
      onClick={() => onSelect(site.site_id)}
    >
      <span className="site-card__rank">{String(site.rank).padStart(2, "0")}</span>
      <span className="site-card__body">
        <span className="site-card__name">{site.site_id}</span>
        <span className="site-card__coords">{formatCoordinates(site.latitude, site.longitude, 3)}</span>
        <span className="site-card__sub">
          {site.confidence} confidence · slope {formatNumber(site.metrics.max_slope_degrees, 1, "°")}
        </span>
      </span>
      <span className="site-card__score" title="Ranking score out of 100. Not a probability of landing safely.">
        {site.score.toFixed(0)}
      </span>
    </button>
  );
}
