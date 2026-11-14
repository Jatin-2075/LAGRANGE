import { useMemo } from "react";
import type { SiteResult } from "../../api/types";
import { southPolarProject } from "../../lib/geo";
import "./FootprintMap.css";

interface FootprintMapProps {
  sites: SiteResult[];
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
}

const SIZE = 220;
const PAD = 18;

function niceLength(value: number): number {
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const lead = value / power;
  return (lead >= 5 ? 5 : lead >= 2 ? 2 : 1) * power;
}

const formatLength = (m: number) => (m >= 1000 ? `${m / 1000} km` : `${m} m`);

interface Shape {
  site: SiteResult;
  points: [number, number][];
  centre: [number, number];
}

export function FootprintMap({ sites, selectedSiteId, onSelectSite }: FootprintMapProps) {
  const view = useMemo(() => {
    const shapes: Shape[] = [];
    for (const site of sites) {
      const ring = site.landing_footprint?.geometry.coordinates[0];
      if (!ring || ring.length < 3) continue;
      const points = ring.map(([lon, lat]) => southPolarProject(lat!, lon!));
      shapes.push({ site, points, centre: southPolarProject(site.latitude, site.longitude) });
    }
    if (shapes.length === 0) return null;

    const xs = shapes.flatMap((s) => s.points.map((p) => p[0]));
    const ys = shapes.flatMap((s) => s.points.map((p) => p[1]));
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY, 1);
    const scale = (SIZE - PAD * 2) / span;
    const offsetX = (SIZE - (maxX - minX) * scale) / 2;
    const offsetY = (SIZE - (maxY - minY) * scale) / 2;
    const toSvg = ([x, y]: [number, number]): [number, number] => [
      offsetX + (x - minX) * scale,
      SIZE - (offsetY + (y - minY) * scale),
    ];

    const bar = niceLength(span * 0.3);
    return {
      scale,
      bar,
      shapes: shapes.map((shape) => ({
        id: shape.site.site_id,
        rank: shape.site.rank,
        path: shape.points.map((p, i) => `${i === 0 ? "M" : "L"}${toSvg(p).map((n) => n.toFixed(1)).join(",")}`).join(" ") + "Z",
        centre: toSvg(shape.centre),
      })),
    };
  }, [sites]);

  if (!view) return null;

  const ordered = [...view.shapes].sort((a, b) => Number(a.id === selectedSiteId) - Number(b.id === selectedSiteId));
  const barPx = view.bar * view.scale;

  return (
    <figure className="footprint-map">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="group" aria-label="Plan view of landing footprints">
        <rect width={SIZE} height={SIZE} className="footprint-map__bg" />
        {ordered.map((shape) => {
          const selected = shape.id === selectedSiteId;
          return (
            <g
              key={shape.id}
              className={`footprint-map__site${selected ? " footprint-map__site--selected" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`Select ${shape.id}`}
              aria-pressed={selected}
              onClick={() => onSelectSite(shape.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectSite(shape.id);
                }
              }}
            >
              <path d={shape.path} />
              <text x={shape.centre[0]} y={shape.centre[1]} dy="0.35em">
                {shape.rank}
              </text>
            </g>
          );
        })}
        <g className="footprint-map__scale">
          <line x1={PAD} x2={PAD + barPx} y1={SIZE - 10} y2={SIZE - 10} />
          <text x={PAD} y={SIZE - 15}>
            {formatLength(view.bar)}
          </text>
        </g>
        <text className="footprint-map__north" x={SIZE - 10} y={16} textAnchor="end">
          ↑ lon 0°
        </text>
      </svg>
    </figure>
  );
}
