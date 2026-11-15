// Module Carnet de santé côté serveur : collections MongoDB `health_records` et `treatment_doses`,
// accès à l'animal (module Mes animaux), validation et rappels de vaccin.
import "server-only";
import { Binary, ObjectId, type Collection } from "mongodb";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_TYPES,
  ATTACHMENTS_MAX_COUNT,
  validateHealthRecord,
  type HealthRecord,
  type HealthRecordInput,
} from "@/lib/health-records";
import { HttpError } from "./http";
import { mongo, notifications } from "./mongo";
import { pets, type PetDoc } from "./pets";

export type AttachmentDoc = { _id: ObjectId; name: string; mimeType: string; size: number; data: Binary };

/**
 * Un document par acte médical. `ownerId` = uid Firebase du propriétaire ;
 * `petId` = identifiant de l'animal dans la collection `pets` (module Mes animaux).
 */
export type HealthRecordDoc = {
  _id: ObjectId;
  ownerId: string;
  petId: string;
  petName: string;
  type: HealthRecord["type"];
  title: string;
  date: Date;
  veterinarian: string;
  clinic: string;
  notes: string;
  lotNumber: string;
  nextDueDate: Date | null;
  dosage: string;
  endDate: Date | null;
  /** Traitement : heures des prises « HH:MM » (absent sur les actes créés avant le suivi des prises). */
  doseTimes?: string[];
  doseEveryDays?: number;
  attachments: AttachmentDoc[];
  createdAt: Date;
  updatedAt: Date;
};

/** Une prise de traitement cochée : au plus une par traitement, jour et heure. */
export type TreatmentDoseDoc = {
  _id: ObjectId;
  ownerId: string;
  recordId: string;
  petId: string;
  /** Jour de la prise chez l'utilisateur (AAAA-MM-JJ). */
  day: string;
  time: string;
  takenAt: Date;
};

const cache = globalThis as unknown as { _petcareHealthIndexes?: Promise<void> };

async function healthIndexes() {
  const db = await mongo();
  cache._petcareHealthIndexes ??= Promise.all([
    // Carnet d'un animal, du plus récent au plus ancien.
    db.collection("health_records").createIndex({ ownerId: 1, petId: 1, date: -1 }),
    db.collection("treatment_doses").createIndex({ recordId: 1, day: 1, time: 1 }, { unique: true }),
    db.collection("treatment_doses").createIndex({ ownerId: 1, day: 1 }),
  ])
    .then(() => undefined)
    .catch((error) => {
      cache._petcareHealthIndexes = undefined;
      throw error;
    });
  await cache._petcareHealthIndexes;
  return db;
}

export async function healthRecords(): Promise<Collection<HealthRecordDoc>> {
  return (await healthIndexes()).collection<HealthRecordDoc>("health_records");
}

export async function treatmentDoses(): Promise<Collection<TreatmentDoseDoc>> {
  return (await healthIndexes()).collection<TreatmentDoseDoc>("treatment_doses");
}

export const petNotFound = () => new HttpError(404, "Animal introuvable.");
export const archivedPet = () => new HttpError(409, "Cet animal est archivé : son carnet est en lecture seule.");

/**
 * L'animal du carnet, s'il appartient à l'utilisateur (sinon 404, sans dire s'il existe).
 * `write` : refuse toute écriture (409) quand l'animal est archivé ; la lecture et l'export restent permis.
 */
export async function requirePetAccess(
  uid: string,
  petId: string,
  { write = false }: { write?: boolean } = {},
): Promise<Pick<PetDoc, "_id" | "name" | "status">> {
  if (!/^[0-9a-f]{24}$/.test(petId)) throw petNotFound();
  const pet = await (await pets()).findOne(
    { _id: new ObjectId(petId), ownerId: uid },
    { projection: { name: 1, status: 1 } },
  );
  if (!pet) throw petNotFound();
  if (write && pet.status === "archived") throw archivedPet();
  return pet;
}

/** Champs lus pour l'affichage : le contenu des pièces jointes n'est chargé qu'au téléchargement. */
export const LIST_PROJECTION = { "attachments.data": 0 } as const;

export const recordNotFound = () => new HttpError(404, "Acte médical introuvable.");

export function recordObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id) || id.length !== 24) throw recordNotFound();
  return new ObjectId(id);
}

const isoDay = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : null);

/** Document → JSON de l'API (sans ownerId ni contenu des pièces jointes). */
export function toHealthRecord(doc: Omit<HealthRecordDoc, "attachments"> & { attachments: Omit<AttachmentDoc, "data">[] }): HealthRecord {
  return {
    id: doc._id.toHexString(),
    petId: doc.petId,
    petName: doc.petName,
    type: doc.type,
    title: doc.title,
    date: isoDay(doc.date)!,
    veterinarian: doc.veterinarian,
    clinic: doc.clinic,
    notes: doc.notes,
    lotNumber: doc.lotNumber,
    nextDueDate: isoDay(doc.nextDueDate),
    dosage: doc.dosage,
    endDate: isoDay(doc.endDate),
    doseTimes: doc.type === "traitement" ? (doc.doseTimes ?? []) : [],
    doseEveryDays: doc.type === "traitement" ? (doc.doseEveryDays ?? 1) : 1,
    attachments: doc.attachments.map((a) => ({ id: a._id.toHexString(), name: a.name, mimeType: a.mimeType, size: a.size })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Valide les champs du formulaire (mêmes règles que dans le navigateur) et les convertit au format MongoDB. */
export function recordFields(body: Record<string, unknown>) {
  const { value, errors } = validateHealthRecord(body);
  if (Object.values(errors).some(Boolean)) {
    throw new HttpError(400, "Certaines informations ne sont pas valides.", errors);
  }
  const toDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`) : null);
  const { date, nextDueDate, endDate, ...rest }: HealthRecordInput = value;
  return { ...rest, date: toDate(date)!, nextDueDate: toDate(nextDueDate), endDate: toDate(endDate) };
}

const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;

/** Nouvelles pièces jointes `{ name, mimeType, data (base64) }` → documents MongoDB. */
export function parseNewAttachments(raw: unknown): AttachmentDoc[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new HttpError(400, "Pièces jointes invalides.");
  if (raw.length > ATTACHMENTS_MAX_COUNT) throw new HttpError(400, `${ATTACHMENTS_MAX_COUNT} pièces jointes maximum par acte.`);
  return raw.map((item) => {
    const { name, mimeType, data } = (item ?? {}) as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim() || typeof data !== "string" || !base64Pattern.test(data)) {
      throw new HttpError(400, "Pièce jointe invalide.");
    }
    if (typeof mimeType !== "string" || !ATTACHMENT_TYPES.includes(mimeType)) {
      throw new HttpError(400, `« ${name} » : format non accepté (PDF, JPG, PNG ou WebP).`);
    }
    const buffer = Buffer.from(data, "base64");
    if (buffer.length === 0 || buffer.length > ATTACHMENT_MAX_BYTES) {
      throw new HttpError(400, `« ${name} » dépasse la taille maximale de 2 Mo.`);
    }
    return { _id: new ObjectId(), name: name.trim().slice(0, 200), mimeType, size: buffer.length, data: new Binary(buffer) };
  });
}

// ---------------------------------------------------------------------------
// Rappels de vaccin (centre de notifications, type « rappel »)
// ---------------------------------------------------------------------------

export const recordLink = (petId: string, recordId: string) =>
  `/animaux/${encodeURIComponent(petId)}/carnet-de-sante/${recordId}`;

/**
 * Programme (ou reprogramme) le rappel d'un vaccin : affiché 7 jours avant l'échéance.
 * Le rappel précédent de cet acte est remplacé (ou supprimé si l'acte n'est plus un vaccin à rappeler).
 */
export async function syncVaccineReminder(record: HealthRecordDoc | null, recordId: ObjectId, ownerId: string, petId: string) {
  try {
    const col = await notifications();
    const now = new Date();
    // L'ancien rappel de cet acte (date modifiée, acte supprimé…) n'est plus valable.
    await col.deleteMany({ userId: ownerId, type: "rappel", link: recordLink(petId, recordId.toHexString()) });
    if (!record || record.type !== "vaccin" || !record.nextDueDate) return;

    const due = new Date(`${isoDay(record.nextDueDate)}T09:00:00`);
    if (due.getTime() < now.getTime()) return;
    const petName = record.petName || "votre animal";
    await col.insertOne({
      _id: new ObjectId(),
      userId: ownerId,
      senderId: "system",
      type: "rappel",
      title: `Rappel de vaccin pour ${petName}`.slice(0, 120),
      body: `${record.title} : rappel prévu le ${due.toLocaleDateString("fr-FR", { dateStyle: "long" })}.`,
      link: recordLink(petId, recordId.toHexString()),
      actionLabel: "Voir le carnet",
      read: false,
      createdAt: now,
      showAt: new Date(Math.max(now.getTime(), due.getTime() - 7 * 24 * 3600_000)),
    });
  } catch (error) {
    // Un rappel non programmé ne doit pas bloquer l'enregistrement de l'acte.
    console.error("Rappel de vaccin non programmé :", error);
  }
}
