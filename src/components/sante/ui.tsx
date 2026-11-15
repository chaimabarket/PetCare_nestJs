"use client";

import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { Icon } from "@/components/ui/Icon";
import { getPet, SPECIES_LABELS, type PetInfo } from "@/lib/health-records-api";

export const pageClass = "max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-xl w-full";

export function PageLoading({ label = "Chargement du carnet de santé…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-space-sm p-space-2xl text-on-surface-variant" role="status">
      <Icon name="progress_activity" className="animate-spin text-primary" />
      {label}
    </div>
  );
}

/** Fil d'Ariane, comme sur les maquettes (Accueil › Mes animaux › Milo › Carnet de santé). */
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant mb-space-lg">
      <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
        <Icon name="home" className="text-[18px]" />
        <span>Accueil</span>
      </Link>
      {items.map((item, index) => (
        <Fragment key={`${item.label}-${index}`}>
          <Icon name="chevron_right" className="text-[14px] text-outline" />
          {item.href ? (
            <Link href={item.href} className="hover:text-primary transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-primary font-medium" aria-current="page">
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

const linkVariants = {
  primary: "bg-primary text-on-primary shadow-sm hover:bg-primary-container hover:shadow-md",
  secondary: "bg-surface-container-low text-primary hover:bg-primary-container hover:text-on-primary",
};

/** Lien avec l'apparence de <Button>. */
export function ButtonLink({
  href,
  variant = "primary",
  icon,
  className = "",
  children,
}: {
  href: string;
  variant?: keyof typeof linkVariants;
  icon?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-space-lg font-label-lg text-label-lg transition-all ${linkVariants[variant]} ${className}`}
    >
      {icon && <Icon name={icon} className="text-[20px]" />}
      <span>{children}</span>
    </Link>
  );
}

/** Fenêtre de confirmation (suppression d'un acte). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-margin">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={busy ? undefined : onCancel} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full sm:max-w-md bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl p-space-lg md:p-space-xl shadow-xl flex flex-col gap-space-md"
      >
        <span className="w-12 h-12 rounded-full bg-error-container/60 text-error flex items-center justify-center">
          <Icon name="delete" className="text-[24px]" />
        </span>
        <h2 id={titleId} className="font-headline-md text-headline-md text-on-surface tracking-tight">
          {title}
        </h2>
        <div className="font-body-md text-body-md text-on-surface-variant">{children}</div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-space-sm pt-space-sm">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-11 px-space-lg rounded-full font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-11 px-space-lg rounded-full font-label-lg text-label-lg bg-error text-on-error hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {busy && <Icon name="progress_activity" className="animate-spin text-[18px]" />}
            {busy ? "Suppression…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Fiche de l'animal (module Mes animaux) : nom, espèce, statut. `readOnly` : animal archivé, son carnet ne se
 * modifie plus (l'API refuse aussi ces écritures). `loaded` passe à vrai une fois la fiche lue (ou introuvable).
 */
export function usePet(
  petId: string,
  fallbackName?: string,
): { pet: PetInfo | null; name: string; loaded: boolean; readOnly: boolean } {
  const { user } = useAuth();
  const [state, setState] = useState<{ petId: string; pet: PetInfo | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getPet(petId).then((pet) => active && setState({ petId, pet }));
    return () => {
      active = false;
    };
  }, [petId, user]);

  const pet = state?.petId === petId ? state.pet : null;
  return {
    pet,
    name: pet?.name || fallbackName || "Mon animal",
    loaded: state?.petId === petId,
    readOnly: Boolean(pet?.archived),
  };
}

/** Bandeau des carnets d'animaux archivés. */
export function ReadOnlyBanner({ name }: { name: string }) {
  return (
    <div role="status" className="flex items-start gap-space-sm rounded-xl bg-surface-container p-space-md font-body-md text-body-md text-on-surface-variant">
      <Icon name="inventory_2" className="text-[20px] text-outline mt-0.5" />
      <p>
        <strong className="text-on-surface">Lecture seule.</strong> {name} est archivé : son carnet se consulte et
        s&apos;exporte, mais ne peut plus être modifié. Restaurez sa fiche dans « Mes animaux » pour le compléter.
      </p>
    </div>
  );
}

/** Photo de couverture de l'animal (miniature), ou icône. */
export function PetThumb({ src, name, size = "w-14 h-14" }: { src?: string; name: string; size?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- miniature en data URL (pas d'optimisation possible)
    <img src={src} alt={name} className={`${size} shrink-0 rounded-2xl object-cover`} />
  ) : (
    <span className={`${size} shrink-0 rounded-2xl bg-primary-fixed/50 text-primary flex items-center justify-center`}>
      <Icon name="pets" filled className="text-[28px]" />
    </span>
  );
}

export function petSubtitle(pet: PetInfo | null): string | undefined {
  if (!pet) return undefined;
  return [pet.species ? SPECIES_LABELS[pet.species] ?? pet.species : null, pet.breed].filter(Boolean).join(" · ") || undefined;
}

export const carnetHref = (petId: string, name?: string) =>
  `/animaux/${encodeURIComponent(petId)}/carnet-de-sante${name ? `?nom=${encodeURIComponent(name)}` : ""}`;
