import { apiRequest } from "./client";
import type { AnalysisResponse, MissionRequest } from "./types";

export function analyzeSites(request: MissionRequest, signal?: AbortSignal): Promise<AnalysisResponse> {
  return apiRequest<AnalysisResponse>("/api/v1/sites/analyze", {
    method: "POST",
    body: request,
    signal,
    timeoutMs: 120_000,
  });
}

export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    await apiRequest<{ status: string }>("/api/v1/health", { signal, timeoutMs: 5_000 });
    return true;
  } catch {
    return false;
  }
}
