"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import {
  BOOKING_STATUS_INFO,
  CATEGORY_ICON_INFO,
  PROVIDER_STATUS_INFO,
  SERVICES_ROUTES,
  WEEKDAY_LABELS,
  type BookingStatus,
  type CategoryIcon,
  type DayAvailability,
  type ProviderStatus,
  formatPrice,
  openingStatus,
  type ProviderSummary,
  type ServiceCategory,
  type ServiceProvider,
} from "@/lib/services";

// Chargement, erreurs et fil d'Ariane : mêmes composants que le module Mes animaux.
export { Breadcrumb, ErrorState, LoadingState, useLoad } from "@/components/pets/ui";

export const pageClass = "max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg pt-6 pb-12 w-full";

/** Icône Material Symbols d'une catégorie (par son nom ; « pets » si elle n'existe plus). */
export function categoryIcon(categories: ServiceCategory[], name: string): CategoryIcon {
  return categories.find((c) => c.name === name)?.icon ?? "autre";
}

export function CategoryBadge({ name, icon }: { name: string; icon: CategoryIcon }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm">
      <Icon name={CATEGORY_ICON_INFO[icon].symbol} className="text-[14px]" />
      {name}
    </span>
  );
}

const tones = {
  amber: "bg-amber-50 text-amber-800",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-error-container/60 text-on-error-container",
  grey: "bg-surface-container text-on-surface-variant",
};
const dots = { amber: "bg-amber-500", green: "bg-emerald-500", red: "bg-error", grey: "bg-outline" };

export function Pill({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm ${tones[tone]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[tone]}`} />
      {children}
    </span>
  );
}

export const ProviderStatusPill = ({ status }: { status: ProviderStatus }) => (
  <Pill tone={PROVIDER_STATUS_INFO[status].tone}>{PROVIDER_STATUS_INFO[status].label}</Pill>
);

export const BookingStatusPill = ({ status }: { status: BookingStatus }) => (
  <Pill tone={BOOKING_STATUS_INFO[status].tone}>{BOOKING_STATUS_INFO[status].label}</Pill>
);

/** Photo du prestataire (data URL compressée) ou icône de sa catégorie. */
export function ProviderPhoto({ provider, icon, className = "w-16 h-16" }: { provider: Pick<ServiceProvider, "name" | "photo">; icon: CategoryIcon; className?: string }) {
  if (!provider.photo) {
    return (
      <span aria-hidden className={`rounded-2xl bg-primary-fixed/40 text-primary flex items-center justify-center shrink-0 ${className}`}>
        <Icon name={CATEGORY_ICON_INFO[icon].symbol} className="text-[30px]" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={provider.photo} alt={provider.name} className={`rounded-2xl object-cover shrink-0 ${className}`} />;
}

/** Couleurs des tuiles de catégorie (maquette services_petcare_community). */
export const CATEGORY_TONES: Record<CategoryIcon, string> = {
  veterinaire: "bg-primary-fixed/70 text-primary",
  toilettage: "bg-secondary-fixed/70 text-secondary",
  promenade: "bg-primary-fixed/50 text-primary",
  pension: "bg-tertiary-fixed/70 text-tertiary",
  boutique: "bg-secondary-fixed/50 text-secondary",
  education: "bg-tertiary-fixed/50 text-tertiary",
  pharmacie: "bg-primary-fixed/50 text-primary",
  transport: "bg-tertiary-fixed/50 text-tertiary",
  autre: "bg-tertiary-fixed/70 text-tertiary",
};

/** Badge « Vérifié » : le profil a été validé par l'administration. */
export function VerifiedBadge({ label = "Vérifié" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-fixed/60 text-on-primary-fixed-variant font-label-sm text-label-sm">
      <Icon name="verified" className="text-[14px]" />
      {label}
    </span>
  );
}

/** Carte de l'annuaire (maquette services_petcare_community). */
export function ProviderCard({ provider, icon }: { provider: ProviderSummary; icon: CategoryIcon }) {
  const status = openingStatus(provider.availability);
  return (
    <article className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
      <Link href={SERVICES_ROUTES.provider(provider.id)} className="flex items-start gap-4 group">
        <ProviderPhoto provider={provider} icon={icon} className="w-24 h-24 group-hover:scale-105 transition-transform" />
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <VerifiedBadge />
          <h2 className="font-headline-sm text-headline-sm text-on-surface truncate group-hover:text-primary transition-colors">{provider.name}</h2>
          <span className="font-label-md text-label-md text-primary truncate">{provider.category}</span>
          <span className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant truncate">
            <Icon name="location_on" className="text-[16px]" />
            {provider.address ? `${provider.address}, ${provider.city}` : provider.city}
          </span>
        </div>
      </Link>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <span className={`flex items-center gap-1.5 font-label-sm text-label-sm ${status.open ? "text-primary" : "text-on-surface-variant"}`}>
            <span className={`w-2 h-2 rounded-full ${status.open ? "bg-emerald-500" : "bg-outline"}`} />
            {status.label}
          </span>
          <span className="font-label-md text-label-md text-on-surface truncate">
            {provider.minPrice !== undefined
              ? `${provider.cheapestService} dès ${formatPrice(provider.minPrice)}`
              : "Prestations bientôt en ligne"}
          </span>
        </div>
        <Link
          href={SERVICES_ROUTES.provider(provider.id)}
          className="shrink-0 inline-flex items-center justify-center h-11 px-6 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:bg-primary-container transition-all"
        >
          Voir
        </Link>
      </div>
    </article>
  );
}

/** Horaires de la semaine (lecture seule). */
export function WeekHours({ week }: { week: DayAvailability[] }) {
  return (
    <ul className="flex flex-col divide-y divide-surface-container">
      {week.map((d) => (
        <li key={d.weekday} className="flex items-center justify-between gap-space-md py-2 font-body-sm text-body-sm">
          <span className="font-label-md text-label-md text-on-surface w-24">{WEEKDAY_LABELS[d.weekday]}</span>
          <span className={d.enabled ? "text-on-surface" : "text-on-surface-variant"}>
            {d.enabled ? d.ranges.map((r) => `${r.start} – ${r.end}`).join(", ") : "Fermé"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export const primaryButton =
  "inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-md hover:bg-primary-container transition-all active:scale-[0.98] disabled:opacity-60";
export const secondaryButton =
  "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-surface-container-lowest text-on-surface font-label-md text-label-md shadow-sm hover:bg-surface-container-high transition-all";
