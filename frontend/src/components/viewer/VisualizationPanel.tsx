import { useEffect } from "react";
import type { AnalysisResponse } from "../../api/types";
import type { BackendStatus } from "../../hooks/useBackendHealth";
import { ResultsOverlay } from "../results/ResultsOverlay";
import { SiteDetail } from "../results/SiteDetail";
import { Panel, PanelHeader } from "../ui/Panel";
import { StatusBadge } from "../ui/StatusBadge";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { MoonViewer } from "./MoonViewer";
import "./VisualizationPanel.css";

interface VisualizationPanelProps {
  analysis: AnalysisResponse | null;
  loading: boolean;
  error: Error | null;
  backendStatus: BackendStatus;
  target: { latitude: number; longitude: number } | null;
  selectedSiteId: string | null;
  onSelectSite: (siteId: string | null) => void;
  onPickPoint: (latitude: number, longitude: number) => void;
}

export function VisualizationPanel({
  analysis, loading, error, backendStatus, target, selectedSiteId, onSelectSite, onPickPoint,
}: VisualizationPanelProps) {
  const sites = analysis?.results ?? [];
  const selected = sites.find((site) => site.site_id === selectedSiteId) ?? null;

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSelectSite(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onSelectSite]);

  return (
    <Panel className="viz" label="Lunar surface visualization">
      <PanelHeader
        eyebrow="Live visualization"
        title="Lunar surface"
        meta={
          <>
            <span>Backend locations: {sites.length}</span>
            <span>Drag to rotate</span>
          </>
        }
        actions={
          <>
            {analysis?.synthetic_data ? <span className="viz__chip">Synthetic data</span> : null}
            <StatusBadge status={backendStatus} />
          </>
        }
      />

      <div className="viz__stage">
        <div className="viz__canvas">
          <ErrorBoundary fallbackTitle="The 3D view crashed">
            <MoonViewer
              sites={sites}
              selectedSiteId={selectedSiteId}
              target={target}
              onSelectSite={onSelectSite}
              onPickPoint={onPickPoint}
            />
          </ErrorBoundary>
        </div>

        <div className="viz__overlay viz__overlay--left">
          <ResultsOverlay
            analysis={analysis}
            loading={loading}
            error={error}
            selectedSiteId={selectedSiteId}
            onSelectSite={onSelectSite}
          />
        </div>

        {selected ? (
          <div className="viz__overlay viz__overlay--right">
            <SiteDetail
              site={selected}
              allSites={sites}
              syntheticData={analysis?.synthetic_data ?? false}
              onSelectSite={onSelectSite}
              onClose={() => onSelectSite(null)}
            />
          </div>
        ) : null}
      </div>

      <footer className="viz__footer">
        <span>Drag to rotate</span>
        <span>Scroll to zoom</span>
        <span>Click to set target</span>
        <span className="viz__footer-spacer" />
        <span>{analysis ? `${analysis.dataset_version} · ${analysis.resolution_m} m/px` : "Schematic surface"}</span>
      </footer>
    </Panel>
  );
}
