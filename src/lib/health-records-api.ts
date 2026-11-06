import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { HealthRecord, HealthRecordInput, NewAttachment, RecordType } from "./health-records";
import { sendNotification } from "./notifications";

/**
 * Appels du navigateur vers l'API MongoDB du carnet de santé (/api/health-records).
 * Chaque requête envoie le jeton Firebase de l'utilisateur connecté.
 */

/** Erreur de l'API, avec les erreurs par champ renvoyées par la validation serveur. */
export class HealthApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors: Partial<Record<string, string>> = {},
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = auth().currentUser;
  if (!user) throw new HealthApiError("Vous devez être connecté.", 401);
  const token = await user.getIdToken();

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new HealthApiError("Problème de connexion réseau. Vérifiez votre connexion internet.", 0);
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HealthApiError(body.error ?? "Une erreur est survenue. Réessayez.", response.status, body.fieldErrors ?? {});
  }
  return body as T;
}

export async function listHealthRecords(petId: string, type?: RecordType): Promise<HealthRecord[]> {
  const params = new URLSearchParams({ petId, ...(type ? { type } : {}) });
  const { records } = await request<{ records: HealthRecord[] }>(`/api/health-records?${params}`);
  return records;
}

export async function getHealthRecord(id: string): Promise<HealthRecord> {
  const { record } = await request<{ record: HealthRecord }>(`/api/health-records/${encodeURIComponent(id)}`);
  return record;
}

export async function createHealthRecord(input: HealthRecordInput, newAttachments: NewAttachment[]): Promise<HealthRecord> {
  const { record } = await request<{ record: HealthRecord }>("/api/health-records", {
    method: "POST",
    body: JSON.stringify({ ...input, newAttachments }),
  });
  return record;
}

export async function updateHealthRecord(
  id: string,
  input: HealthRecordInput,
  attachments: { keepAttachmentIds: string[]; newAttachments: NewAttachment[] },
): Promise<HealthRecord> {
  const { record } = await request<{ record: HealthRecord }>(`/api/health-records/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ ...input, ...attachments }),
  });
  return record;
}

export async function deleteHealthRecord(id: string): Promise<void> {
  await request<void>(`/api/health-records/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Ouvre une pièce jointe dans un nouvel onglet (le téléchargement exige le jeton). */
export async function openAttachment(recordId: string, attachmentId: string): Promise<void> {
  const user = auth().currentUser;
  if (!user) throw new HealthApiError("Vous devez être connecté.", 401);
  // L'onglet est ouvert tout de suite (sinon le navigateur le bloque), puis rempli.
  const tab = window.open("", "_blank");
  try {
    const response = await fetch(
      `/api/health-records/${encodeURIComponent(recordId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { headers: { Authorization: `Bearer ${await user.getIdToken()}` } },
    );
    if (!response.ok) throw new HealthApiError("Pièce jointe introuvable.", response.status);
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

/** Animaux qui ont déjà des actes dans le carnet (MongoDB). */
export async function listPetsWithRecords(): Promise<HealthPetSummary[]> {
  const { pets } = await request<{ pets: HealthPetSummary[] }>("/api/health-records/pets");
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

/* ---------- Animaux (module 1 « Mes animaux », collection Firestore `pets`) ---------- */

export type PetInfo = { id: string; name: string; species?: string; breed?: string };

/**
 * Animaux de l'utilisateur dans Firestore `pets` (module 1).
 * Liste vide tant que ce module (ou ses règles Firestore) n'est pas en place.
 */
export async function listMyPets(uid: string): Promise<PetInfo[]> {
  try {
    const snapshot = await getDocs(query(collection(db(), "pets"), where("ownerId", "==", uid)));
    return snapshot.docs
      .map((d) => ({ id: d.id, data: d.data() }))
      .filter(({ data }) => data.status !== "archived" && typeof data.name === "string" && data.name)
      .map(({ id, data }) => ({ id, name: data.name, species: data.species, breed: data.breed }));
  } catch {
    return [];
  }
}

/** Un animal du module 1, ou null s'il n'est pas (encore) disponible. */
export async function getPet(petId: string): Promise<PetInfo | null> {
  try {
    const snapshot = await getDoc(doc(db(), "pets", petId));
    const data = snapshot.data();
    return data && typeof data.name === "string"
      ? { id: snapshot.id, name: data.name, species: data.species, breed: data.breed }
      : null;
  } catch {
    return null;
  }
}

export const SPECIES_LABELS: Record<string, string> = {
  dog: "Chien",
  cat: "Chat",
  rabbit: "Lapin",
  rodent: "Rongeur",
  bird: "Oiseau",
  other: "Animal",
};

/**
 * Rappel de vaccin dans le centre de notifications (type « rappel » du module Utilisateurs),
 * affiché 7 jours avant l'échéance.
 */
export async function scheduleVaccineReminder(record: HealthRecord, uid: string): Promise<void> {
  if (record.type !== "vaccin" || !record.nextDueDate) return;
  const due = new Date(`${record.nextDueDate}T09:00:00`);
  if (due.getTime() < Date.now()) return;
  const showAt = new Date(Math.max(Date.now(), due.getTime() - 7 * 24 * 3600_000));
  const petName = record.petName || "votre animal";
  await sendNotification({
    userId: uid,
    type: "rappel",
    title: `Rappel de vaccin pour ${petName}`.slice(0, 120),
    body: `${record.title} : rappel prévu le ${due.toLocaleDateString("fr-FR", { dateStyle: "long" })}.`,
    link: `/animaux/${encodeURIComponent(record.petId)}/carnet-de-sante/${record.id}`,
    actionLabel: "Voir le carnet",
    showAt,
  });
}
