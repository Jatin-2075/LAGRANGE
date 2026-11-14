import { useEffect, useState } from "react";
import { checkHealth } from "../api/sites";

export type BackendStatus = "checking" | "online" | "offline";

const POLL_MS = 20_000;

export function useBackendHealth(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    let timer = 0;
    let cancelled = false;
    const controller = new AbortController();

    const poll = async () => {
      const ok = await checkHealth(controller.signal);
      if (cancelled) return;
      setStatus(ok ? "online" : "offline");
      timer = window.setTimeout(poll, POLL_MS);
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(timer);
      void poll();
    };

    void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return status;
}
