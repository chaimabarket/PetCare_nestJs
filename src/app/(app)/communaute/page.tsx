"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAsync, useFavorites } from "@/components/adoption/hooks";
import { ListingCard } from "@/components/adoption/ListingCard";
import { ButtonLink, Chip, EmptyState, PageLoading, Photo } from "@/components/adoption/ui";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import {
  ADOPTION_ROUTES,
  byNewest,
  countAdoptions,
  formatDate,
  listHappyTails,
  listPublicListings,
  matchesFilters,
  EMPTY_FILTERS,
  PUBLISHER_ROLES,
  type AdoptionListing,
  type HappyTail,
  type Species,
} from "@/lib/adoption";

// Hub Communauté (maquette designs/stitch/communaut_petcare_community) : porte d'entrée vers l'adoption,
// les Happy Tails et, plus tard, les Perdus & Trouvés. Toutes les données viennent des routes /api/adoption.

const PAGE_SIZE = 6;

type Tab = "all" | "listings" | "tails";
type RecentItem =
  | { kind: "listing"; date?: string; listing: AdoptionListing }
  | { kind: "tail"; date?: string; tail: HappyTail };

async function loadHub() {
  const [listings, tails, adopted] = await Promise.all([
    listPublicListings(),
    listHappyTails(),
    countAdoptions().catch(() => null),
  ]);
  return { listings, tails, adopted };
}

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export default function CommunityHubPage() {
  const { profile } = useAuth();
  const { data, error, loading } = useAsync(loadHub);
  const { isFavorite, toggle } = useFavorites();
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [species, setSpecies] = useState<Species | "">("");
  const [tab, setTab] = useState<Tab>("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  const canPublish = !profile || PUBLISHER_ROLES.includes(profile.role);

  const listings = useMemo(() => data?.listings ?? [], [data]);
  const tails = useMemo(() => data?.tails ?? [], [data]);
  const available = listings.filter((l) => l.status === "disponible").length;
  const cities = useMemo(
    () => [...new Set(listings.map((l) => l.city.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    [listings],
  );

  // Recherche, ville et espèce s'appliquent aux annonces comme aux histoires.
  const { recentListings, recentTails } = useMemo(() => {
    const filters = { ...EMPTY_FILTERS, city, species: species ? [species] : [] };
    const term = normalize(search);
    return {
      recentListings: listings.filter((l) => matchesFilters(l, filters, search)),
      recentTails: city
        ? []
        : tails.filter(
            (t) =>
              (!species || t.species === species) &&
              (!term || normalize([t.animalName, t.adopterName, t.ownerName].join(" ")).includes(term)),
          ),
    };
  }, [listings, tails, search, city, species]);

  const items: RecentItem[] = [
    ...(tab === "tails" ? [] : recentListings.map((listing) => ({ kind: "listing" as const, date: listing.publishedAt ?? listing.createdAt, listing }))),
    ...(tab === "listings" ? [] : recentTails.map((tail) => ({ kind: "tail" as const, date: tail.createdAt, tail }))),
  ].sort((a, b) => byNewest({ createdAt: a.date }, { createdAt: b.date }));
  const total = recentListings.length + recentTails.length;

  function changeFilter(update: () => void) {
    update();
    setShown(PAGE_SIZE);
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-margin md:px-margin-md lg:px-margin-lg py-space-xl flex flex-col gap-space-2xl">
      {/* En-tête */}
      <header className="flex flex-col gap-space-lg">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
          <div className="flex flex-col gap-space-xs max-w-2xl">
            <div className="inline-flex items-center gap-space-xs text-primary font-label-md text-label-md tracking-wider uppercase">
              <Icon name="volunteer_activism" className="text-[16px]" />
              <span>Réseau d&apos;entraide animale</span>
            </div>
            <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-on-surface tracking-tight">
              Hub Communautaire
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Rejoignez un réseau solidaire de passionnés, familles d&apos;accueil et refuges engagés pour le bien-être animal.
            </p>
          </div>
          {canPublish && (
            <ButtonLink href={ADOPTION_ROUTES.publish} icon="add_circle" className="shrink-0">
              Publier une annonce
            </ButtonLink>
          )}
        </div>

        <div
          role="search"
          className="bg-surface-container-lowest rounded-2xl p-space-sm md:p-space-md shadow-sm flex flex-col md:flex-row items-center gap-space-sm"
        >
          <label className="relative flex-1 w-full">
            <span className="sr-only">Rechercher</span>
            <Icon name="search" className="absolute left-space-md top-1/2 -translate-y-1/2 text-outline text-[20px]" />
            <input
              type="search"
              value={search}
              onChange={(e) => changeFilter(() => setSearch(e.target.value))}
              placeholder="Rechercher un animal, une race, une ville…"
              className="w-full h-11 pl-11 pr-space-md rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest transition-colors"
            />
          </label>
          <label className="relative w-full md:w-64">
            <span className="sr-only">Ville</span>
            <Icon name="location_on" className="absolute left-space-md top-1/2 -translate-y-1/2 text-primary text-[20px]" />
            <select
              value={city}
              onChange={(e) => changeFilter(() => setCity(e.target.value))}
              className="w-full h-11 pl-11 pr-space-lg rounded-xl bg-surface-container-low text-on-surface font-label-md text-label-md appearance-none cursor-pointer focus:outline-none"
            >
              <option value="">Toutes les villes</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Icon name="expand_more" className="absolute right-space-md top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]" />
          </label>
          <div className="flex items-center gap-space-xs w-full md:w-auto overflow-x-auto">
            <Link
              href={ADOPTION_ROUTES.feed}
              className="h-11 px-space-md rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md whitespace-nowrap flex items-center gap-space-xs"
            >
              <Icon name="tune" className="text-[18px]" />
              Filtres
            </Link>
            {(["chien", "chat"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={species === s}
                onClick={() => changeFilter(() => setSpecies(species === s ? "" : s))}
                className={`h-11 px-space-md rounded-xl font-label-md text-label-md whitespace-nowrap transition-colors ${
                  species === s ? "bg-primary text-on-primary" : "bg-surface-container-low hover:bg-surface-container text-on-surface"
                }`}
              >
                {s === "chien" ? "Chiens" : "Chats"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Les trois espaces de la communauté */}
      <section aria-labelledby="hub-pillars-title">
        <h2 className="sr-only" id="hub-pillars-title">
          Espaces de la communauté
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-md">
          <PillarCard
            badge={{ icon: "favorite", label: "Adoption responsable", className: "bg-secondary-container/40 text-secondary" }}
            count={data ? `${available} disponible${available > 1 ? "s" : ""}` : undefined}
            countClassName="text-secondary"
            photo={listings[0]?.thumbnail || listings[0]?.photos[0]}
            photoCaption="Refuges & particuliers"
            title="Adoption"
            subtitle="Trouvez votre futur compagnon"
            subtitleClassName="text-secondary"
            text="Chiens, chats et nouveaux compagnons en quête d'un foyer aimant, proposés par les refuges et les particuliers."
            action={{ href: ADOPTION_ROUTES.feed, label: "Découvrir les adoptions", className: "bg-secondary-container/30 hover:bg-secondary-container/60 text-secondary" }}
          />
          <PillarCard
            badge={{ icon: "campaign", label: "Vigilance directe", className: "bg-error-container/60 text-error" }}
            count="Bientôt disponible"
            countClassName="text-on-surface-variant"
            icon="travel_explore"
            photoCaption="Alertes de quartier"
            title="Perdus & Trouvés"
            subtitle="Aidez un animal à rentrer chez lui"
            subtitleClassName="text-primary"
            text="Signalez un animal disparu ou repéré dans votre quartier. La communauté se mobilise pour le retrouver."
            action={{ label: "Bientôt disponible", className: "bg-surface-container text-on-surface-variant" }}
          />
          <PillarCard
            badge={{ icon: "auto_awesome", label: "Témoignages & bonheur", className: "bg-primary-fixed/50 text-primary" }}
            count={
              data?.adopted != null ? `${data.adopted} adoption${data.adopted > 1 ? "s" : ""} réussie${data.adopted > 1 ? "s" : ""}` : undefined
            }
            countClassName="text-primary"
            photo={tails[0]?.afterPhoto}
            photoCaption="Nouvelles de nos protégés"
            title="Happy Tails"
            subtitle="Les belles histoires d'adoption"
            subtitleClassName="text-primary"
            text="Découvrez les nouvelles et photos réconfortantes des compagnons épanouis dans leur nouvelle famille."
            action={{ href: ADOPTION_ROUTES.happyTails, label: "Lire les histoires heureuses", className: "bg-primary-fixed/30 hover:bg-primary-fixed/60 text-primary" }}
          />
        </div>
      </section>

      {/* Activité récente */}
      <section aria-labelledby="recent-title" className="flex flex-col gap-space-lg">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
          <div>
            <h2 id="recent-title" className="font-headline-lg text-headline-lg text-on-surface">
              Récemment dans la communauté
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Les dernières annonces d&apos;adoption et histoires partagées par les membres.
            </p>
          </div>
          <div className="flex items-center gap-space-xs overflow-x-auto" role="tablist" aria-label="Type de publication">
            {(
              [
                ["all", `Tout afficher (${total})`],
                ["listings", `Adoptions (${recentListings.length})`],
                ["tails", `Happy Tails (${recentTails.length})`],
              ] as const
            ).map(([value, label]) => (
              <Chip key={value} selected={tab === value} onClick={() => changeFilter(() => setTab(value))}>
                {label}
              </Chip>
            ))}
          </div>
        </div>

        {error && <Alert>{error}</Alert>}
        {loading ? (
          <PageLoading />
        ) : items.length === 0 ? (
          <EmptyState
            icon="search_off"
            title="Aucune publication ne correspond"
            text="Modifiez la recherche ou les filtres pour voir plus de publications."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter-md" aria-live="polite">
            {items.slice(0, shown).map((item) =>
              item.kind === "listing" ? (
                <ListingCard
                  key={`l-${item.listing.id}`}
                  listing={item.listing}
                  favorite={isFavorite(item.listing.id)}
                  onToggleFavorite={() => toggle(item.listing.id)}
                />
              ) : (
                <HappyTailTile key={`t-${item.tail.id}`} tail={item.tail} />
              ),
            )}
          </div>
        )}

        {items.length > shown && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE_SIZE)}
              className="inline-flex items-center gap-space-xs h-11 px-space-lg rounded-full bg-surface-container-lowest shadow-sm hover:shadow-md text-on-surface font-label-lg text-label-lg transition-all"
            >
              Voir plus de publications ({items.length - shown})
              <Icon name="expand_more" className="text-[18px]" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function PillarCard({
  badge,
  count,
  countClassName,
  photo,
  icon,
  photoCaption,
  title,
  subtitle,
  subtitleClassName,
  text,
  action,
}: {
  badge: { icon: string; label: string; className: string };
  count?: string;
  countClassName: string;
  photo?: string;
  icon?: string;
  photoCaption: string;
  title: string;
  subtitle: string;
  subtitleClassName: string;
  text: string;
  action: { href?: string; label: string; className: string };
}) {
  const actionClass = `inline-flex items-center justify-between w-full h-11 px-space-md rounded-xl font-label-lg text-label-lg transition-colors ${action.className}`;
  let button: ReactNode;
  if (action.href) {
    button = (
      <Link href={action.href} className={actionClass}>
        <span>{action.label}</span>
        <Icon name="arrow_forward" className="text-[18px] group-hover:translate-x-1 transition-transform" />
      </Link>
    );
  } else {
    button = (
      <span aria-disabled="true" className={`${actionClass} cursor-not-allowed`}>
        <span>{action.label}</span>
        <Icon name="schedule" className="text-[18px]" />
      </span>
    );
  }

  return (
    <article className="group relative rounded-2xl bg-surface-container-lowest p-space-lg shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden">
      <div className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between gap-space-sm">
          <span className={`inline-flex items-center gap-space-xs px-space-sm py-space-xs rounded-full font-label-sm text-label-sm ${badge.className}`}>
            <Icon name={badge.icon} className="text-[14px]" />
            <span>{badge.label}</span>
          </span>
          {count && <span className={`font-label-sm text-label-sm font-semibold ${countClassName}`}>{count}</span>}
        </div>
        <div className="relative w-full h-44 rounded-xl overflow-hidden bg-surface-container-low">
          {photo ? (
            <Photo src={photo} alt="" className="w-full h-full group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-container to-primary-fixed/40">
              <Icon name={icon ?? "pets"} className="text-[56px] text-primary/60" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/60 via-transparent to-transparent" />
          <p className="absolute bottom-space-sm left-space-sm text-surface-container-lowest font-label-lg text-label-lg drop-shadow">
            {photoCaption}
          </p>
        </div>
        <div className="flex flex-col gap-space-xs">
          <h3 className="font-headline-md text-headline-md text-on-surface">{title}</h3>
          <p className={`font-label-md text-label-md ${subtitleClassName}`}>{subtitle}</p>
          <p className="font-body-md text-body-md text-on-surface-variant">{text}</p>
        </div>
      </div>
      <div className="pt-space-md mt-space-sm">{button}</div>
    </article>
  );
}

/** Histoire d'adoption dans la grille « Récemment » (l'histoire complète est sur la page Happy Tails). */
function HappyTailTile({ tail }: { tail: HappyTail }) {
  const likes = tail.likedBy.length;
  return (
    <article className="group bg-surface-container-lowest rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
      <Link href={ADOPTION_ROUTES.happyTails} className="flex flex-col flex-1">
        <div className="relative aspect-[4/5] overflow-hidden">
          <Photo src={tail.afterPhoto} alt={tail.animalName} className="w-full h-full group-hover:scale-[1.03] transition-transform duration-300" />
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm shadow-sm">
            <Icon name="favorite" filled className="text-[14px]" />
            Adopté !
          </span>
        </div>
        <div className="p-space-md flex flex-col gap-space-xs flex-1">
          <div className="flex items-baseline justify-between gap-space-sm">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">{tail.animalName} a trouvé sa famille</h3>
            <span className="shrink-0 font-label-sm text-label-sm text-secondary">{formatDate(tail.createdAt)}</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Adopté par {tail.adopterName}</p>
          <p className="font-body-sm text-body-sm italic text-on-surface-variant bg-surface-container-low rounded-lg px-space-sm py-space-xs line-clamp-3">
            « {tail.story} »
          </p>
          <p className="mt-auto pt-space-xs flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            <Icon name="volunteer_activism" className="text-[16px]" />
            Confié par {tail.ownerName}
          </p>
          <div className="flex items-center justify-between pt-space-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {likes} félicitation{likes > 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1 h-9 px-space-md rounded-full bg-secondary-container/40 text-secondary font-label-md text-label-md">
              Lire l&apos;histoire
              <Icon name="arrow_forward" className="text-[16px]" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
