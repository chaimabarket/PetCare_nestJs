"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/** Fenêtre modale (Échap ou clic à l'extérieur pour fermer), style de la maquette d'archivage. */
export function Modal({
  title,
  icon,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  icon?: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    panel.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-margin overflow-y-auto bg-inverse-surface/50 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full ${wide ? "max-w-3xl" : "max-w-[560px]"} bg-surface-container-lowest rounded-xl shadow-2xl my-auto focus:outline-none`}
      >
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
        >
          <Icon name="close" className="text-[20px]" />
        </button>
        <div className="p-space-lg sm:p-space-xl">
          <div className="flex items-start gap-space-md mb-space-lg pr-space-xl">
            {icon && (
              <span className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0 text-secondary">
                <Icon name={icon} className="text-[26px]" />
              </span>
            )}
            <div>
              <h2 id={titleId} className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
                {title}
              </h2>
              {subtitle && <div className="mt-1">{subtitle}</div>}
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
