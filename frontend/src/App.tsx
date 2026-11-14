import { useCallback, useMemo, useState } from "react";
import type { MissionRequest } from "./api/types";
import { MissionForm } from "./components/form/MissionForm";
import { Panel } from "./components/ui/Panel";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { VisualizationPanel } from "./components/viewer/VisualizationPanel";
import { useAnalysis } from "./hooks/useAnalysis";
import { useBackendHealth } from "./hooks/useBackendHealth";
import { DEFAULT_FORM, parseTarget, type MissionFormState } from "./lib/mission";
import "./App.css";

const round4 = (value: number) => String(Math.round(value * 1e4) / 1e4);

export default function App() {
  const [form, setForm] = useState<MissionFormState>(DEFAULT_FORM);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const { loading, analysis, error, run } = useAnalysis();
  const backendStatus = useBackendHealth();

  const target = useMemo(() => parseTarget(form), [form]);

  const patchForm = useCallback((patch: Partial<MissionFormState>) => {
    setForm((previous) => ({ ...previous, ...patch }));
  }, []);

  const handleSubmit = useCallback(
    async (request: MissionRequest) => {
      setSelectedSiteId(null);
      const result = await run(request);
      if (result?.results[0]) setSelectedSiteId(result.results[0].site_id);
    },
    [run],
  );

  const handlePickPoint = useCallback(
    (latitude: number, longitude: number) => {
      patchForm({ latitude: round4(latitude), longitude: round4(longitude) });
    },
    [patchForm],
  );

  return (
    <main className="app">
      <ErrorBoundary fallbackTitle="The visualization hit an error">
        <VisualizationPanel
          analysis={analysis}
          loading={loading}
          error={error}
          backendStatus={backendStatus}
          target={target}
          selectedSiteId={selectedSiteId}
          onSelectSite={setSelectedSiteId}
          onPickPoint={handlePickPoint}
        />
      </ErrorBoundary>

      <Panel className="app__sidebar" label="Mission parameters">
        <MissionForm value={form} onChange={patchForm} onSubmit={handleSubmit} loading={loading} />
      </Panel>
    </main>
  );
}
