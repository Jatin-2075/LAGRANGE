import type { BackendStatus } from "../../hooks/useBackendHealth";
import "./StatusBadge.css";

const LABELS: Record<BackendStatus, string> = {
  checking: "Connecting",
  online: "Live",
  offline: "Offline",
};

export function StatusBadge({ status }: { status: BackendStatus }) {
  return (
    <span className={`status-badge status-badge--${status}`} role="status" aria-label={`Backend ${LABELS[status].toLowerCase()}`}>
      <span className="status-badge__dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
