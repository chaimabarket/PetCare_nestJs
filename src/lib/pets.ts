import { api } from "./api";
import type { Pet, PetContactInput, PetInput, PetWeight, PetWeightAlertState, WeightInput } from "./pets-models";

// Module « Mes animaux » : fonctions appelées par les pages, via les routes /api/pets (MongoDB).
// Types, référentiels et validation : lib/pets-models.ts ; alerte de poids : lib/pet-weight-alert.ts.
export * from "./pets-models";

const petPath = (id: string) => `/api/pets/${encodeURIComponent(id)}`;

export type NewPhoto = { url: string; thumbnail: string };

/** Tous ses animaux (actifs, brouillons, archivés), avec la couverture (miniature) et le dernier poids. */
export function listPets(): Promise<Pet[]> {
  return api<Pet[]>("/api/pets");
}

/** Fiche complète : toutes les photos, contacts, dernier poids, alerte en cours. */
export function getPet(id: string): Promise<Pet> {
  return api<Pet>(petPath(id));
}

export function createPet(input: {
  pet: PetInput;
  draft: boolean;
  photos: NewPhoto[];
  weight?: Pick<WeightInput, "day" | "weightKg">;
}): Promise<Pet> {
  return api<Pet>("/api/pets", { method: "POST", body: input });
}

export function updatePet(
  id: string,
  input: { pet: PetInput; draft: boolean; photoOrder?: string[]; weight?: Pick<WeightInput, "day" | "weightKg"> },
): Promise<Pet> {
  return api<Pet>(petPath(id), { method: "PUT", body: input });
}

/** Modification depuis la fiche : notes, contacts, favori, ou « Ignorer » l'alerte de poids. */
export function patchPet(
  id: string,
  changes: { notes?: string; contacts?: PetContactInput[]; favorite?: boolean; dismissAlert?: true },
): Promise<Pet> {
  return api<Pet>(petPath(id), { method: "PATCH", body: changes });
}

export function archivePet(id: string, reason = ""): Promise<Pet> {
  return api<Pet>(`${petPath(id)}/archive`, { method: "POST", body: { reason } });
}

export function restorePet(id: string): Promise<Pet> {
  return api<Pet>(`${petPath(id)}/restore`, { method: "POST" });
}

export function addPhoto(id: string, photo: NewPhoto): Promise<Pet> {
  return api<Pet>(`${petPath(id)}/photos`, { method: "POST", body: photo });
}

export function removePhoto(id: string, photoId: string): Promise<Pet> {
  return api<Pet>(`${petPath(id)}/photos/${encodeURIComponent(photoId)}`, { method: "DELETE" });
}

export function setCoverPhoto(id: string, photoId: string): Promise<Pet> {
  return api<Pet>(`${petPath(id)}/photos/${encodeURIComponent(photoId)}/cover`, { method: "POST" });
}

export function listWeights(id: string): Promise<PetWeight[]> {
  return api<PetWeight[]>(`${petPath(id)}/weights`);
}

type WeightResult = { weight: PetWeight; weightAlert: PetWeightAlertState | null };

export function addWeight(id: string, weight: WeightInput): Promise<WeightResult> {
  return api<WeightResult>(`${petPath(id)}/weights`, { method: "POST", body: weight });
}

/** Correction du poids et de la note (la date ne change pas). */
export function updateWeight(id: string, weightId: string, changes: { weightKg: number; note: string }): Promise<WeightResult> {
  return api<WeightResult>(`${petPath(id)}/weights/${encodeURIComponent(weightId)}`, { method: "PUT", body: changes });
}

export function deleteWeight(id: string, weightId: string): Promise<void> {
  return api(`${petPath(id)}/weights/${encodeURIComponent(weightId)}`, { method: "DELETE" });
}
