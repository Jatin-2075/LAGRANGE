import { apiRequest } from "./client";

export interface DatasetRasterInfo {
  driver?: string;
  width?: number;
  height?: number;
  bands?: number;
  dtype?: string;
  crs?: string | null;
  pixel_size_m?: number[];
  nodata?: number | null;
  bounds?: number[];
  [key: string]: unknown;
}

export interface InstalledDataset {
  dataset_version: string;
  data_source: string;
  synthetic: boolean;
  resolution_m: number;
  shape: number[];
  raster: DatasetRasterInfo;
}

export interface PlannedDataset {
  name: string;
  use: string;
}

export interface DatasetCatalogResponse {
  installed: InstalledDataset[];
  planned_not_installed: PlannedDataset[];
}

export function getDatasetCatalog(signal?: AbortSignal): Promise<DatasetCatalogResponse> {
  return apiRequest<DatasetCatalogResponse>("/api/v1/datasets", { signal });
}
