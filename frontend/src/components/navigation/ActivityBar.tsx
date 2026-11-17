import "./ActivityBar.css";

type ActivityIcon = "explorer" | "data";

function Icon({ name }: { name: ActivityIcon }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  switch (name) {
    case "explorer":
      return <><rect {...common} x="4" y="4" width="16" height="16" rx="2" /><path {...common} d="M8 8h8M8 12h8M8 16h5" /></>;
    case "data":
      return <><path {...common} d="M7 3h10M9 3v6l-4 10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1L15 9V3M7 15h10" /></>;
  }
}

interface ActivityButtonProps {
  label: string;
  icon: ActivityIcon;
  active?: boolean;
  onClick?: () => void;
}

function ActivityButton({ label, icon, active = false, onClick }: ActivityButtonProps) {
  return (
    <button
      type="button"
      className={`activity-bar__button${active ? " activity-bar__button--active" : ""}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <Icon name={icon} />
      </svg>
    </button>
  );
}

export type WorkspacePage = "planner" | "datasets";

interface ActivityBarProps {
  currentPage: WorkspacePage;
  onPageChange: (page: WorkspacePage) => void;
}

export function ActivityBar({ currentPage, onPageChange }: ActivityBarProps) {
  return (
    <nav className="activity-bar" aria-label="Workspace navigation">
      <div className="activity-bar__items">
        <ActivityButton label="Mission planner" icon="explorer" active={currentPage === "planner"} onClick={() => onPageChange("planner")} />
        <ActivityButton label="Dataset catalog" icon="data" active={currentPage === "datasets"} onClick={() => onPageChange("datasets")} />
      </div>
    </nav>
  );
}
