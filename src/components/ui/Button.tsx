import type { ButtonHTMLAttributes } from "react";
import { Icon } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "coral" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-sm hover:bg-primary-container hover:shadow-md",
  secondary: "bg-surface-container-low text-primary hover:bg-primary-container hover:text-on-primary",
  ghost: "text-on-surface-variant hover:text-on-surface hover:bg-surface-container",
  coral: "bg-[#E07A5F] text-white shadow-sm hover:bg-secondary",
  danger: "bg-error-container/40 text-error hover:bg-error hover:text-on-error",
};

export function Button({
  variant = "primary",
  loading = false,
  icon,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  /** Icône Material affichée après le texte (ex. "arrow_forward"). */
  icon?: string;
}) {
  return (
    <button
      className={`group inline-flex h-11 items-center justify-center gap-2 rounded-full px-space-lg font-label-lg text-label-lg transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Icon name="progress_activity" className="animate-spin text-body-lg" />
          <span>Veuillez patienter…</span>
        </>
      ) : (
        <>
          <span>{children}</span>
          {icon && <Icon name={icon} className="text-[18px] transition-transform group-hover:translate-x-1" />}
        </>
      )}
    </button>
  );
}
