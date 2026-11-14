import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
  loading?: boolean;
  trailing?: ReactNode;
}

export function Button({ variant = "primary", loading = false, trailing, children, className = "", disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn--${variant} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className="btn__label">{children}</span>
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : trailing ? <span className="btn__trailing" aria-hidden="true">{trailing}</span> : null}
    </button>
  );
}
