import { collection, getDocs, limit, orderBy, query, where, type Timestamp } from "firebase/firestore";
import { db } from "../firebase";

/** Animal de l'utilisateur, lu dans `pets/{id}` (module 1), pour personnaliser les réponses. */
export type AssistantPet = {
  id: string;
  name: string;
  /** Valeurs du module 1 : dog, cat, rabbit, rodent, bird, other. */
  species: string;
  sex?: string;
  breed?: string;
  birthDate?: Date;
  sterilized?: boolean;
  notes?: string;
};

export type PetWeight = { kg: number; measuredOn?: Date };

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

/** Animaux actifs de l'utilisateur. Liste vide si le module 1 n'a pas encore de données ou de règles. */
export async function listMyPets(uid: string): Promise<AssistantPet[]> {
  try {
    const snapshot = await getDocs(query(collection(db(), "pets"), where("ownerId", "==", uid)));
    return snapshot.docs
      .map((d) => ({ id: d.id, data: d.data() }))
      .filter(({ data }) => data.status !== "archived" && typeof data.name === "string" && data.name)
      .map(({ id, data }) => ({
        id,
        name: data.name as string,
        species: (data.species as string) ?? "other",
        sex: data.sex as string | undefined,
        breed: data.breed as string | undefined,
        birthDate: (data.birthDate as Timestamp | undefined)?.toDate(),
        sterilized: data.sterilized as boolean | undefined,
        notes: data.notes as string | undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  } catch {
    return [];
  }
}

export async function fetchLatestWeight(petId: string): Promise<PetWeight | undefined> {
  try {
    const snapshot = await getDocs(
      query(collection(db(), "pets", petId, "weights"), orderBy("measuredOn", "desc"), limit(1)),
    );
    const data = snapshot.docs[0]?.data();
    if (typeof data?.weightKg !== "number") return undefined;
    return { kg: data.weightKg, measuredOn: (data.measuredOn as Timestamp | undefined)?.toDate() };
  } catch {
    return undefined;
  }
}

/**
 * Résumé du carnet de santé (module 2 : vaccins, traitements, allergies, visites).
 *
 * Module 2 : renvoyer ici quelques lignes courtes, par exemple « Vaccin rage : 12/03/2026 »,
 * « Allergie : poulet ». Elles sont ajoutées automatiquement au contexte de l'assistant.
 */
export async function fetchHealthSummary(petId: string): Promise<string[]> {
  void petId;
  return [];
}

/** Bloc « ANIMAL SÉLECTIONNÉ » envoyé avec chaque question : jamais de donnée sur le propriétaire. */
export function buildPetContext(
  pet: AssistantPet,
  { weight, health = [], now = new Date() }: { weight?: PetWeight; health?: string[]; now?: Date } = {},
): string {
  const clean = (v: string) => v.replace(/\s+/g, " ").trim();
  const age = petAgeLabel(pet, now);
  const lines = [
    `Nom : ${clean(pet.name)}`,
    `Espèce : ${speciesLabel(pet)}`,
    pet.breed?.trim() ? `Race : ${clean(pet.breed)}` : null,
    pet.sex ? `Sexe : ${pet.sex === "female" ? "femelle" : "mâle"}` : null,
    age ? `Âge : ${age}` : null,
    pet.sterilized === undefined ? null : `Stérilisé : ${pet.sterilized ? "oui" : "non"}`,
    weight ? `Dernier poids : ${weight.kg.toFixed(1)} kg` : null,
    pet.notes?.trim() ? `Notes du propriétaire : ${clean(pet.notes)}` : null,
    health.length ? `Carnet de santé :\n${health.map((h) => `- ${clean(h)}`).join("\n")}` : null,
  ].filter(Boolean);
  return `ANIMAL SÉLECTIONNÉ :\n${lines.join("\n")}`;
}
