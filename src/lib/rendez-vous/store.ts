"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ApiError, api } from "@/lib/api";
import { addMinutes, formatTime } from "./format";
import { findPetConflict } from "./rules";
import type {
  Appointment,
  AppointmentChange,
  AppointmentPlace,
  AppointmentType,
  PetOption,
  Reminder,
  ReminderCategory,
} from "./types";

/**
 * Données du module Rendez-vous et rappels, stockées dans MongoDB Atlas (collections `appointments`
 * et `reminders`) et lues / modifiées via les routes /api/appointments et /api/reminders.
 *
 * Les pages lisent un cache partagé (`useRdv`) chargé une fois par utilisateur connecté ; chaque action
 * appelle l'API, qui applique les règles métier (src/lib/rendez-vous/rules.ts), puis met le cache à jour.
 */

export type RdvState = {
  appointments: Appointment[];
  reminders: Reminder[];
  /** Animaux du module Mes animaux (pas encore disponible : les noms sont saisis dans les formulaires). */
  pets: PetOption[];
  /** Démonstration : afficher le détail comme le client ou comme le prestataire. */
  viewAs: "client" | "provider";
};

/** Erreur métier affichable telle quelle. */
export class RdvError extends Error {}

let state: RdvState | null = null;
/** Utilisateur dont les données sont en cache (`null` = visiteur, `undefined` = rien de chargé). */
let loadedFor: string | null | undefined;
let viewAs: RdvState["viewAs"] = "client";
const listeners = new Set<() => void>();

/** Identifiant de l'utilisateur connecté (uid Firebase), connu dès que ses données sont chargées. */
export let currentUserId = "";

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(next: RdvState | null) {
  state = next;
  listeners.forEach((listener) => listener());
}

function update(change: (current: RdvState) => Partial<RdvState>) {
  if (state) setState({ ...state, ...change(state) });
}

// Les dates arrivent de l'API au format ISO.
const optionalDate = (value: unknown) => (typeof value === "string" ? new Date(value) : undefined);

function reviveAppointment(raw: Record<string, unknown>): Appointment {
  return {
    ...(raw as unknown as Appointment),
    startsAt: new Date(raw.startsAt as string),
    endsAt: new Date(raw.endsAt as string),
    reminderDoneAt: optionalDate(raw.reminderDoneAt),
    changes: (raw.changes as Record<string, unknown>[]).map(
      (c) =>
        ({
          ...c,
          at: new Date(c.at as string),
          oldStart: optionalDate(c.oldStart),
          newStart: optionalDate(c.newStart),
        }) as AppointmentChange,
    ),
  };
}

function reviveReminder(raw: Record<string, unknown>): Reminder {
  return { ...(raw as unknown as Reminder), dueAt: new Date(raw.dueAt as string), doneAt: optionalDate(raw.doneAt) };
}

async function load(uid: string) {
  try {
    const [appointments, reminders] = await Promise.all([
      api<Record<string, unknown>[]>("/api/appointments"),
      api<Record<string, unknown>[]>("/api/reminders"),
    ]);
    if (loadedFor !== uid) return; // l'utilisateur a changé entre-temps
    setState({ appointments: appointments.map(reviveAppointment), reminders: reminders.map(reviveReminder), pets: [], viewAs });
  } catch (error) {
    if (loadedFor !== uid) return;
    console.error("Chargement de l'agenda impossible :", error);
    setState({ appointments: [], reminders: [], pets: [], viewAs });
  }
}

/** Charge les données de cet utilisateur (une seule fois), ou un agenda vide pour un visiteur. */
function ensureLoaded(uid: string | null) {
  if (loadedFor === uid) return;
  loadedFor = uid;
  currentUserId = uid ?? "";
  if (!uid) {
    setState({ appointments: [], reminders: [], pets: [], viewAs });
    return;
  }
  setState(null);
  void load(uid);
}

/** Les données du module, ou null pendant le chargement. */
export function useRdv(): RdvState | null {
  const { user, loading } = useAuth();
  const uid = loading ? undefined : (user?.uid ?? null);
  useEffect(() => {
    if (uid !== undefined) ensureLoaded(uid);
  }, [uid]);
  const data = useSyncExternalStore(subscribe, () => state, () => null);
  return uid === undefined || loadedFor !== uid ? null : data;
}

export function setViewAs(next: RdvState["viewAs"]) {
  viewAs = next;
  update(() => ({ viewAs: next }));
}

function checkTimes(start: Date, end: Date) {
  if (start <= new Date()) throw new RdvError("Le rendez-vous doit commencer dans le futur.");
  if (end <= start) throw new RdvError("La fin doit être après le début.");
}

function conflictMessage(petName: string, conflict: Appointment) {
  return `${petName.trim()} a déjà « ${conflict.title} » prévu à ${formatTime(conflict.startsAt)}.`;
}

function replaceAppointment(raw: Record<string, unknown>) {
  const next = reviveAppointment(raw);
  update((s) => ({
    appointments: s.appointments.some((a) => a.id === next.id)
      ? s.appointments.map((a) => (a.id === next.id ? next : a))
      : [...s.appointments, next],
  }));
  return next;
}

// ---------------------------------------------------------------------------
// Rendez-vous
// ---------------------------------------------------------------------------

export type PersonalAppointmentInput = {
  pet: PetOption;
  title: string;
  type: AppointmentType;
  startsAt: Date;
  durationMinutes: number;
  place: AppointmentPlace;
  location: string;
  notes: string;
  reminderMinutes: number;
  pushReminder: boolean;
};

/** `POST /api/appointments` : un rendez-vous personnel démarre « Confirmé » (RG-16). Renvoie son identifiant. */
export async function createPersonalAppointment(input: PersonalAppointmentInput): Promise<string> {
  const endsAt = addMinutes(input.startsAt, input.durationMinutes);
  checkTimes(input.startsAt, endsAt);
  if (!input.title.trim()) throw new RdvError("L'intitulé est obligatoire.");
  if (!input.pet.name.trim()) throw new RdvError("Choisissez l'animal concerné.");
  const conflict = findPetConflict(state?.appointments ?? [], {
    ownerId: currentUserId,
    petName: input.pet.name,
    start: input.startsAt,
    end: endsAt,
  });
  if (conflict) throw new RdvError(conflictMessage(input.pet.name, conflict));

  const created = await api<Record<string, unknown>>("/api/appointments", {
    method: "POST",
    body: { ...input, startsAt: input.startsAt.toISOString() },
  });
  return replaceAppointment(created).id;
}

/** `PATCH /api/appointments/:id` avec la version affichée (RG-20) : le serveur vérifie les règles. */
async function transition(shown: Appointment, body: Record<string, unknown>) {
  const updated = await api<Record<string, unknown>>(`/api/appointments/${encodeURIComponent(shown.id)}`, {
    method: "PATCH",
    body: { ...body, version: shown.version },
  });
  replaceAppointment(updated);
}

/** Le prestataire confirme une réservation en attente. */
export async function confirmAppointment(a: Appointment) {
  await transition(a, { action: "confirm" });
}

/** Report avant le début, avec un motif (RG-18). Une réservation repasse « En attente ». */
export async function rescheduleAppointment(a: Appointment, newStart: Date, reason: string) {
  const newEnd = addMinutes(newStart, (a.endsAt.getTime() - a.startsAt.getTime()) / 60_000);
  checkTimes(newStart, newEnd);
  if (reason.trim().length < 3) throw new RdvError("Indiquez le motif du report.");
  if (newStart.getTime() === a.startsAt.getTime()) {
    throw new RdvError("Choisissez un horaire différent de l'horaire actuel.");
  }
  const conflict = findPetConflict(state?.appointments ?? [], {
    ownerId: a.ownerId,
    petName: a.petName,
    start: newStart,
    end: newEnd,
    ignoreId: a.id,
  });
  if (conflict) throw new RdvError(conflictMessage(a.petName, conflict));
  await transition(a, { action: "reschedule", startsAt: newStart.toISOString(), reason: reason.trim() });
}

/** Annulation avant le début (RG-17). CANCELLED est définitif. */
export async function cancelAppointment(a: Appointment, reason: string) {
  await transition(a, { action: "cancel", reason: reason.trim() });
}

/** Termine un rendez-vous confirmé après son heure de fin (RG-19). */
export async function completeAppointment(a: Appointment) {
  await transition(a, { action: "complete" });
}

/** Active ou désactive le rappel (« Me rappeler 1 jour avant »). */
export async function setAppointmentReminder(a: Appointment, minutes: number) {
  await transition(a, { action: "reminder", minutes });
}

/** Bouton « Fait » de la liste des rappels pour un rendez-vous. */
export async function markAppointmentReminderDone(a: Appointment, done: boolean) {
  await transition(a, { action: "reminder-done", done });
}

// ---------------------------------------------------------------------------
// Rappels de soins
// ---------------------------------------------------------------------------

export type ReminderInput = {
  petName: string;
  title: string;
  description: string;
  detail: string;
  category: ReminderCategory;
  dueAt: Date;
};

/** `POST /api/reminders`. */
export async function createReminder(input: ReminderInput) {
  if (!input.petName.trim()) throw new RdvError("Indiquez l'animal concerné.");
  if (!input.title.trim()) throw new RdvError("L'intitulé est obligatoire.");
  const created = await api<Record<string, unknown>>("/api/reminders", {
    method: "POST",
    body: { ...input, dueAt: input.dueAt.toISOString() },
  });
  const reminder = reviveReminder(created);
  update((s) => ({ reminders: [...s.reminders, reminder] }));
}

/** `PATCH /api/reminders/:id` : bouton « Fait » ou annulation du « Fait ». */
export async function setReminderDone(id: string, done: boolean) {
  const updated = reviveReminder(
    await api<Record<string, unknown>>(`/api/reminders/${encodeURIComponent(id)}`, { method: "PATCH", body: { done } }),
  );
  update((s) => ({ reminders: s.reminders.map((r) => (r.id === id ? updated : r)) }));
}

/** `DELETE /api/reminders/:id`. */
export async function deleteReminder(id: string) {
  await api(`/api/reminders/${encodeURIComponent(id)}`, { method: "DELETE" });
  update((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }));
}

/** Message lisible pour l'utilisateur, quelle que soit l'erreur. */
export function errorMessage(error: unknown) {
  if (error instanceof RdvError || error instanceof ApiError) return error.message;
  return "Une erreur est survenue. Réessayez.";
}
