import type { ReactNode } from "react";
import "./Panel.css";

interface PanelProps {
  children: ReactNode;
  className?: string;
  label?: string;
}

export function Panel({ children, className = "", label }: PanelProps) {
  return (
    <section className={`panel ${className}`.trim()} aria-label={label}>
      {children}
    </section>
  );
}

interface PanelHeaderProps {
  eyebrow: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function PanelHeader({ eyebrow, title, meta, actions }: PanelHeaderProps) {
  return (
    <header className="panel-header">
      <div className="panel-header__text">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="panel-header__title">{title}</h2>
        {meta ? <p className="panel-header__meta">{meta}</p> : null}
      </div>
      {actions ? <div className="panel-header__actions">{actions}</div> : null}
    </header>
  );
}
