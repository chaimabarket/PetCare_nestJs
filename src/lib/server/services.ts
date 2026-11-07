// Module Services côté serveur : collections MongoDB, droits (prestataire, administrateur), validation des
// données reçues, réservations et leur rendez-vous dans l'agenda (module Rendez-vous).
import "server-only";
import { ObjectId, type ClientSession, type Collection } from "mongodb";
import type { AppointmentType } from "@/lib/rendez-vous/types";
import {
  DEFAULT_CATEGORIES,
  firstError,
  validateCategory,
  validateProvider,
  validateService,
  type BookingStatus,
  type CategoryIcon,
  type DayAvailability,
  type ProviderInput,
  type ProviderService,
  type ProviderStatus,
  type ServiceBooking,
  type ServiceCategory,
  type ServiceInput,
  type ServiceProvider,
  EMPTY_WEEK,
} from "@/lib/services-models";
import { badRequest, HttpError, notFound } from "./http";
import { mongo, users } from "./mongo";
import { notifyUsers, type ServerNotification } from "./notify";
import { appointments, type AppointmentDoc } from "./rendez-vous";

// ---------------------------------------------------------------------------
// Documents MongoDB
// ---------------------------------------------------------------------------

export type CategoryDoc = { _id: ObjectId; name: string; icon: CategoryIcon; order: number };

/** Un profil par prestataire (`ownerId` unique = uid Firebase). */
export type ProviderDoc = ProviderInput & {
  _id: ObjectId;
  ownerId: string;
  status: ProviderStatus;
  rejectionReason?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ServiceDoc = ServiceInput & { _id: ObjectId; providerId: string; createdAt: Date; updatedAt: Date };

/** Une disponibilité par prestataire et par jour : `_id` = `{providerId}_{weekday}`. */
export type AvailabilityDoc = DayAvailability & { _id: string; providerId: string };

export type BookingDoc = Omit<ServiceBooking, "id" | "dateTime" | "endsAt" | "createdAt" | "updatedAt"> & {
  _id: ObjectId;
  /** uid Firebase du prestataire (destinataire des notifications, participant du rendez-vous). */
  providerOwnerId: string;
  dateTime: Date;
  endsAt: Date;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const cache = globalThis as unknown as { _petcareServicesIndexes?: Promise<void> };

async function collection<T extends { _id: unknown }>(name: string): Promise<Collection<T>> {
  const db = await mongo();
  cache._petcareServicesIndexes ??= Promise.all([
    db.collection("serviceCategories").createIndex({ order: 1 }),
    db.collection("serviceProviders").createIndex({ ownerId: 1 }, { unique: true }),
    db.collection("serviceProviders").createIndex({ status: 1, category: 1 }),
    db.collection("providerServices").createIndex({ providerId: 1 }),
    db.collection("providerAvailability").createIndex({ providerId: 1 }),
    db.collection("serviceBookings").createIndex({ providerId: 1, dateTime: 1 }),
    db.collection("serviceBookings").createIndex({ clientId: 1, dateTime: -1 }),
    db.collection("serviceBookings").createIndex({ providerOwnerId: 1, dateTime: -1 }),
  ])
    .then(() => undefined)
    .catch((error) => {
      cache._petcareServicesIndexes = undefined;
      throw error;
    });
  await cache._petcareServicesIndexes;
  return db.collection<T>(name);
}

export const categories = () => collection<CategoryDoc>("serviceCategories");
export const providers = () => collection<ProviderDoc>("serviceProviders");
export const services = () => collection<ServiceDoc>("providerServices");
export const availability = () => collection<AvailabilityDoc>("providerAvailability");
export const bookings = () => collection<BookingDoc>("serviceBookings");

// ---------------------------------------------------------------------------
// Conversions JSON
// ---------------------------------------------------------------------------

export function providerJson({ _id, reviewedAt, createdAt, updatedAt, ...rest }: ProviderDoc): ServiceProvider {
  void reviewedAt;
  return { ...rest, id: _id.toHexString(), createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
}

export function serviceJson({ _id, createdAt, updatedAt, ...rest }: ServiceDoc): ProviderService {
  return { ...rest, id: _id.toHexString(), createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
}

export function bookingJson({ _id, providerOwnerId, decidedAt, dateTime, endsAt, createdAt, updatedAt, ...rest }: BookingDoc): ServiceBooking {
  void providerOwnerId;
  void decidedAt;
  return {
    ...rest,
    id: _id.toHexString(),
    dateTime: dateTime.toISOString(),
    endsAt: endsAt.toISOString(),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

const categoryJson = ({ _id, ...rest }: CategoryDoc): ServiceCategory => ({ ...rest, id: _id.toHexString() });

// ---------------------------------------------------------------------------
// Droits
// ---------------------------------------------------------------------------

export function objectId(id: string, onInvalid: () => HttpError = notFound): ObjectId {
  if (!ObjectId.isValid(id) || id.length !== 24) throw onInvalid();
  return new ObjectId(id);
}

export async function userRole(uid: string) {
  return (await (await users()).findOne({ _id: uid }, { projection: { role: 1 } }))?.role;
}

export async function requireAdmin(uid: string): Promise<void> {
  if ((await userRole(uid)) !== "admin") throw new HttpError(403, "Réservé aux administrateurs.");
}

export async function requireProviderRole(uid: string): Promise<void> {
  if ((await userRole(uid)) !== "prestataire") {
    throw new HttpError(403, "Seul un compte prestataire peut proposer des services.");
  }
}

/** Le profil prestataire de l'utilisateur connecté (404 s'il n'en a pas encore). */
export async function findMyProvider(uid: string): Promise<ProviderDoc> {
  const provider = await (await providers()).findOne({ ownerId: uid });
  if (!provider) throw new HttpError(404, "Créez d'abord votre profil prestataire.");
  return provider;
}

// ---------------------------------------------------------------------------
// Catégories : celles de l'administrateur, sinon les catégories par défaut
// ---------------------------------------------------------------------------

export async function listCategories(): Promise<ServiceCategory[]> {
  const saved = await (await categories()).find().sort({ order: 1, name: 1 }).toArray();
  return saved.length ? saved.map(categoryJson) : DEFAULT_CATEGORIES;
}

/** Avant la première modification par l'administrateur, enregistre les catégories par défaut. */
export async function ensureCategoriesSaved(): Promise<void> {
  const col = await categories();
  if (await col.countDocuments({}, { limit: 1 })) return;
  await col.insertMany(DEFAULT_CATEGORIES.map(({ name, icon, order }) => ({ _id: new ObjectId(), name, icon, order })));
}

/** Catégorie par identifiant ; accepte un identifiant `default-…` (catégorie par défaut, désormais enregistrée). */
export async function findCategory(id: string): Promise<CategoryDoc> {
  const col = await categories();
  const fallback = DEFAULT_CATEGORIES.find((c) => c.id === id);
  const category = fallback ? await col.findOne({ name: fallback.name }) : await col.findOne({ _id: objectId(id) });
  if (!category) throw new HttpError(404, "Catégorie introuvable.");
  return category;
}

/** Vérifie que la catégorie existe et renvoie son icône. */
export async function requireCategory(name: string): Promise<CategoryIcon> {
  const found = (await listCategories()).find((c) => c.name === name);
  if (!found) throw badRequest(`La catégorie « ${name} » n'existe pas.`);
  return found.icon;
}

export function parseCategory(raw: unknown) {
  const { value, errors } = validateCategory(raw);
  const error = firstError(errors);
  if (error) throw badRequest(error);
  return value;
}

// ---------------------------------------------------------------------------
// Validation des données reçues
// ---------------------------------------------------------------------------

const PROVIDER_KEYS = ["name", "category", "city", "description", "phone", "email", "address", "photo"];
const SERVICE_KEYS = ["name", "category", "durationMinutes", "price", "description", "status"];
const MAX_PHOTO_LENGTH = 600_000;

function onlyKeys(body: Record<string, unknown>, keys: string[]) {
  const unknown = Object.keys(body).find((k) => !keys.includes(k));
  if (unknown) throw badRequest(`Le champ « ${unknown} » n'est pas autorisé.`);
}

export async function parseProvider(body: Record<string, unknown>): Promise<ProviderInput> {
  onlyKeys(body, PROVIDER_KEYS);
  const { value, errors } = validateProvider(body);
  const error = firstError(errors);
  if (error) throw new HttpError(400, error, errors);
  if (value.photo && (value.photo.length > MAX_PHOTO_LENGTH || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value.photo))) {
    throw badRequest("Photo invalide ou trop lourde.");
  }
  await requireCategory(value.category);
  return value;
}

export async function parseService(body: Record<string, unknown>): Promise<ServiceInput> {
  onlyKeys(body, SERVICE_KEYS);
  const { value, errors } = validateService(body);
  const error = firstError(errors);
  if (error) throw new HttpError(400, error, errors);
  await requireCategory(value.category);
  return value;
}

export async function getAvailability(providerId: string): Promise<DayAvailability[]> {
  const saved = await (await availability()).find({ providerId }).toArray();
  return EMPTY_WEEK.map((d) => {
    const day = saved.find((s) => s.weekday === d.weekday);
    return day ? { weekday: day.weekday, enabled: day.enabled, ranges: day.ranges } : d;
  });
}

// ---------------------------------------------------------------------------
// Réservations et agenda (module Rendez-vous)
// ---------------------------------------------------------------------------

/** Type de rendez-vous de l'agenda selon l'icône de la catégorie. */
const APPOINTMENT_TYPES: Partial<Record<CategoryIcon, AppointmentType>> = {
  veterinaire: "veterinaire",
  toilettage: "toilettage",
  education: "education",
  promenade: "garde",
  pension: "garde",
};

/**
 * Crée la demande de réservation et son rendez-vous dans l'agenda du client et du prestataire
 * (« En attente » = `planned`, `providerId` = uid du prestataire), en une transaction.
 * Équivalent du `createBooking` prévu par le module Rendez-vous, écrit ici sans modifier ce module.
 */
export async function createBooking(
  booking: Omit<BookingDoc, "_id" | "appointmentId" | "createdAt" | "updatedAt" | "status">,
  provider: ProviderDoc,
  categoryIcon: CategoryIcon,
  session: ClientSession,
): Promise<BookingDoc> {
  const now = new Date();
  const appointment: AppointmentDoc = {
    _id: new ObjectId(),
    ownerId: booking.clientId,
    ...(booking.petId && { petId: booking.petId }),
    petName: booking.animalName,
    title: `${booking.serviceName} — ${provider.name}`.slice(0, 120),
    description: booking.notes || undefined,
    type: APPOINTMENT_TYPES[categoryIcon] ?? "autre",
    startsAt: booking.dateTime,
    endsAt: booking.endsAt,
    status: "planned",
    providerId: provider.ownerId,
    providerName: provider.name,
    providerAddress: [provider.address, provider.city].filter(Boolean).join(", "),
    providerPhone: provider.phone,
    serviceId: booking.serviceId,
    price: booking.price,
    place: "exterieur",
    location: [provider.address, provider.city].filter(Boolean).join(", "),
    notes: booking.notes,
    reminderMinutes: 60,
    pushReminder: false,
    version: 1,
    changes: [{ action: "create", at: now, by: booking.clientId }],
  };
  if (appointment.description === undefined) delete appointment.description;
  const doc: BookingDoc = { ...booking, _id: new ObjectId(), status: "pending", appointmentId: appointment._id.toHexString(), createdAt: now, updatedAt: now };
  await (await appointments()).insertOne(appointment, { session });
  await (await bookings()).insertOne(doc, { session });
  return doc;
}

/** Répercute un changement de statut de la réservation sur son rendez-vous (s'il est encore en attente). */
export async function updateBookingAppointment(
  booking: BookingDoc,
  status: BookingStatus,
  by: string,
  session: ClientSession,
): Promise<void> {
  if (!booking.appointmentId || !ObjectId.isValid(booking.appointmentId)) return;
  const now = new Date();
  const confirmed = status === "confirmed";
  const reason = status === "declined" ? "Demande refusée par le prestataire" : "Demande annulée par le client";
  await (await appointments()).updateOne(
    { _id: new ObjectId(booking.appointmentId), status: "planned" },
    {
      $set: { status: confirmed ? "confirmed" : "cancelled", ...(!confirmed && { cancelReason: reason }) },
      $inc: { version: 1 },
      $push: { changes: { action: confirmed ? "confirm" : "cancel", at: now, by, ...(!confirmed && { reason }) } },
    },
    { session },
  );
}

/**
 * Le rendez-vous peut aussi être confirmé ou annulé depuis l'agenda : on aligne les réservations en attente
 * sur leur rendez-vous (confirmé → confirmée ; annulé par le prestataire → refusée, par le client → annulée).
 */
export async function syncFromAgenda(list: BookingDoc[]): Promise<BookingDoc[]> {
  const pending = list.filter((b) => b.status === "pending" && b.appointmentId && ObjectId.isValid(b.appointmentId));
  if (!pending.length) return list;
  const docs = await (await appointments())
    .find({ _id: { $in: pending.map((b) => new ObjectId(b.appointmentId!)) }, status: { $in: ["confirmed", "cancelled", "completed"] } })
    .toArray();
  if (!docs.length) return list;
  const col = await bookings();
  const updated = new Map<string, BookingDoc>();
  for (const appointment of docs) {
    const booking = pending.find((b) => b.appointmentId === appointment._id.toHexString())!;
    const lastBy = appointment.changes[appointment.changes.length - 1]?.by;
    const status: BookingStatus =
      appointment.status === "cancelled" ? (lastBy === booking.providerOwnerId ? "declined" : "cancelled") : "confirmed";
    const now = new Date();
    const result = await col.findOneAndUpdate(
      { _id: booking._id, status: "pending" },
      { $set: { status, decidedAt: now, updatedAt: now } },
      { returnDocument: "after" },
    );
    if (result) updated.set(result._id.toHexString(), result);
  }
  return list.map((b) => updated.get(b._id.toHexString()) ?? b);
}

// ---------------------------------------------------------------------------
// Notifications (type `service`)
// ---------------------------------------------------------------------------

export function notifyService(list: Omit<ServerNotification, "type">[]): Promise<void> {
  return notifyUsers(list.map((n) => ({ ...n, type: "service" })));
}

/** 409 commun quand une réservation n'est plus en attente. */
export const notPending = () => new HttpError(409, "Cette réservation n'est plus en attente : son statut ne peut plus changer.");
