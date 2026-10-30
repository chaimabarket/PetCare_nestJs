"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { Dialog } from "@/components/adoption/Dialog";
import { FilterCountBadge, FiltersPanel } from "@/components/adoption/FiltersPanel";
import { useAsync, useFavorites } from "@/components/adoption/hooks";
import { ListingCard } from "@/components/adoption/ListingCard";
import { Breadcrumb, ButtonLink, Chip, EmptyState, PageLoading } from "@/components/adoption/ui";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import {
  activeFilterCount,
  ADOPTION_ROUTES,
  EMPTY_FILTERS,
  keysOf,
  listPublicListings,
  matchesFilters,
  PUBLISHER_ROLES,
  SPECIES,
  type ListingFilters,
} from "@/lib/adoption";

export default function AdoptionFeedPage() {
  const { profile } = useAuth();
  const { data: listings, error, loading } = useAsync(listPublicListings);
  const { isFavorite, toggle } = useFavorites();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const canPublish = !profile || PUBLISHER_ROLES.includes(profile.role);

  const cities = useMemo(
    () => [...new Set((listings ?? []).map((l) => l.city.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    [listings],
  );
  const results = useMemo(
    () => (listings ?? []).filter((l) => matchesFilters(l, filters, search)),
    [listings, filters, search],
  );
  const filterCount = activeFilterCount(filters);

  function toggleSpecies(species: (typeof filters.species)[number]) {
    setFilters((current) => ({
      ...current,
      species: current.species.includes(species)
        ? current.species.filter((s) => s !== species)
        : [...current.species, species],
    }));
  }

  return (
    <div className="relative w-full overflow-hidden">
      <div className="absolute -top-24 right-1/4 w-96 h-96 rounded-full bg-primary-fixed/20 blur-3xl pointer-events-none" />
      <div className="absolute top-48 -left-20 w-80 h-80 rounded-full bg-secondary-fixed/25 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-lg">
        <Breadcrumb items={[{ label: "Communauté", href: "/communaute" }, { label: "Adoption" }]} />

        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md mb-space-lg">
          <div className="max-w-3xl">
            {listings && (
              <span className="inline-flex items-center gap-space-xs px-space-md py-1 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm mb-space-xs">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {listings.length} compagnon{listings.length > 1 ? "s" : ""} en attente d&apos;un foyer
              </span>
            )}
            <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-on-surface tracking-tight">
              Adoption
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Trouvez votre futur compagnon parmi les animaux proposés par les refuges et les particuliers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm shrink-0">
            <ButtonLink href={ADOPTION_ROUTES.favorites} variant="secondary" icon="favorite">
              Mes favoris
            </ButtonLink>
            <ButtonLink href={ADOPTION_ROUTES.myApplications} variant="secondary" icon="assignment">
              Mes candidatures
            </ButtonLink>
            <ButtonLink href={ADOPTION_ROUTES.happyTails} variant="secondary" icon="auto_awesome">
              Happy Tails
            </ButtonLink>
            {canPublish && (
              <ButtonLink href={ADOPTION_ROUTES.publish} variant="coral" icon="add_circle" className="hidden md:inline-flex">
                Publier une annonce
              </ButtonLink>
            )}
          </div>
        </header>

        <section className="bg-surface-container-lowest rounded-2xl p-space-sm md:p-space-md shadow-sm mb-space-md flex items-center gap-space-sm" role="search">
          <label className="flex-1 flex items-center bg-surface-container-low rounded-xl px-space-md h-12">
            <Icon name="search" className="text-outline mr-space-sm" />
            <span className="sr-only">Rechercher</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, race, ville…"
              className="w-full bg-transparent outline-none font-body-md text-body-md text-on-surface placeholder:text-outline"
            />
          </label>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="lg:hidden inline-flex items-center gap-space-xs h-12 px-space-md rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-variant transition-colors"
          >
            <Icon name="tune" className="text-[18px]" />
            Filtres
            <FilterCountBadge filters={filters} />
          </button>
        </section>

        <div className="flex items-center gap-space-xs overflow-x-auto pb-space-xs mb-space-lg">
          <Chip selected={filters.species.length === 0} onClick={() => setFilters((f) => ({ ...f, species: [] }))}>
            🐾 Tous
          </Chip>
          {keysOf(SPECIES).map((s) => (
            <Chip key={s} selected={filters.species.includes(s)} onClick={() => toggleSpecies(s)}>
              {SPECIES[s].emoji} {SPECIES[s].label}
            </Chip>
          ))}
        </div>

        {/* Assistant IA : suggestions d'animaux selon le mode de vie (maquette Stitch W3). */}
        <Link
          href="/assistant?adoption=1"
          className="mb-space-lg flex items-center gap-space-md rounded-2xl bg-gradient-to-r from-primary-container to-primary-fixed/70 p-space-md md:p-space-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <span className="w-12 h-12 rounded-full bg-surface-container-lowest text-primary flex items-center justify-center shrink-0">
            <Icon name="pets" filled className="text-[26px]" />
          </span>
          <span className="flex-1">
            <span className="block font-headline-sm text-headline-sm text-on-primary">Pas sûr de quel animal adopter ?</span>
            <span className="block font-body-md text-body-md text-on-primary-container">
              Décrivez votre mode de vie, l&apos;assistant vous propose des animaux compatibles.
            </span>
          </span>
          <span className="hidden sm:inline-flex items-center h-10 px-space-md rounded-full bg-surface-container-lowest text-primary font-label-lg text-label-lg">
            Demander à l&apos;assistant
          </span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          <aside className="hidden lg:flex lg:col-span-3 flex-col gap-space-md bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm sticky top-20">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high">
              <h2 className="flex items-center gap-space-xs font-headline-sm text-headline-sm text-on-surface">
                <Icon name="tune" className="text-primary text-[20px]" />
                Filtres
                <FilterCountBadge filters={filters} />
              </h2>
              {filterCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="font-label-sm text-label-sm text-secondary hover:text-on-secondary-container"
                >
                  Réinitialiser
                </button>
              )}
            </div>
            <FiltersPanel filters={filters} onChange={setFilters} cities={cities} />
          </aside>

          <section className="lg:col-span-9 flex flex-col gap-space-md" aria-live="polite">
            {error && <Alert>{error}</Alert>}
            {loading ? (
              <PageLoading text="Chargement des annonces…" />
            ) : results.length === 0 ? (
              <EmptyState
                icon="pets"
                title={listings?.length ? "Aucun animal ne correspond" : "Aucune annonce pour l'instant"}
                text={
                  listings?.length
                    ? "Essayez d'élargir vos filtres ou votre recherche."
                    : "Revenez bientôt : de nouveaux compagnons cherchent régulièrement une famille."
                }
                action={
                  filterCount > 0 || search ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setFilters(EMPTY_FILTERS);
                        setSearch("");
                      }}
                    >
                      Réinitialiser les filtres
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <p className="font-label-md text-label-md text-on-surface-variant">
                  {results.length} {results.length > 1 ? "animaux" : "animal"}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-space-sm md:gap-space-md">
                  {results.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      favorite={isFavorite(listing.id)}
                      onToggleFavorite={() => toggle(listing.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {canPublish && (
        <Link
          href={ADOPTION_ROUTES.publish}
          className="md:hidden fixed right-4 bottom-24 z-40 inline-flex items-center gap-1 h-12 px-space-lg rounded-full bg-[#E07A5F] text-white font-label-lg text-label-lg shadow-lg"
        >
          <Icon name="add" className="text-[22px]" />
          Publier
        </Link>
      )}

      <Dialog open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filtres">
        <FiltersPanel filters={filters} onChange={setFilters} cities={cities} />
        <div className="sticky bottom-0 -mx-space-lg -mb-space-lg px-space-lg py-space-md bg-surface-container-lowest border-t border-surface-container flex items-center justify-between gap-space-sm">
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface"
          >
            Réinitialiser
          </button>
          <Button type="button" onClick={() => setSheetOpen(false)}>
            Voir {results.length} {results.length > 1 ? "animaux" : "animal"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
