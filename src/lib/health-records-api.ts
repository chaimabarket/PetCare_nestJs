import { ApiError, api } from "./api";
import { auth } from "./firebase";
import type { HealthRecord, HealthRecordInput, NewAttachment, RecordType } from "./health-records";

/**
 * Appels du navigateur vers l'API du carnet de santé (/api/health-records, données dans MongoDB).
 * `api()` envoie le jeton Firebase de l'utilisateur connecté ; le serveur ne renvoie que ses actes.
 */

/** Erreur de l'API, avec les erreurs par champ renvoyées par la validation serveur (`fieldErrors`). */
export { ApiError as HealthApiError };

export async function listHealthRecords(petId: string, type?: RecordType): Promise<HealthRecord[]> {
  const params = new URLSearchParams({ petId, ...(type ? { type } : {}) });
  const { records } = await api<{ records: HealthRecord[] }>(`/api/health-records?${params}`);
  return records;
}

export async function getHealthRecord(id: string): Promise<HealthRecord> {
  const { record } = await api<{ record: HealthRecord }>(`/api/health-records/${encodeURIComponent(id)}`);
  return record;
}

/** Crée l'acte ; un vaccin avec date de rappel programme sa notification (côté serveur). */
export async function createHealthRecord(input: HealthRecordInput, newAttachments: NewAttachment[]): Promise<HealthRecord> {
  const { record } = await api<{ record: HealthRecord }>("/api/health-records", {
    method: "POST",
    body: { ...input, newAttachments },
  });
  return record;
}

/** Modifie l'acte ; le rappel de vaccin est mis à jour par le serveur. */
export async function updateHealthRecord(
  id: string,
  input: HealthRecordInput,
  attachments: { keepAttachmentIds: string[]; newAttachments: NewAttachment[] },
): Promise<HealthRecord> {
  const { record } = await api<{ record: HealthRecord }>(`/api/health-records/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: { ...input, ...attachments },
  });
  return record;
}

export async function deleteHealthRecord(id: string): Promise<void> {
  await api(`/api/health-records/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Ouvre une pièce jointe dans un nouvel onglet (le téléchargement exige le jeton). */
export async function openAttachment(recordId: string, attachmentId: string): Promise<void> {
  await auth().authStateReady();
  const user = auth().currentUser;
  if (!user) throw new ApiError(401, "Vous devez être connecté.");
  // L'onglet est ouvert tout de suite (sinon le navigateur le bloque), puis rempli.
  const tab = window.open("", "_blank");
  try {
    const response = await fetch(
      `/api/health-records/${encodeURIComponent(recordId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: "no-store" },
    );
    if (!response.ok) throw new ApiError(response.status, "Pièce jointe introuvable.");
    const url = URL.createObjectURL(await response.blob());
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

export type HealthPetSummary = { petId: string; petName: string; count: number; lastDate: string };

/** Animaux qui ont déjà des actes dans le carnet. */
export async function listPetsWithRecords(): Promise<HealthPetSummary[]> {
  const { pets } = await api<{ pets: HealthPetSummary[] }>("/api/health-records/pets");
  return pets;
}

/** Fichier choisi dans le formulaire → pièce jointe en base64. */
export function fileToAttachment(file: File): Promise<NewAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve({ name: file.name, mimeType: file.type, data: result.slice(result.indexOf(",") + 1) });
    };
    reader.onerror = () => reject(new Error(`Lecture impossible de « ${file.name} ».`));
    reader.readAsDataURL(file);
  });
}

/* ---------- Animaux (module 1 « Mes animaux ») ---------- */

export type PetInfo = { id: string; name: string; species?: string; breed?: string };

/**
 * Animaux de l'utilisateur, fournis par le module 1 « Mes animaux ».
 * Ce module n'existe pas encore : liste vide. Les carnets sont alors créés depuis /carnet-de-sante
 * en indiquant le nom de l'animal (voir README). À brancher sur l'API du module 1 quand il sera prêt.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function listMyPets(uid: string): Promise<PetInfo[]> {
  return [];
}

/** Un animal du module 1, ou null tant que ce module n'existe pas (le nom vient alors du carnet). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getPet(petId: string): Promise<PetInfo | null> {
  return null;
}

export const SPECIES_LABELS: Record<string, string> = {
  dog: "Chien",
  cat: "Chat",
  rabbit: "Lapin",
  rodent: "Rongeur",
  bird: "Oiseau",
  other: "Animal",
};
