"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import {
  STATUS_LABELS,
  TYPE_ICONS,
  TYPE_LABELS,
  type AppointmentStatus,
  type AppointmentType,
} from "@/lib/rendez-vous/types";

/** Composants visuels du module Rendez-vous (équivalents de rdv_ui.dart dans l'application Flutter). */

export const pageClass = "w-full max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-lg";

/** Carte blanche à coins arrondis de 16 px, ombre douce. */
export function RdvCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl bg-surface-container-lowest p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)] ${className}`}>
      {children}
    </div>
  );
}

export function Pill({ label, icon, className }: { label: string; icon?: string; className: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-label-md text-label-md ${className}`}>
      {icon && <Icon name={icon} className="text-[14px]" />}
      {label}
    </span>
  );
}

export const STATUS_STYLES: Record<AppointmentStatus, { className: string; icon?: string; dot: string }> = {
  confirmed: { className: "bg-primary-fixed/45 text-on-primary-fixed-variant", icon: "check_circle", dot: "bg-primary-container" },
  planned: { className: "bg-secondary-fixed text-on-secondary-container", icon: "hourglass_top", dot: "bg-secondary-container" },
  cancelled: { className: "bg-error-container text-on-error-container", dot: "bg-error" },
  completed: { className: "bg-surface-container-high text-on-surface-variant", icon: "task_alt", dot: "bg-outline" },
};

/** Pastille de statut (Confirmé, En attente, Annulé, Terminé). */
export function StatusPill({ status, label }: { status: AppointmentStatus; label?: string }) {
  const style = STATUS_STYLES[status];
  return <Pill label={label ?? STATUS_LABELS[status]} icon={style.icon} className={style.className} />;
}

/** Petite étiquette de type (Vaccin, Toilettage, Personnel…) dans les cartes. */
export function TypeTag({ type, label, className }: { type?: AppointmentType; label?: string; className?: string }) {
  const color =
    className ??
    (type === "vaccin" || type === "veterinaire"
      ? "bg-primary-container text-white"
      : type === "toilettage"
        ? "bg-secondary-container text-on-secondary-container"
        : "bg-surface-container-high text-on-surface-variant");
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 font-label-md text-label-md ${color}`}>
      {type && <Icon name={TYPE_ICONS[type]} className="text-[14px]" />}
      {label ?? (type ? TYPE_LABELS[type] : "")}
    </span>
  );
}

/** Initiale de l'animal sur fond pastel, avec une pastille patte en bas à droite. */
export function PetAvatar({ name, size = 52, badge = true }: { name: string; size?: number; badge?: boolean }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const dot = Math.round(size * 0.4);
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden>
      <span
        className="flex h-full w-full items-center justify-center rounded-full bg-secondary-fixed font-bold text-on-secondary-container"
        style={{ fontSize: size * 0.4 }}
      >
        {initial}
      </span>
      {badge && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-2 border-white bg-primary-fixed text-on-primary-fixed-variant"
          style={{ width: dot, height: dot }}
        >
          <Icon name="pets" filled className={size >= 48 ? "text-[12px]" : "text-[9px]"} />
        </span>
      )}
    </span>
  );
}

const softTones = {
  neutral: "bg-surface-container text-on-surface hover:bg-surface-container-high",
  primary: "bg-surface-container text-primary hover:bg-surface-container-high",
  coral: "bg-secondary-fixed text-on-secondary-container hover:bg-secondary-fixed-dim",
  solid: "bg-primary text-on-primary hover:bg-primary-container",
  danger: "text-error hover:bg-error-container/50",
};

/** Bouton plat coloré des cartes (Itinéraire, Carnet santé, Modifier, Contacter…). */
export function SoftButton({
  label,
  icon,
  onClick,
  href,
  tone = "neutral",
  disabled,
  className = "",
  type = "button",
}: {
  label: string;
  icon: string;
  onClick?: () => void;
  href?: string;
  tone?: keyof typeof softTones;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const classes = `inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 font-label-lg text-label-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${softTones[tone]} ${className}`;
  const content = (
    <>
      <Icon name={icon} className="text-[18px]" />
      <span className="truncate">{label}</span>
    </>
  );
  if (href && !disabled) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {content}
    </button>
  );
}

/** Puce de filtre arrondie (sélectionnée = fond teal). */
export function Chip({
  label,
  selected,
  onClick,
  leading,
  trailing,
  disabled,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border py-1.5 pr-3.5 font-label-lg text-label-lg transition-colors disabled:cursor-not-allowed ${
        leading ? "pl-1.5" : "pl-3.5"
      } ${
        selected
          ? "border-primary-container bg-primary-container text-white"
          : "border-outline-variant/60 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low"
      }`}
    >
      {leading}
      {label}
      {trailing}
    </button>
  );
}

/** Titre de champ avec astérisque rouge pour les champs obligatoires. */
export function FieldLabel({
  children,
  required,
  trailing,
  htmlFor,
}: {
  children: ReactNode;
  required?: boolean;
  trailing?: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="font-label-lg text-[15px] text-on-surface">
        {children}
        {required && <span className="text-error"> *</span>}
      </label>
      {trailing}
    </div>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-1.5 pl-1 font-body-sm text-body-sm text-error">
      {children}
    </p>
  );
}

/** Bandeau rouge (créneau en conflit, enregistrement impossible). */
export function ErrorBanner({ title, message, badge }: { title: string; message: string; badge?: string }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-error-container p-3.5">
      <Icon name="error" className="text-[22px] text-error" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="flex-1 font-bold text-[15px] text-on-error-container">{title}</p>
          {badge && <span className="rounded-full bg-error px-2 py-0.5 text-[11px] font-semibold text-white">{badge}</span>}
        </div>
        <p className="mt-1 font-body-md text-[13px] text-on-error-container">{message}</p>
      </div>
    </div>
  );
}

/** Fenêtre de dialogue centrée (annulation, autre compagnon, nouveau rappel…). */
export function Dialog({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-lg" : "max-w-md"} rounded-2xl bg-surface-container-lowest p-0 text-on-surface shadow-[0_20px_40px_-12px_rgba(15,118,110,0.18)] backdrop:bg-inverse-surface/40`}
    >
      {open && (
        <div className="max-h-[85vh] overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-headline-sm text-headline-sm">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              title="Fermer"
              className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
            >
              <Icon name="close" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

type ToastState = { message: string; tone: "success" | "error"; key: number } | null;

/** Message à afficher sur la page suivante (après un enregistrement suivi d'une redirection). */
let flashMessage: string | null = null;

export function flash(message: string) {
  flashMessage = message;
}

/** Petit message en bas de l'écran (équivalent du SnackBar Flutter). */
export function useToast() {
  const [toast, setToast] = useState<ToastState>(() =>
    flashMessage ? { message: flashMessage, tone: "success", key: 0 } : null,
  );

  useEffect(() => {
    flashMessage = null;
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const show = useCallback(
    (message: string, tone: "success" | "error" = "success") => setToast({ message, tone, key: Date.now() }),
    [],
  );

  const view = toast && (
    <div
      key={toast.key}
      role={toast.tone === "error" ? "alert" : "status"}
      className={`fixed bottom-24 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-3 font-body-md text-body-md text-white shadow-lg md:bottom-6 ${
        toast.tone === "error" ? "bg-error" : "bg-inverse-surface"
      }`}
    >
      <Icon name={toast.tone === "error" ? "error" : "check_circle"} className="text-[20px]" />
      <span className="flex-1">{toast.message}</span>
    </div>
  );

  return { show, view };
}

/** Rappelle que la page fonctionne sans base de données. */
export function DemoBanner() {
  return (
    <p className="mb-space-md flex items-center gap-2 rounded-xl bg-secondary-fixed/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container">
      <Icon name="science" className="text-[18px]" />
      Version de démonstration : données fictives, rien n&apos;est enregistré (la base MongoDB arrive bientôt).
    </p>
  );
}

/** Fil d'Ariane : Accueil › Agenda › … */
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="mb-space-md flex flex-wrap items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
      <Link href="/" className="flex items-center gap-1 hover:text-primary">
        <Icon name="home" className="text-[16px]" />
        Accueil
      </Link>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1">
          <Icon name="chevron_right" className="text-[16px]" />
          {item.href ? (
            <Link href={item.href} className="hover:text-primary">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-on-surface">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function Loading() {
  return <p className="p-space-xl text-center text-on-surface-variant">Chargement…</p>;
}
