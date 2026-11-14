import { useCallback, useEffect, useRef, useState } from "react";
import { isAbortError } from "../api/client";
import { analyzeSites } from "../api/sites";
import type { AnalysisResponse, MissionRequest } from "../api/types";

interface AnalysisState {
  loading: boolean;
  analysis: AnalysisResponse | null;
  error: Error | null;
}

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({ loading: false, analysis: null, error: null });
  const controller = useRef<AbortController | null>(null);

  const run = useCallback(async (request: MissionRequest): Promise<AnalysisResponse | null> => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const analysis = await analyzeSites(request, current.signal);
      if (current.signal.aborted) return null;
      setState({ loading: false, analysis, error: null });
      return analysis;
    } catch (error) {
      if (current.signal.aborted || isAbortError(error)) return null;
      setState((previous) => ({
        loading: false,
        analysis: previous.analysis,
        error: error instanceof Error ? error : new Error("Unexpected error"),
      }));
      return null;
    }
  }, []);

  useEffect(() => () => controller.current?.abort(), []);

  return { ...state, run };
}
