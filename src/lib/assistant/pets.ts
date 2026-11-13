/** Animaux de l'utilisateur et leur carnet de santé, lus par les routes /api (MongoDB). */
import { listHealthRecords } from "../health-records-api";
import { listPets } from "../pets";
import { buildHealthSummary } from "./context";
import type { AssistantPet } from "./pets-model";

export * from "./pets-model";

/** Animaux actifs de l'utilisateur ; liste vide si l'API ne répond pas (l'assistant reste utilisable). */
export async function listMyPets(): Promise<AssistantPet[]> {
  try {
    const pets = await listPets();
    return pets
      .filter((p) => p.status === "active" && p.name)
      .map((p) => ({
        id: p.id,
        name: p.name,
        species: p.species,
        sex: p.sex || undefined,
        breed: p.breed || undefined,
        birthDate: p.birthDate ? new Date(`${p.birthDate}T00:00:00`) : undefined,
        sterilized: p.sterilized,
        notes: p.notes || undefined,
        latestWeight: p.latestWeight,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  } catch (error) {
    console.error("Animaux indisponibles pour l'assistant :", error);
    return [];
  }
}

/** Quelques lignes du carnet de santé, ajoutées aux questions sur l'animal. */
export async function fetchHealthSummary(petId: string): Promise<string[]> {
  try {
    return buildHealthSummary(await listHealthRecords(petId));
  } catch (error) {
    console.error("Carnet de santé indisponible pour l'assistant :", error);
    return [];
  }
}
