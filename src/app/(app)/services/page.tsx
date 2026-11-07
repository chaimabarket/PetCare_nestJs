"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Breadcrumb,
  CATEGORY_TONES,
  categoryIcon,
  ErrorState,
  LoadingState,
  pageClass,
  ProviderCard,
  useLoad,
} from "@/components/services/ui";
import { Icon } from "@/components/ui/Icon";
import {
  CATEGORY_ICON_INFO,
  listCategories,
  listProviders,
  normalizeText,
  SERVICES_ROUTES,
  type ProviderSummary,
  type ServiceCategory,
} from "@/lib/services";

type Sort = "recent" | "name" | "price";

/** Annuaire des services (maquette services_petcare_community). `?categorie=Vétérinaires` ouvre une catégorie. */
export default function ServicesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Directory />
    </Suspense>
  );
}

function Directory() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useAuth();
  const category = params.get("categorie") ?? "";

  const load = useCallback(async () => {
    const [categories, providers] = await Promise.all([listCategories(), listProviders()]);
    return { categories, providers };
  }, []);
  const { data, error, loading, reload } = useLoad<{ categories: ServiceCategory[]; providers: ProviderSummary[] }>(load);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  const setCategory = (name: string) => {
    const next = new URLSearchParams(params);
    if (name && name !== category) next.set("categorie", name);
    else next.delete("categorie");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const cities = useMemo(
    () => [...new Set((data?.providers ?? []).map((p) => p.city.trim()))].sort((a, b) => a.localeCompare(b, "fr")),
    [data],
  );

  const visible = useMemo(() => {
    const term = normalizeText(search);
    return (data?.providers ?? [])
      .filter((p) => !category || p.category === category)
      .filter((p) => !city || normalizeText(p.city) === normalizeText(city))
      .filter((p) => !term || normalizeText(`${p.name} ${p.category} ${p.city} ${p.description} ${p.cheapestService ?? ""}`).includes(term))
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name, "fr")
          : sort === "price"
            ? (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity)
            : b.updatedAt.localeCompare(a.updatedAt),
      );
  }, [data, category, city, search, sort]);

  const countFor = (name: string) => data?.providers.filter((p) => p.category === name).length ?? 0;

  return (
    <div className="relative w-full overflow-hidden">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[280px] bg-gradient-to-b from-primary-fixed/30 to-transparent blur-3xl pointer-events-none rounded-full" />
      <div className={`${pageClass} relative flex flex-col gap-8`}>
        <Breadcrumb items={[{ label: "Services" }]} />

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col gap-2 max-w-2xl">
            <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">PetCare Services</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Vétérinaires, toiletteurs, promeneurs, pensions… trouvez un professionnel près de chez vous et réservez en ligne.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            {profile?.role === "prestataire" && (
              <Link href={SERVICES_ROUTES.mySpace} className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-md hover:bg-primary-container">
                <Icon name="storefront" className="text-[20px]" />
                Mon espace prestataire
              </Link>
            )}
            {profile?.role === "admin" && (
              <Link href={SERVICES_ROUTES.admin} className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-md hover:bg-primary-container">
                <Icon name="admin_panel_settings" className="text-[20px]" />
                Administration
              </Link>
            )}
            {profile && (
              <Link href={SERVICES_ROUTES.myBookings} className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-surface-container-lowest text-on-surface font-label-md text-label-md shadow-sm hover:bg-surface-container-high">
                <Icon name="event_note" className="text-[20px] text-on-surface-variant" />
                Mes réservations
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="relative max-w-2xl">
            <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[22px]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Rechercher un service ou un praticien"
              placeholder="Rechercher un service, un praticien…"
              className="w-full h-12 pl-12 pr-4 bg-surface-container-lowest rounded-xl shadow-sm font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {cities.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="Ville">
              {["", ...cities].map((c) => (
                <button
                  key={c || "all"}
                  type="button"
                  aria-pressed={city === c}
                  onClick={() => setCity(c)}
                  className={`shrink-0 inline-flex items-center gap-1.5 h-10 px-4 rounded-full font-label-md text-label-md transition-colors ${
                    city === c ? "bg-primary text-on-primary shadow-sm" : "bg-surface-container-lowest text-on-surface hover:bg-surface-container-high shadow-sm"
                  }`}
                >
                  {city === c && <Icon name="location_on" className="text-[16px]" />}
                  {c || "Toutes les villes"}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <ErrorState message={error} onRetry={reload} />}
        {loading && !data && <LoadingState />}

        {data && (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-3" role="group" aria-label="Catégories">
              {data.categories.map((c) => {
                const selected = category === c.name;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setCategory(c.name)}
                    className={`bg-surface-container-lowest rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-2 ${
                      selected ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <span className={`w-14 h-14 rounded-2xl flex items-center justify-center ${CATEGORY_TONES[c.icon]}`}>
                      <Icon name={CATEGORY_ICON_INFO[c.icon].symbol} className="text-[28px]" />
                    </span>
                    <span className={`font-label-md text-label-md text-center ${selected ? "text-primary font-semibold" : "text-on-surface"}`}>{c.name}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{countFor(c.name)} pro{countFor(c.name) > 1 ? "s" : ""}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="font-headline-md text-headline-md text-on-surface">{category || "Prestataires recommandés"}</h2>
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-label-md text-label-md">
                  {visible.length} pro{visible.length > 1 ? "s" : ""}
                </span>
                {category && (
                  <button type="button" onClick={() => setCategory("")} className="font-label-md text-label-md text-primary hover:underline">
                    Toutes les catégories
                  </button>
                )}
              </div>
              <div className="relative">
                <select
                  aria-label="Trier par"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="h-10 pl-3 pr-8 bg-surface-container-lowest shadow-sm rounded-xl font-label-md text-label-md text-on-surface-variant appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="recent">Trier par : Récents</option>
                  <option value="name">Trier par : Nom (A-Z)</option>
                  <option value="price">Trier par : Prix croissant</option>
                </select>
                <Icon name="expand_more" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none" />
              </div>
            </div>

            {visible.length ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {visible.map((p) => (
                  <ProviderCard key={p.id} provider={p} icon={categoryIcon(data.categories, p.category)} />
                ))}
              </div>
            ) : (
              <div className="bg-surface-container-lowest rounded-2xl p-10 shadow-sm flex flex-col items-center text-center gap-3">
                <span className="w-16 h-16 rounded-2xl bg-primary-fixed/40 text-primary flex items-center justify-center">
                  <Icon name="search_off" className="text-[32px]" />
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Aucun prestataire trouvé</h3>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
                  {data.providers.length
                    ? "Essayez une autre catégorie, une autre ville ou un autre mot-clé."
                    : "Les premiers professionnels sont en cours de validation. Revenez bientôt !"}
                </p>
              </div>
            )}

            {!profile && (
              <section className="rounded-2xl bg-primary text-on-primary p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Icon name="storefront" className="text-[26px]" />
                  <div>
                    <h3 className="font-headline-sm text-headline-sm">Vous êtes un professionnel ?</h3>
                    <p className="font-body-sm text-body-sm text-on-primary-container">
                      Créez un compte prestataire pour apparaître dans l&apos;annuaire et recevoir des réservations.
                    </p>
                  </div>
                </div>
                <Link href="/inscription" className="shrink-0 inline-flex items-center h-11 px-5 rounded-xl bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md hover:opacity-90">
                  Créer un compte prestataire
                </Link>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
