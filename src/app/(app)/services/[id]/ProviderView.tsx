"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Breadcrumb,
  CATEGORY_TONES,
  ErrorState,
  LoadingState,
  ProviderStatusPill,
  useLoad,
  VerifiedBadge,
  WeekHours,
} from "@/components/services/ui";
import { Icon } from "@/components/ui/Icon";
import {
  CATEGORY_ICON_INFO,
  formatDuration,
  formatPrice,
  getProvider,
  hoursSummary,
  listCategories,
  openingStatus,
  SERVICES_ROUTES,
} from "@/lib/services";

/** Fiche d'un prestataire et de ses prestations (maquette profil_prestataire_toilettage_amine). */
export function ProviderView({ id }: { id: string }) {
  const { user } = useAuth();
  const load = useCallback(async () => {
    const [provider, categories] = await Promise.all([getProvider(id), listCategories()]);
    return { provider, icon: categories.find((c) => c.name === provider.category)?.icon ?? ("autre" as const) };
  }, [id]);
  const { data, error, loading, reload } = useLoad(load);

  if (loading && !data) return <LoadingState />;
  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto w-full px-margin md:px-margin-md lg:px-margin-lg py-space-xl flex flex-col gap-space-lg">
        <Breadcrumb items={[{ label: "Services", href: SERVICES_ROUTES.directory }, { label: "Prestataire" }]} />
        <ErrorState message={error ?? "Prestataire introuvable."} onRetry={reload} />
      </div>
    );
  }

  const { provider, icon } = data;
  const isOwner = user?.uid === provider.ownerId;
  const status = openingStatus(provider.availability);
  const hours = hoursSummary(provider.availability);
  const published = provider.services.filter((s) => s.status === "published");
  const bookHref = (serviceId: string) => (user ? SERVICES_ROUTES.book(provider.id, serviceId) : "/connexion");
  const tel = provider.phone.replace(/[^\d+]/g, "");

  return (
    <div className="max-w-7xl mx-auto w-full px-margin md:px-margin-md lg:px-margin-lg py-space-md lg:py-space-xl flex flex-col gap-space-lg pb-28 lg:pb-space-xl">
      <Breadcrumb
        items={[
          { label: "Services", href: SERVICES_ROUTES.directory },
          { label: provider.category, href: SERVICES_ROUTES.category(provider.category) },
          { label: provider.name },
        ]}
      />

      {provider.status !== "published" && (
        <div className="rounded-2xl bg-amber-50 text-amber-900 p-space-md flex flex-col sm:flex-row sm:items-center gap-space-md">
          <Icon name="visibility_off" className="text-[24px]" />
          <span className="flex-1">
            Ce profil n&apos;est pas visible dans l&apos;annuaire : <ProviderStatusPill status={provider.status} />
            {provider.rejectionReason && <span className="block mt-1">Motif : {provider.rejectionReason}</span>}
          </span>
          {isOwner && (
            <Link href={SERVICES_ROUTES.mySpace} className="h-10 px-space-md rounded-full bg-primary text-on-primary font-label-md text-label-md inline-flex items-center shrink-0">
              Mon espace
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-md items-start">
        <section className="lg:col-span-8 flex flex-col gap-space-lg">
          {/* En-tête : photo de couverture, icône de catégorie, identité */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
            <div className="relative h-56 md:h-72 bg-surface-container-high">
              {provider.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={provider.photo} alt={provider.name} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${CATEGORY_TONES[icon]}`}>
                  <Icon name={CATEGORY_ICON_INFO[icon].symbol} className="text-[96px] opacity-60" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
            </div>
            <div className="relative px-space-lg pb-space-lg">
              <div className="flex items-end justify-between gap-space-md -mt-10">
                <span className="w-20 h-20 rounded-full bg-primary text-on-primary flex items-center justify-center ring-4 ring-surface-container-lowest shadow-md">
                  <Icon name={CATEGORY_ICON_INFO[icon].symbol} className="text-[36px]" />
                </span>
                {provider.status === "published" && <VerifiedBadge label="Prestataire vérifié" />}
              </div>
              <h1 className="mt-space-sm font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface tracking-tight">{provider.name}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body-md text-body-md text-on-surface-variant">
                <span className="text-primary font-label-lg text-label-lg">{provider.category}</span>
                <span className="flex items-center gap-1">
                  <Icon name="location_on" className="text-[18px]" />
                  {provider.city}
                </span>
              </div>
              {provider.description && (
                <p className="mt-space-md font-body-md text-body-md text-on-surface whitespace-pre-line">{provider.description}</p>
              )}
            </div>
          </div>

          {/* Prestations & tarifs */}
          <section className="flex flex-col gap-space-md">
            <div className="flex items-center gap-3">
              <h2 className="font-headline-md text-headline-md text-on-surface">Prestations &amp; tarifs</h2>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-label-md text-label-md">
                {published.length} service{published.length > 1 ? "s" : ""}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Choisissez une prestation pour demander un rendez-vous. Le règlement se fait directement sur place.
            </p>
            {published.length === 0 && (
              <p className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm text-on-surface-variant">
                Aucune prestation en ligne pour le moment.
              </p>
            )}
            {published.map((s) => (
              <article key={s.id} className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-sm">
                <div className="flex items-start justify-between gap-space-md">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">{s.name}</h3>
                  <span className="font-headline-sm text-headline-sm text-primary font-bold shrink-0">{formatPrice(s.price)}</span>
                </div>
                {s.description && <p className="font-body-sm text-body-sm text-on-surface-variant">{s.description}</p>}
                <div className="flex items-center justify-between gap-space-md">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container font-label-md text-label-md text-on-surface-variant">
                    <Icon name="schedule" className="text-[16px]" />
                    {formatDuration(s.durationMinutes)}
                  </span>
                  {isOwner ? (
                    <Link href={SERVICES_ROUTES.mySpace} className="h-10 px-5 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md inline-flex items-center">
                      Modifier
                    </Link>
                  ) : (
                    provider.status === "published" && (
                      <Link href={bookHref(s.id)} className="h-10 px-5 rounded-xl bg-primary text-on-primary font-label-md text-label-md inline-flex items-center hover:bg-primary-container shadow-sm">
                        Réserver
                      </Link>
                    )
                  )}
                </div>
              </article>
            ))}
          </section>
        </section>

        {/* Horaires, adresse, contact */}
        <aside className="lg:col-span-4 flex flex-col gap-space-lg lg:sticky lg:top-24">
          <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
            <div className="flex items-start gap-space-md">
              <span className="w-10 h-10 rounded-xl bg-surface-container text-on-surface-variant flex items-center justify-center shrink-0">
                <Icon name="schedule" className="text-[22px]" />
              </span>
              <div>
                <span className={`flex items-center gap-1.5 font-label-md text-label-md ${status.open ? "text-primary" : "text-on-surface-variant"}`}>
                  <span className={`w-2 h-2 rounded-full ${status.open ? "bg-emerald-500" : "bg-outline"}`} />
                  {status.label}
                </span>
                <p className="font-label-lg text-label-lg text-on-surface">{hours.open}</p>
                {hours.closed && <p className="font-body-sm text-body-sm text-on-surface-variant">{hours.closed}</p>}
              </div>
            </div>
            {(provider.address || provider.city) && (
              <div className="flex items-start gap-space-md">
                <span className="w-10 h-10 rounded-xl bg-surface-container text-on-surface-variant flex items-center justify-center shrink-0">
                  <Icon name="storefront" className="text-[22px]" />
                </span>
                <div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Adresse</span>
                  <p className="font-label-lg text-label-lg text-on-surface">{[provider.address, provider.city].filter(Boolean).join(", ")}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-space-sm">
              <a href={`tel:${tel}`} className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg inline-flex items-center justify-center gap-2 hover:bg-primary-container">
                <Icon name="call" className="text-[20px]" />
                Appeler
              </a>
              <a href={`mailto:${provider.email}`} className="h-12 rounded-xl bg-primary-fixed/50 text-on-primary-fixed-variant font-label-lg text-label-lg inline-flex items-center justify-center gap-2 hover:bg-primary-fixed">
                <Icon name="mail" className="text-[20px]" />
                Message
              </a>
            </div>
            <p className="rounded-xl bg-surface-container-low p-space-sm font-body-sm text-body-sm text-on-surface-variant flex items-start gap-2">
              <Icon name="payments" className="text-[18px] text-secondary shrink-0" />
              Paiement sur place. Aucun paiement en ligne ; les tarifs sont indicatifs.
            </p>
          </div>
          <details className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm group">
            <summary className="font-label-lg text-label-lg text-on-surface cursor-pointer flex items-center justify-between">
              Horaires de la semaine
              <Icon name="expand_more" className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-space-sm">
              <WeekHours week={provider.availability} />
            </div>
          </details>
        </aside>
      </div>

      {/* Barre de contact fixe sur mobile (maquette) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-container-lowest/95 backdrop-blur border-t border-surface-container px-margin py-3 flex items-center justify-between gap-3">
        <span className="font-body-sm text-body-sm text-on-surface min-w-0 truncate">Une question ? {provider.name} vous répond.</span>
        <span className="flex gap-2 shrink-0">
          <a href={`tel:${tel}`} aria-label="Appeler" className="w-11 h-11 rounded-xl bg-surface-container text-primary flex items-center justify-center">
            <Icon name="call" className="text-[20px]" />
          </a>
          <a href={`mailto:${provider.email}`} className="h-11 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md inline-flex items-center gap-1.5">
            <Icon name="mail" className="text-[18px]" />
            Contacter
          </a>
        </span>
      </div>
    </div>
  );
}
