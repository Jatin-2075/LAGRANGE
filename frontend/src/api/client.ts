const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export type ApiErrorKind = "network" | "timeout" | "http" | "parse";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly details: string[];

  constructor(kind: ApiErrorKind, message: string, status: number | null = null, details: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function readDetails(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || !("detail" in payload)) return [];
  const detail = (payload as { detail: unknown }).detail;
  if (typeof detail === "string") return [detail];
  if (Array.isArray(detail)) {
    return detail.map((item) => {
      if (item && typeof item === "object" && "msg" in item) {
        const loc = Array.isArray((item as { loc?: unknown }).loc)
          ? ((item as { loc: unknown[] }).loc.slice(1).join(".") || "request")
          : "request";
        return `${loc}: ${String((item as { msg: unknown }).msg)}`;
      }
      return String(item);
    });
  }
  return [];
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal, timeoutMs = 60_000 } = options;
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: combined,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.aborted) {
      throw new ApiError("timeout", "The analysis took too long and was stopped. Try a smaller search radius.");
    }
    throw new ApiError("network", "Can't reach the planning backend. Check your connection and that the API is running.");
  }

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      if (response.ok) throw new ApiError("parse", "The backend returned an unreadable response.", response.status);
    }
  }

  if (!response.ok) {
    const details = readDetails(payload);
    const message =
      response.status === 503
        ? "Terrain data is unavailable on the backend right now."
        : response.status >= 500
          ? "The backend hit an error while processing the request."
          : response.status === 422
            ? "The backend rejected the mission parameters."
            : `Request failed (${response.status}).`;
    throw new ApiError("http", message, response.status, details);
  }

  return payload as T;
}
