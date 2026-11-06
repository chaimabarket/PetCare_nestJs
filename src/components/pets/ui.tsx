"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { WEIGHT_ALERT_INFO } from "@/lib/pet-weight-alert";
import { SPECIES_INFO, type Pet, type PetWeightAlertState } from "@/lib/pets";
import { errorMessage } from "@/lib/users";

/**
 * Liens vers les modules qui utilisent les animaux. `null` tant que le module n'est pas sur `main` :
 * le bouton affiche « Bientôt disponible ». À renseigner à la fusion, par exemple
 * `health: (id) => `/animaux/${id}/carnet-de-sante``, `assistant: (id) => `/assistant?pet=${id}``.
 */
export const LINKED_MODULES: Record<
  "health" | "appointments" | "reminders" | "assistant" | "vets",
  ((petId: string) => string) | null
> = {
  health: null,
  appointments: null,
  reminders: null,
  assistant: null,
  /** Annuaire des vétérinaires (module Services). */
  vets: null,
};

export const COMING_SOON = "Bientôt disponible";

export const pageClass = "max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg pt-6 pb-12 w-full";

/** Charge des données ; `load` doit être stable (useCallback). `reload()` relance après une modification. */
export function useLoad<T>(load: (() => Promise<T>) | null) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!load) return;
    let active = true;
    load().then(
      (data) => active && setState({ data, loading: false }),
      (error) => {
        console.error(error);
        if (active) setState({ error: errorMessage(error), loading: false });
      },
    );
    return () => {
      active = false;
    };
  }, [load, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  /** Remplace les données sans recharger (réponse d'une modification). */
  const replace = useCallback((data: T) => setState({ data, loading: false }), []);
  return { ...state, reload, replace };
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
      <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
        <Icon name="home" className="text-[16px]" />
        <span>Accueil</span>
      </Link>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-2">
          <Icon name="chevron_right" className="text-[14px] text-outline-variant" />
          {item.href ? (
            <Link href={item.href} className="hover:text-primary transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="font-label-md text-label-md text-on-surface">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Photo de couverture (miniature) ronde, ou l'emoji de l'espèce. */
export function PetAvatar({ pet, className = "w-16 h-16" }: { pet: Pick<Pet, "name" | "species" | "photos">; className?: string }) {
  const src = pet.photos[0]?.thumbnail;
  if (!src) {
    return (
      <span
        aria-hidden
        className={`rounded-full bg-primary-fixed/40 ring-4 ring-surface-container-low flex items-center justify-center text-[28px] shrink-0 ${className}`}
      >
        {SPECIES_INFO[pet.species].emoji}
      </span>
    );
  }
  return (
    // Photos déjà compressées dans le navigateur et stockées dans MongoDB (data URL) : pas de next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={pet.name} className={`rounded-full object-cover ring-4 ring-surface-container-low shrink-0 ${className}`} />
  );
}

const alertTones = {
  consult: "bg-error-container/60 text-on-error-container",
  watch: "bg-amber-50 text-amber-800",
};

/** Badge de la liste : alerte de poids en cours (même ignorée sur la fiche, elle reste signalée ici). */
export function WeightAlertBadge({ alert }: { alert: PetWeightAlertState }) {
  const info = WEIGHT_ALERT_INFO[alert.rule];
  return (
    <span
      title={`${info.title} (${alert.changePct > 0 ? "+" : ""}${alert.changePct.toLocaleString("fr-FR")} %)`}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-label-sm text-label-sm ${alertTones[alert.level]}`}
    >
      <Icon name="monitor_weight" className="text-[14px]" />
      {alert.level === "consult" ? "Poids : consulter" : "Poids à surveiller"}
    </span>
  );
}

export function StatusBadge({ tone, children }: { tone: "grey" | "amber" | "green"; children: ReactNode }) {
  const tones = {
    grey: "bg-surface-container text-on-surface-variant",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
  };
  const dots = { grey: "bg-outline", amber: "bg-amber-500", green: "bg-emerald-500" };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-label-sm text-label-sm ${tones[tone]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[tone]}`} />
      {children}
    </span>
  );
}

/** Raccourci vers un autre module (Santé, Rendez-vous…), désactivé tant que le module n'existe pas. */
export function ModuleLink({
  module,
  petId,
  icon,
  children,
  className,
}: {
  module: keyof typeof LINKED_MODULES;
  petId: string;
  icon: string;
  children: ReactNode;
  className: string;
}) {
  const href = LINKED_MODULES[module]?.(petId);
  const content = (
    <>
      <Icon name={icon} className="text-[18px]" />
      <span>{children}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <span title={COMING_SOON} aria-disabled className={`${className} opacity-60 cursor-not-allowed`}>
      {content}
    </span>
  );
}

export function LoadingState({ text = "Chargement…" }: { text?: string }) {
  return (
    <p className="p-space-xl text-center text-on-surface-variant flex items-center justify-center gap-2">
      <Icon name="progress_activity" className="animate-spin" />
      {text}
    </p>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-error-container/40 text-on-error-container rounded-2xl p-space-lg flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
      <p className="flex items-center gap-2">
        <Icon name="error" />
        {message}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-label-md text-label-md underline">
          Réessayer
        </button>
      )}
    </div>
  );
}
