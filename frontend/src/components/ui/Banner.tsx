import type { ReactNode } from "react";
import "./Banner.css";

interface BannerProps {
  tone: "info" | "warn" | "error";
  title?: string;
  children?: ReactNode;
  compact?: boolean;
}

export function Banner({ tone, title, children, compact = false }: BannerProps) {
  return (
    <div className={`banner banner--${tone}${compact ? " banner--compact" : ""}`} role={tone === "error" ? "alert" : "status"}>
      {title ? <p className="banner__title">{title}</p> : null}
      {children ? <div className="banner__body">{children}</div> : null}
    </div>
  );
}
