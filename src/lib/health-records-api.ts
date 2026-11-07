import { ApiError, api } from "./api";
import { auth } from "./firebase";
import type { HealthRecord, HealthRecordInput, NewAttachment, RecordType } from "./health-records";
import type { CreatedShare, HealthShare, SharedHealthBook, ShareInput } from "./health-share";
import type { HealthSummary } from "./health-summary";
import { getPet as getPetSheet, type Pet } from "./pets";

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

/** Onglet Santé : cartes des animaux et tableau de bord du jour `day` (jour local, AAAA-MM-JJ). */
export async function getHealthSummary(day: string): Promise<HealthSummary> {
  return api<HealthSummary>(`/api/health-records/summary?${new URLSearchParams({ day })}`);
}

/** Note (taken = true) ou annule une prise de traitement. */
export async function setDoseTaken(recordId: string, day: string, time: string, taken: boolean): Promise<void> {
  const path = `/api/health-records/${encodeURIComponent(recordId)}/doses`;
  if (taken) await api(path, { method: "POST", body: { day, time } });
  else await api(`${path}?${new URLSearchParams({ day, time })}`, { method: "DELETE" });
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

export type PetInfo = { id: string; name: string; species?: string; breed?: string; archived: boolean; thumbnail: string };

const toPetInfo = (p: Pet): PetInfo => ({
  id: p.id,
  name: p.name,
  species: p.species,
  breed: p.breed || undefined,
  archived: p.status === "archived",
  thumbnail: p.photos[0]?.thumbnail ?? "",
});

/** Fiche de l'animal (module 1), ou null si elle est introuvable ou appartient à quelqu'un d'autre. */
export async function getPet(petId: string): Promise<PetInfo | null> {
  if (!/^[0-9a-f]{24}$/.test(petId)) return null;
  return getPetSheet(petId).then(toPetInfo, () => null);
}

/** Fiche complète (export PDF). */
export const getFullPet = (petId: string): Promise<Pet> => getPetSheet(petId);

export const SPECIES_LABELS: Record<string, string> = {
  dog: "Chien",
  cat: "Chat",
  rabbit: "Lapin",
  rodent: "Rongeur",
  bird: "Oiseau",
  other: "Animal",
};

/* ---------- Partage sécurisé du carnet (lien + QR code) ---------- */

export async function listShares(petId: string): Promise<HealthShare[]> {
  const { shares } = await api<{ shares: HealthShare[] }>(`/api/health-records/shares?${new URLSearchParams({ petId })}`);
  return shares;
}

/** Crée un lien : le jeton n'est renvoyé qu'une fois (il n'est pas stocké en clair). */
export function createShare(petId: string, input: ShareInput): Promise<CreatedShare> {
  return api<CreatedShare>("/api/health-records/shares", { method: "POST", body: { petId, ...input } });
}

export async function revokeShare(id: string): Promise<HealthShare> {
  const { share } = await api<{ share: HealthShare }>(`/api/health-records/shares/${encodeURIComponent(id)}`, { method: "DELETE" });
  return share;
}

/** Carnet ouvert depuis un lien de partage (sans compte). */
export function getSharedBook(token: string): Promise<SharedHealthBook> {
  return api<SharedHealthBook>(`/api/partage/${encodeURIComponent(token)}`, { public: true });
}
