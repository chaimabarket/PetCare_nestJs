/** Animal de l'utilisateur tel que l'assistant le voit (sans Firebase : testé avec `npm test`). */

export type AssistantPet = {
  id: string;
  name: string;
  /** Valeurs de Mes animaux : dog, cat, rabbit, rodent, bird, other. */
  species: string;
  sex?: string;
  breed?: string;
  birthDate?: Date;
  sterilized?: boolean;
  notes?: string;
  /** Dernière pesée (fiche Mes animaux). */
  latestWeight?: { kg: number; day: string };
};

const SPECIES_LABELS: Record<string, { label: string; emoji: string }> = {
  dog: { label: "chien", emoji: "🐶" },
  cat: { label: "chat", emoji: "🐱" },
  rabbit: { label: "lapin", emoji: "🐰" },
  rodent: { label: "rongeur", emoji: "🐹" },
  bird: { label: "oiseau", emoji: "🦜" },
};

export const speciesLabel = (pet: AssistantPet) => SPECIES_LABELS[pet.species]?.label ?? "animal";
export const petEmoji = (pet: AssistantPet) => SPECIES_LABELS[pet.species]?.emoji ?? "🐾";

/** Âge en mois ; `undefined` si la date de naissance est inconnue. */
export function ageInMonths(pet: AssistantPet, now = new Date()): number | undefined {
  const birth = pet.birthDate;
  if (!birth) return undefined;
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth() - (now.getDate() < birth.getDate() ? 1 : 0);
  return Math.max(0, months);
}

/** « 8 mois », « 3 ans », ou `undefined`. */
export function petAgeLabel(pet: AssistantPet, now = new Date()): string | undefined {
  const months = ageInMonths(pet, now);
  if (months === undefined) return undefined;
  if (months < 12) return `${months === 0 ? 1 : months} mois`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 an" : `${years} ans`;
}

export const isYoung = (pet: AssistantPet, now = new Date()) => (ageInMonths(pet, now) ?? 24) < 12;
export const isSenior = (pet: AssistantPet, now = new Date()) => (ageInMonths(pet, now) ?? 24) >= 96;

/** Bloc « ANIMAL SÉLECTIONNÉ » envoyé avec chaque question : jamais de donnée sur le propriétaire. */
export function buildPetContext(pet: AssistantPet, { health = [], now = new Date() }: { health?: string[]; now?: Date } = {}): string {
  const clean = (v: string) => v.replace(/\s+/g, " ").trim();
  const age = petAgeLabel(pet, now);
  const lines = [
    `Nom : ${clean(pet.name)}`,
    `Espèce : ${speciesLabel(pet)}`,
    pet.breed?.trim() ? `Race : ${clean(pet.breed)}` : null,
    pet.sex ? `Sexe : ${pet.sex === "female" ? "femelle" : "mâle"}` : null,
    age ? `Âge : ${age}` : null,
    pet.sterilized === undefined ? null : `Stérilisé : ${pet.sterilized ? "oui" : "non"}`,
    pet.latestWeight ? `Dernier poids : ${pet.latestWeight.kg.toFixed(1)} kg` : null,
    pet.notes?.trim() ? `Notes du propriétaire : ${clean(pet.notes)}` : null,
    health.length ? `Carnet de santé :\n${health.map((h) => `- ${clean(h)}`).join("\n")}` : null,
  ].filter(Boolean);
  return `ANIMAL SÉLECTIONNÉ :\n${lines.join("\n")}`;
}
