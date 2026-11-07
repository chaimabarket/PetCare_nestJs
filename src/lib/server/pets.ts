// Module « Mes animaux » côté serveur : collections MongoDB `pets` et `petWeights`, règles d'accès,
// validation des données reçues et alerte intelligente de poids.
import "server-only";
import { ObjectId, type Collection } from "mongodb";
import {
  alertKey,
  analyzeWeights,
  shouldNotify,
  WEIGHT_ALERT_INFO,
  type WeightAlert,
} from "@/lib/pet-weight-alert";
import {
  daysBetween,
  formatKg,
  MAX_PET_PHOTOS,
  PET_ROUTES,
  shiftDay,
  validatePetInput,
  type Pet,
  type PetContact,
  type PetInput,
  type PetStatus,
  type PetWeight,
} from "@/lib/pets-models";
import { badRequest, forbidden, HttpError, notFound } from "./http";
import { mongo } from "./mongo";
import { notifyUsers } from "./notify";

// ---------------------------------------------------------------------------
// Documents MongoDB
// ---------------------------------------------------------------------------

export type PetPhotoDoc = { _id: ObjectId; url: string; thumbnail: string; createdAt: Date };
export type PetContactDoc = Omit<PetContact, "id"> & { _id: ObjectId };
export type PetAlertDoc = WeightAlert & { key: string; dismissed: boolean; detectedAt: Date };

/** Document `pets` : `ownerId` = uid Firebase du propriétaire. */
export type PetDoc = PetInput & {
  _id: ObjectId;
  ownerId: string;
  status: PetStatus;
  archivedReason?: string;
  archivedAt?: Date;
  favorite: boolean;
  contacts: PetContactDoc[];
  /** La première photo est la couverture. */
  photos: PetPhotoDoc[];
  /** Alerte de poids en cours (absente s'il n'y en a pas). */
  weightAlert?: PetAlertDoc;
  /** Épisodes d'alerte déjà notifiés (pas de doublon de notification). */
  notifiedAlertKeys: string[];
  createdAt: Date;
  updatedAt: Date;
};

/** Document `petWeights` : une pesée par animal et par jour (index unique `petId` + `day`). */
export type PetWeightDoc = {
  _id: ObjectId;
  petId: string;
  ownerId: string;
  day: string;
  measuredOn: Date;
  weightKg: number;
  note: string;
  createdAt: Date;
  updatedAt: Date;
};

const cache = globalThis as unknown as { _petcarePetIndexes?: Promise<void> };

async function collection<T extends { _id: unknown }>(name: string): Promise<Collection<T>> {
  const db = await mongo();
  cache._petcarePetIndexes ??= Promise.all([
    db.collection("pets").createIndex({ ownerId: 1, status: 1 }),
    db.collection("petWeights").createIndex({ petId: 1, day: 1 }, { unique: true }),
    db.collection("petWeights").createIndex({ ownerId: 1 }),
  ])
    .then(() => undefined)
    .catch((error) => {
      cache._petcarePetIndexes = undefined;
      throw error;
    });
  await cache._petcarePetIndexes;
  return db.collection<T>(name);
}

export const pets = () => collection<PetDoc>("pets");
export const petWeights = () => collection<PetWeightDoc>("petWeights");

// ---------------------------------------------------------------------------
// Accès
// ---------------------------------------------------------------------------

export function objectId(id: string): ObjectId {
  if (!ObjectId.isValid(id) || id.length !== 24) throw notFound();
  return new ObjectId(id);
}

/** L'animal, s'il appartient à l'utilisateur connecté : 404 s'il n'existe pas, 403 s'il est à quelqu'un d'autre. */
export async function findOwnPet(id: string, uid: string): Promise<PetDoc> {
  const pet = await (await pets()).findOne({ _id: objectId(id) });
  if (!pet) throw notFound();
  if (pet.ownerId !== uid) throw forbidden();
  return pet;
}

/** Un animal archivé se lit et se restaure, mais ne se modifie pas. */
export function requireEditable(pet: PetDoc): void {
  if (pet.status === "archived") {
    throw new HttpError(409, `${pet.name} est archivé : restaurez sa fiche pour la modifier.`);
  }
}

/**
 * Jour le plus tardif accepté pour une date « pas dans le futur » : le serveur ne connaît pas le fuseau
 * de l'utilisateur, on tolère donc le lendemain du jour UTC (le navigateur, lui, vérifie le jour local).
 */
export function latestAllowedDay(now = new Date()): string {
  return shiftDay(now.toISOString().slice(0, 10), 1);
}

// ---------------------------------------------------------------------------
// Validation des données reçues
// ---------------------------------------------------------------------------

/** Champs d'un animal ; `draft` : seul le nom est exigé. Erreur 400 avec le premier message. */
export function parsePetInput(raw: unknown, draft: boolean): PetInput {
  const { value, errors } = validatePetInput(raw, { draft, today: latestAllowedDay() });
  const first = Object.values(errors).find(Boolean);
  if (first) throw badRequest(first);
  return value;
}

/** Une fiche complète (prête à quitter le brouillon) ? */
export function isComplete(pet: PetInput): boolean {
  const { errors } = validatePetInput(pet, { today: latestAllowedDay() });
  return !Object.values(errors).some(Boolean);
}

const IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
/** Marges au-dessus de la compression faite dans le navigateur (lib/images.ts). */
const MAX_PHOTO_BYTES = 600_000;
const MAX_THUMBNAIL_BYTES = 120_000;
const MAX_TOTAL_PHOTO_BYTES = 2_000_000;

export function parsePhoto(raw: unknown): Omit<PetPhotoDoc, "_id" | "createdAt"> {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const { url, thumbnail } = value;
  if (typeof url !== "string" || !IMAGE.test(url) || typeof thumbnail !== "string" || !IMAGE.test(thumbnail)) {
    throw badRequest("Photo invalide (JPG, PNG ou WebP).");
  }
  if (url.length > MAX_PHOTO_BYTES || thumbnail.length > MAX_THUMBNAIL_BYTES) throw badRequest("Photo trop lourde.");
  return { url, thumbnail };
}

/** Vérifie le nombre (5 maximum) et le poids total des photos d'un animal. */
export function checkPhotos(photos: Pick<PetPhotoDoc, "url" | "thumbnail">[]): void {
  if (photos.length > MAX_PET_PHOTOS) throw badRequest(`${MAX_PET_PHOTOS} photos maximum.`);
  const total = photos.reduce((sum, p) => sum + p.url.length + p.thumbnail.length, 0);
  if (total > MAX_TOTAL_PHOTO_BYTES) throw badRequest("Les photos sont trop lourdes : retirez-en une.");
}

// ---------------------------------------------------------------------------
// Conversion en JSON (format de l'API, voir le type `Pet`)
// ---------------------------------------------------------------------------

export function petJson(
  doc: PetDoc,
  { list = false, latestWeight }: { list?: boolean; latestWeight?: Pick<PetWeightDoc, "weightKg" | "day"> | null } = {},
): Pet {
  const photos = list ? doc.photos.slice(0, 1).map((p) => ({ ...p, url: "" })) : doc.photos;
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    species: doc.species,
    sex: doc.sex,
    breed: doc.breed,
    birthDate: doc.birthDate,
    birthDateEstimated: doc.birthDateEstimated,
    chipNumber: doc.chipNumber,
    sterilized: doc.sterilized,
    notes: doc.notes,
    vet: doc.vet,
    status: doc.status,
    ...(doc.archivedReason && { archivedReason: doc.archivedReason }),
    ...(doc.archivedAt && { archivedAt: doc.archivedAt.toISOString() }),
    favorite: doc.favorite,
    contacts: doc.contacts.map(({ _id, ...c }) => ({ id: _id.toHexString(), ...c })),
    photos: photos.map((p) => ({ id: p._id.toHexString(), url: p.url, thumbnail: p.thumbnail })),
    photoCount: doc.photos.length,
    ...(latestWeight && { latestWeight: { kg: latestWeight.weightKg, day: latestWeight.day } }),
    // Une alerte dont la dernière pesée a plus de 30 jours n'est plus pertinente (voir refreshWeightAlert).
    ...(doc.weightAlert &&
      daysBetween(doc.weightAlert.latestDay, latestAllowedDay()) <= 31 && {
        weightAlert: { ...doc.weightAlert, detectedAt: doc.weightAlert.detectedAt.toISOString() },
      }),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function weightJson(doc: PetWeightDoc): PetWeight {
  return {
    id: doc._id.toHexString(),
    petId: doc.petId,
    day: doc.day,
    measuredOn: doc.measuredOn.toISOString(),
    weightKg: doc.weightKg,
    note: doc.note,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Dernière pesée de chaque animal (liste et fiche). */
export async function latestWeights(petIds: string[]): Promise<Map<string, PetWeightDoc>> {
  if (!petIds.length) return new Map();
  const rows = await (await petWeights())
    .aggregate<{ _id: string; doc: PetWeightDoc }>([
      { $match: { petId: { $in: petIds } } },
      { $sort: { day: -1 } },
      { $group: { _id: "$petId", doc: { $first: "$$ROOT" } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id, r.doc]));
}

/** Fiche complète renvoyée après une modification. */
export async function fullPetJson(petId: ObjectId): Promise<Pet> {
  const doc = await (await pets()).findOne({ _id: petId });
  if (!doc) throw notFound();
  const latest = (await latestWeights([petId.toHexString()])).get(petId.toHexString());
  return petJson(doc, { latestWeight: latest });
}

/** Moment de la pesée : maintenant si c'est aujourd'hui, sinon midi (UTC) du jour choisi. */
export function measuredOn(day: string, now = new Date()): Date {
  return day === now.toISOString().slice(0, 10) ? now : new Date(`${day}T12:00:00Z`);
}

// ---------------------------------------------------------------------------
// Alerte intelligente de poids
// ---------------------------------------------------------------------------

const MAX_NOTIFIED_KEYS = 50;

/**
 * Recalcule l'alerte de poids après une pesée ajoutée, corrigée ou supprimée (ou une restauration),
 * l'enregistre sur l'animal et notifie le propriétaire (type `sante`) au début d'un épisode
 * ou quand l'alerte s'aggrave.
 */
export async function refreshWeightAlert(petId: ObjectId): Promise<void> {
  const col = await pets();
  const pet = await col.findOne({ _id: petId });
  if (!pet) return;
  const id = petId.toHexString();
  const weights = await (await petWeights())
    .find({ petId: id }, { projection: { day: 1, weightKg: 1 } })
    .toArray();
  const alert = analyzeWeights({
    weights: weights.map((w) => ({ id: w._id.toHexString(), day: w.day, weightKg: w.weightKg })),
    species: pet.species,
    birthDate: pet.birthDate,
    status: pet.status,
    today: latestAllowedDay(),
  });

  if (!alert) {
    if (pet.weightAlert) await col.updateOne({ _id: petId }, { $unset: { weightAlert: "" } });
    return;
  }

  const key = alertKey(id, alert);
  const previous = pet.weightAlert;
  const notify = shouldNotify(id, previous, alert, pet.notifiedAlertKeys ?? []);
  // « Ignorer » vaut pour l'épisode en cours ; une aggravation réaffiche le bandeau.
  const dismissed = notify ? false : (previous?.dismissed ?? false);
  const state: PetAlertDoc = {
    ...alert,
    key,
    dismissed,
    detectedAt: previous?.key === key ? previous.detectedAt : new Date(),
  };
  await col.updateOne(
    { _id: petId },
    {
      $set: {
        weightAlert: state,
        ...(notify && { notifiedAlertKeys: [...(pet.notifiedAlertKeys ?? []), key].slice(-MAX_NOTIFIED_KEYS) }),
      },
    },
  );

  if (notify) {
    const info = WEIGHT_ALERT_INFO[alert.rule];
    const change = `${alert.changePct > 0 ? "+" : ""}${alert.changePct.toLocaleString("fr-FR")} %`;
    await notifyUsers(
      [
        {
          userId: pet.ownerId,
          senderId: pet.ownerId,
          type: "sante",
          title: `${info.title} : ${pet.name}`.slice(0, 120),
          body:
            `${pet.name} est passé de ${formatKg(alert.referenceKg)} à ${formatKg(alert.latestKg)} (${change}). ` +
            `${info.advice} Ce n'est pas un diagnostic.`,
          link: PET_ROUTES.pet(id),
          actionLabel: "Voir la fiche",
        },
      ],
      { includeSelf: true },
    );
  }
}
