import { ENERGY_LEVELS, PERSONALITY, SEXES, SIZES, SPECIES, type AdoptionListing } from "../adoption";

/** Nombre maximal d'annonces envoyées au modèle. */
export const LISTING_CONTEXT_MAX = 30;

const clean = (value: string) => value.replace(/[\s|]+/g, " ").trim();
const yesNo = (value: boolean) => (value ? "oui" : "non");

/** Annonces envoyées au modèle : disponibles uniquement, les plus récentes. */
export function contextListings(listings: AdoptionListing[]): AdoptionListing[] {
  return listings.filter((l) => l.status === "disponible").slice(0, LISTING_CONTEXT_MAX);
}

/**
 * Bloc « ANNONCES » joint aux questions d'adoption : une ligne courte par animal disponible,
 * sans aucune donnée personnelle de l'annonceur.
 */
export function buildListingContext(listings: AdoptionListing[]): string {
  const available = contextListings(listings);
  if (!available.length) return "ANNONCES (animaux disponibles) : aucune pour le moment.";
  const lines = available.map((l) =>
    [
      `- id=${l.id}`,
      clean(l.name),
      SPECIES[l.species].label.toLowerCase(),
      l.breed?.trim() ? clean(l.breed) : null,
      SEXES[l.sex].label.toLowerCase(),
      clean(l.ageLabel),
      `taille ${SIZES[l.size].toLowerCase()}`,
      clean(l.city),
      `énergie ${ENERGY_LEVELS[l.energy].toLowerCase()}`,
      `seul ${l.aloneHours} h max`,
      l.personality.length ? `badges: ${l.personality.map((p) => PERSONALITY[p].label.toLowerCase()).join(", ")}` : null,
      `ok enfants: ${yesNo(l.compatibility.kids)}, ok chiens: ${yesNo(l.compatibility.dogs)}, ok chats: ${yesNo(l.compatibility.cats)}`,
      `jardin nécessaire: ${yesNo(l.compatibility.garden)}`,
    ]
      .filter(Boolean)
      .join(" | "),
  );
  return `ANNONCES (animaux disponibles) :\n${lines.join("\n")}`;
}
