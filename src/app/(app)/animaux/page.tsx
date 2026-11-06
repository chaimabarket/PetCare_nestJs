"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PetCard } from "@/components/pets/PetCard";
import { Breadcrumb, ErrorState, LoadingState, pageClass, useLoad } from "@/components/pets/ui";
import { Icon } from "@/components/ui/Icon";
import { listPets, localDay, PET_ROUTES, SPECIES_INFO, speciesLine, type Pet, type PetSpecies } from "@/lib/pets";

type Tab = "active" | "archived";
type Sort = "recent" | "name";
type SpeciesFilter = "all" | "dog" | "cat" | "other";

const SPECIES_FILTERS: { key: SpeciesFilter; label: string; icon: string }[] = [
  { key: "all", label: "Tous", icon: "" },
  { key: "dog", label: "Chiens", icon: "sound_detection_dog_barking" },
  { key: "cat", label: "Chats", icon: "pets" },
  { key: "other", label: "NAC & autres", icon: "cruelty_free" },
];

const matchesSpecies = (species: PetSpecies, filter: SpeciesFilter) =>
  filter === "all" || (filter === "other" ? species !== "dog" && species !== "cat" : species === filter);

/** Recherche sans accents ni majuscules. */
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const addButton =
  "inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-md hover:bg-primary-container transition-all active:scale-[0.98]";

export default function MyPetsPage() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) return <LoadingState />;
  if (!user) return <VisitorInvitation />;
  return <PetList uid={user.uid} />;
}

function PetList({ uid }: { uid: string }) {
  // `uid` en dépendance : la liste est rechargée si l'utilisateur change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => listPets(), [uid]);
  const { data: pets, error, loading, reload } = useLoad<Pet[]>(load);
  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [species, setSpecies] = useState<SpeciesFilter>("all");
  const today = localDay();

  const counts = useMemo(
    () => ({
      active: pets?.filter((p) => p.status !== "archived").length ?? 0,
      archived: pets?.filter((p) => p.status === "archived").length ?? 0,
    }),
    [pets],
  );

  const visible = useMemo(() => {
    const term = normalize(search);
    return (pets ?? [])
      .filter((p) => (tab === "archived" ? p.status === "archived" : p.status !== "archived"))
      .filter((p) => matchesSpecies(p.species, species))
      .filter((p) => !term || normalize(`${p.name} ${p.breed} ${speciesLine(p)} ${SPECIES_INFO[p.species].label}`).includes(term))
      .sort((a, b) =>
        sort === "name" ? a.name.localeCompare(b.name, "fr") : b.createdAt.localeCompare(a.createdAt),
      );
  }, [pets, tab, search, sort, species]);

  return (
    <div className="relative w-full overflow-hidden">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[280px] bg-gradient-to-b from-primary-fixed/30 to-transparent blur-3xl pointer-events-none rounded-full" />
      <div className={`${pageClass} relative flex flex-col gap-8`}>
        <Breadcrumb items={[{ label: "Mes animaux" }]} />

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
          <div className="flex flex-col gap-2 max-w-2xl">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">Mes animaux</h1>
              {pets && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-label-md text-label-md">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {counts.active} compagnon{counts.active > 1 ? "s" : ""} enregistré{counts.active > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Gérez le suivi vétérinaire, les rendez-vous et le carnet de santé de vos compagnons au quotidien.
            </p>
          </div>
          <Link href={PET_ROUTES.add} className={`${addButton} self-start md:self-auto shrink-0`}>
            <Icon name="add" className="text-[20px]" />
            <span>Ajouter un animal</span>
          </Link>
        </div>

        {error && <ErrorState message={error} onRetry={reload} />}
        {loading && !pets && <LoadingState />}

        {pets && pets.length === 0 && <EmptyList />}

        {pets && pets.length > 0 && (
          <>
            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Rechercher un animal"
                  placeholder="Rechercher par nom, race, espèce…"
                  className="w-full h-11 pl-11 pr-4 bg-surface-container-low rounded-xl font-body-md text-body-md text-on-surface placeholder:text-outline-variant focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div role="tablist" aria-label="Statut" className="inline-flex p-1 bg-surface-container-low rounded-xl">
                  {(["active", "archived"] as Tab[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={tab === key}
                      onClick={() => setTab(key)}
                      className={`px-4 py-1.5 rounded-lg font-label-md text-label-md transition-all ${
                        tab === key ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      {key === "active" ? `Actifs (${counts.active})` : `Archivés (${counts.archived})`}
                    </button>
                  ))}
                </div>
                <div className="hidden sm:block w-px h-6 bg-surface-container-high" />
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {SPECIES_FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={species === f.key}
                      onClick={() => setSpecies(f.key)}
                      className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm flex items-center gap-1 transition-colors whitespace-nowrap ${
                        species === f.key ? "bg-primary/10 text-primary font-semibold" : "text-on-surface-variant hover:bg-surface-container-low"
                      }`}
                    >
                      {f.icon && <Icon name={f.icon} className="text-[14px]" />}
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="relative ml-auto lg:ml-0">
                  <select
                    aria-label="Trier par"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as Sort)}
                    className="h-10 pl-3 pr-8 bg-surface-container-low rounded-xl font-label-md text-label-md text-on-surface-variant appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="recent">Trier par : Récents</option>
                    <option value="name">Trier par : Nom (A-Z)</option>
                  </select>
                  <Icon name="expand_more" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none" />
                </div>
              </div>
            </div>

            {visible.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visible.map((pet) => (
                  <PetCard key={pet.id} pet={pet} today={today} />
                ))}
              </div>
            ) : (
              <p className="bg-surface-container-lowest rounded-2xl p-space-xl text-center text-on-surface-variant shadow-sm">
                {tab === "archived" && !counts.archived
                  ? "Aucun animal archivé. Un animal archivé garde tout son historique et peut être restauré."
                  : "Aucun animal ne correspond à votre recherche."}
              </p>
            )}
          </>
        )}
      </div>

      {pets && pets.length > 0 && (
        <Link
          href={PET_ROUTES.add}
          aria-label="Ajouter un animal"
          className="md:hidden fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 h-13 px-6 rounded-full bg-primary text-on-primary font-label-lg text-label-lg shadow-xl hover:bg-primary-container active:scale-95 transition-all"
        >
          <Icon name="add" className="text-[24px]" />
          <span>Ajouter</span>
        </Link>
      )}
    </div>
  );
}

function PawIllustration() {
  return (
    <div className="w-20 h-20 rounded-2xl bg-surface-container-lowest flex items-center justify-center shadow-sm mb-4 text-primary">
      <svg className="w-12 h-12" fill="none" viewBox="0 0 48 48" aria-hidden>
        <path
          d="M12 28C12 23.5817 15.5817 20 20 20H28C32.4183 20 36 23.5817 36 28V30C36 34.4183 32.4183 38 28 38H20C15.5817 38 12 34.4183 12 30V28Z"
          fill="currentColor"
          fillOpacity="0.15"
        />
        <circle cx="16" cy="14" fill="currentColor" r="4" />
        <circle cx="24" cy="11" fill="currentColor" r="4.5" />
        <circle cx="32" cy="14" fill="currentColor" r="4" />
        <path
          d="M20 25C17.7909 25 16 26.7909 16 29C16 32 20 35 24 35C28 35 32 32 32 29C32 26.7909 30.2091 25 28 25C25.5 25 24.8 27 24 27C23.2 27 22.5 25 20 25Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

/** État vide (maquette « Premier accueil »). */
function EmptyList() {
  return (
    <section className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm">
      <div className="bg-surface-container-low/70 rounded-2xl p-8 md:p-12 flex flex-col items-center text-center max-w-2xl mx-auto w-full">
        <PawIllustration />
        <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Aucun compagnon enregistré pour l&apos;instant</h2>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-md mb-6">
          Ajoutez votre premier animal pour suivre son poids, ses contacts utiles et, bientôt, son carnet de santé et ses
          rendez-vous.
        </p>
        <Link href={PET_ROUTES.add} className={addButton}>
          <Icon name="add" className="text-[20px]" />
          <span>Ajouter mon premier compagnon</span>
        </Link>
      </div>
    </section>
  );
}

/** Visiteur : invitation à se connecter. */
function VisitorInvitation() {
  return (
    <div className={`${pageClass} flex flex-col gap-8`}>
      <Breadcrumb items={[{ label: "Mes animaux" }]} />
      <section className="bg-surface-container-lowest rounded-2xl p-8 md:p-12 shadow-sm flex flex-col items-center text-center max-w-2xl mx-auto w-full">
        <PawIllustration />
        <h1 className="font-headline-md text-headline-md text-on-surface mb-2">Retrouvez vos compagnons</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-md mb-6">
          Connectez-vous pour enregistrer vos animaux, suivre leur poids et garder leurs contacts utiles à portée de main.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/connexion" className={addButton}>
            <Icon name="login" className="text-[20px]" />
            <span>Se connecter</span>
          </Link>
          <Link
            href="/inscription"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-all"
          >
            Créer un compte
          </Link>
        </div>
      </section>
    </div>
  );
}
