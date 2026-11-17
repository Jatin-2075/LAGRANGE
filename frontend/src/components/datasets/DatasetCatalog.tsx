import { useEffect, useState } from "react";
import { getDatasetCatalog, type DatasetCatalogResponse, type InstalledDataset } from "../../api/datasets";
import { ApiError, isAbortError } from "../../api/client";
import { Panel, PanelHeader } from "../ui/Panel";
import "./DatasetCatalog.css";

function formatShape(shape: number[]) {
  return shape.length ? shape.join(" × ") : "Unknown";
}

function formatRasterValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function InstalledDatasetCard({ dataset }: { dataset: InstalledDataset }) {
  const raster = dataset.raster;
  return (
    <article className="dataset-card dataset-card--installed">
      <div className="dataset-card__heading">
        <div>
          <p className="eyebrow">Installed dataset</p>
          <h3>{dataset.dataset_version}</h3>
        </div>
        <span className={`dataset-status${dataset.synthetic ? " dataset-status--synthetic" : ""}`}>
          {dataset.synthetic ? "Synthetic" : "Production"}
        </span>
      </div>
      <dl className="dataset-card__details">
        <div><dt>Source</dt><dd>{dataset.data_source || "Not specified"}</dd></div>
        <div><dt>Resolution</dt><dd>{dataset.resolution_m} m / pixel</dd></div>
        <div><dt>Raster shape</dt><dd>{formatShape(dataset.shape)}</dd></div>
        <div><dt>Driver</dt><dd>{formatRasterValue(raster.driver)}</dd></div>
        <div><dt>CRS</dt><dd>{formatRasterValue(raster.crs)}</dd></div>
        <div><dt>Pixel size</dt><dd>{formatRasterValue(raster.pixel_size_m)}</dd></div>
      </dl>
    </article>
  );
}

export function DatasetCatalog() {
  const [catalog, setCatalog] = useState<DatasetCatalogResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    getDatasetCatalog(controller.signal)
      .then(setCatalog)
      .catch((requestError: unknown) => {
        if (!isAbortError(requestError)) {
          setError(requestError instanceof Error ? requestError : new Error("Unable to load datasets."));
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const errorMessage = error instanceof ApiError && error.details.length
    ? error.details.join(" ")
    : error?.message ?? "The dataset catalog could not be loaded.";

  return (
    <Panel className="dataset-page" label="Dataset catalog">
      <PanelHeader
        eyebrow="Data catalog"
        title="Terrain datasets"
        meta={<><span>Backend catalog</span><span>GET /api/v1/datasets</span></>}
        actions={<span className="dataset-page__count">{catalog?.installed.length ?? 0} installed</span>}
      />
      <div className="dataset-page__content">
        {loading ? <p className="dataset-page__message">Loading dataset catalog…</p> : null}
        {error ? (
          <div className="dataset-page__error" role="alert">
            <strong>Dataset catalog unavailable</strong>
            <span>{errorMessage}</span>
          </div>
        ) : null}
        {catalog ? (
          <>
            <section className="dataset-section" aria-labelledby="installed-datasets-title">
              <div className="dataset-section__heading">
                <div>
                  <p className="eyebrow">Available now</p>
                  <h3 id="installed-datasets-title">Installed terrain</h3>
                </div>
                <span className="dataset-section__count">{catalog.installed.length}</span>
              </div>
              <div className="dataset-grid">
                {catalog.installed.map((dataset) => (
                  <InstalledDatasetCard key={dataset.dataset_version} dataset={dataset} />
                ))}
              </div>
            </section>

            <section className="dataset-section" aria-labelledby="planned-datasets-title">
              <div className="dataset-section__heading">
                <div>
                  <p className="eyebrow">Roadmap</p>
                  <h3 id="planned-datasets-title">Planned datasets</h3>
                </div>
                <span className="dataset-section__count">{catalog.planned_not_installed.length}</span>
              </div>
              <div className="dataset-grid dataset-grid--planned">
                {catalog.planned_not_installed.map((dataset) => (
                  <article className="dataset-card dataset-card--planned" key={dataset.name}>
                    <h4>{dataset.name}</h4>
                    <p>{dataset.use}</p>
                    <span className="dataset-status">Not installed</span>
                  </article>
                ))}
              </div>
            </section>

            <section className="dataset-section" aria-labelledby="terrain-api-title">
              <div className="dataset-section__heading">
                <div>
                  <p className="eyebrow">Related services</p>
                  <h3 id="terrain-api-title">Terrain sampling APIs</h3>
                </div>
              </div>
              <div className="dataset-api-list">
                <code>GET /api/v1/terrain/elevation</code>
                <span>Sample elevation and dataset metadata at a latitude/longitude.</span>
                <code>GET /api/v1/terrain/slope</code>
                <span>Sample slope, roughness, hazards, and dataset metadata at a point.</span>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </Panel>
  );
}
