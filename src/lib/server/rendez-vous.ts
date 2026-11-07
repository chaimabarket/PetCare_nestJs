// Module Rendez-vous et rappels côté serveur : collections MongoDB `appointments` et `reminders`,
// validation des données reçues et règles métier RG-12 à RG-21 (src/lib/rendez-vous/rules.ts).
import "server-only";
import { ObjectId, type Collection } from "mongodb";
import { addMinutes, formatTime } from "@/lib/rendez-vous/format";
import { findPetConflict, isActive } from "@/lib/rendez-vous/rules";
import {
  PLACE_LABELS,
  REMINDER_CATEGORY_LABELS,
  TYPE_LABELS,
  type Appointment,
  type AppointmentPlace,
  type AppointmentType,
  type Reminder,
  type ReminderCategory,
} from "@/lib/rendez-vous/types";
import { badRequest, HttpError } from "./http";
import { mongo } from "./mongo";

/** Mêmes champs que les types partagés (dates natives), avec l'identifiant MongoDB. */
export type AppointmentDoc = Omit<Appointment, "id"> & { _id: ObjectId };
export type ReminderDoc = Omit<Reminder, "id"> & { _id: ObjectId };

const cache = globalThis as unknown as { _petcareRdvIndexes?: Promise<void> };

async function collection<T extends { _id: ObjectId }>(name: string): Promise<Collection<T>> {
  const db = await mongo();
  cache._petcareRdvIndexes ??= Promise.all([
    db.collection("appointments").createIndex({ ownerId: 1, startsAt: 1 }),
    db.collection("appointments").createIndex({ providerId: 1, startsAt: 1 }),
    db.collection("reminders").createIndex({ ownerId: 1, dueAt: 1 }),
  ])
    .then(() => undefined)
    .catch((error) => {
      cache._petcareRdvIndexes = undefined;
      throw error;
    });
  await cache._petcareRdvIndexes;
  return db.collection<T>(name);
}

export const appointments = () => collection<AppointmentDoc>("appointments");
export const reminders = () => collection<ReminderDoc>("reminders");

/** Document → JSON : `_id` devient `id`, toutes les dates (y compris l'historique) en ISO. */
function serialize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof ObjectId) return value.toHexString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k === "_id" ? "id" : k, serialize(v)]));
  }
  return value;
}
export const appointmentJson = (doc: AppointmentDoc) => serialize(doc);
export const reminderJson = (doc: ReminderDoc) => serialize(doc);

/** Document → objet partagé (dates natives), pour appliquer les règles de rules.ts. */
export const toAppointment = ({ _id, ...rest }: AppointmentDoc): Appointment => ({ ...rest, id: _id.toHexString() });

export const rdvNotFound = () => new HttpError(404, "Ce rendez-vous n'existe plus.");

export function rdvObjectId(id: string, notFound: () => HttpError): ObjectId {
  if (!ObjectId.isValid(id) || id.length !== 24) throw notFound();
  return new ObjectId(id);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function text(value: unknown, label: string, max: number, required = false): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string") throw badRequest(`${label} : valeur invalide.`);
  const clean = value.trim();
  if (required && !clean) throw badRequest(`${label} est obligatoire.`);
  if (clean.length > max) throw badRequest(`${label} : ${max} caractères maximum.`);
  return clean;
}

export function date(value: unknown, label: string): Date {
  const d = typeof value === "string" ? new Date(value) : new Date(NaN);
  if (Number.isNaN(d.getTime())) throw badRequest(`${label} : date invalide.`);
  return d;
}

export function int(value: unknown, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw badRequest(`${label} : nombre entre ${min} et ${max} attendu.`);
  }
  return value as number;
}

export function oneOf<T extends string>(value: unknown, labels: Record<T, string>, label: string): T {
  if (typeof value !== "string" || !(value in labels)) throw badRequest(`${label} : valeur invalide.`);
  return value as T;
}

/** RG-14 / RG-15 : un rendez-vous commence dans le futur et finit après son début. */
export function checkTimes(start: Date, end: Date) {
  if (start <= new Date()) throw badRequest("Le rendez-vous doit commencer dans le futur.");
  if (end <= start) throw badRequest("La fin doit être après le début.");
}

/** RG-13 : pas deux rendez-vous actifs du même animal sur le même créneau. */
export async function assertNoConflict(ownerId: string, petName: string, start: Date, end: Date, ignoreId?: string) {
  const candidates = await (await appointments())
    .find({ ownerId, status: { $in: ["planned", "confirmed"] }, startsAt: { $lt: end }, endsAt: { $gt: start } })
    .toArray();
  const conflict = findPetConflict(candidates.map(toAppointment), { ownerId, petName, start, end, ignoreId });
  if (conflict) {
    throw new HttpError(409, `${petName.trim()} a déjà « ${conflict.title} » prévu à ${formatTime(conflict.startsAt)}.`);
  }
}

/** Champs du formulaire « Nouveau rendez-vous » (rendez-vous personnel). */
export function parsePersonalAppointment(body: Record<string, unknown>) {
  const pet = (body.pet ?? {}) as Record<string, unknown>;
  const startsAt = date(body.startsAt, "Début");
  const durationMinutes = int(body.durationMinutes, "Durée", 5, 24 * 60);
  return {
    petId: pet.id === undefined ? undefined : text(pet.id, "Animal", 128) || undefined,
    petName: text(pet.name, "L'animal", 60, true),
    petBreed: pet.breed === undefined ? undefined : text(pet.breed, "Race", 60) || undefined,
    title: text(body.title, "L'intitulé", 120, true),
    type: oneOf<AppointmentType>(body.type, TYPE_LABELS, "Type"),
    startsAt,
    endsAt: addMinutes(startsAt, durationMinutes),
    place: oneOf<AppointmentPlace>(body.place, PLACE_LABELS, "Lieu"),
    location: text(body.location, "L'adresse", 200),
    notes: text(body.notes, "Les notes", 1000),
    reminderMinutes: int(body.reminderMinutes, "Rappel", 0, 7 * 24 * 60),
    pushReminder: body.pushReminder === true,
  };
}

/** Champs du formulaire « Nouveau rappel ». */
export function parseReminder(body: Record<string, unknown>) {
  return {
    petName: text(body.petName, "L'animal", 60, true),
    title: text(body.title, "L'intitulé", 120, true),
    description: text(body.description, "La description", 500) || undefined,
    detail: text(body.detail, "Le détail", 120) || undefined,
    category: oneOf<ReminderCategory>(body.category, REMINDER_CATEGORY_LABELS, "Catégorie"),
    dueAt: date(body.dueAt, "Échéance"),
  };
}

/** Participants d'un rendez-vous : le propriétaire et, pour une réservation, le prestataire. */
export const isParticipant = (a: AppointmentDoc, uid: string) => a.ownerId === uid || a.providerId === uid;

export { isActive };
