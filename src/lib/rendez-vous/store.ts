"use client";

import { useSyncExternalStore } from "react";
import { addMinutes, formatTime } from "./format";
import { CURRENT_USER_ID, MOCK_PETS, createMockData } from "./mock-data";
import { canCancel, canComplete, canConfirm, canReschedule, findPetConflict, isActive, isBooking } from "./rules";
import type {
  Appointment,
  AppointmentAction,
  AppointmentPlace,
  AppointmentType,
  PetOption,
  Reminder,
  ReminderCategory,
} from "./types";

/**
 * Données du module en mémoire (version statique, en attendant l'API MongoDB).
 *
 * Chaque action reprend une route de la future API (`POST /api/appointments/:id/confirm`…) et
 * vérifie les mêmes règles : pour brancher MongoDB, on remplacera le corps de ces fonctions par
 * des appels à `src/lib/api.ts`, sans toucher aux pages. Tout est perdu au rechargement de la page.
 */

export type RdvState = {
  appointments: Appointment[];
  reminders: Reminder[];
  pets: PetOption[];
  /** Démonstration : afficher le détail comme le client ou comme le prestataire. */
  viewAs: "client" | "provider";
};

/** Erreur métier affichable telle quelle (la future API renverra `{ "error": "…" }`). */
export class RdvError extends Error {}

let state: RdvState | null = null;
const listeners = new Set<() => void>();

// Créé au premier affichage dans le navigateur : les dates dépendent de l'heure actuelle.
function snapshot(): RdvState {
  state ??= { ...createMockData(new Date()), pets: MOCK_PETS, viewAs: "client" };
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function update(change: (current: RdvState) => Partial<RdvState>) {
  const current = snapshot();
  state = { ...current, ...change(current) };
  listeners.forEach((listener) => listener());
}

/** Les données du module, ou null pendant le rendu serveur (le temps que la page s'affiche). */
export function useRdv(): RdvState | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

export const currentUserId = CURRENT_USER_ID;

export function setViewAs(viewAs: RdvState["viewAs"]) {
  update(() => ({ viewAs }));
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

function checkTimes(start: Date, end: Date) {
  if (start <= new Date()) throw new RdvError("Le rendez-vous doit commencer dans le futur.");
  if (end <= start) throw new RdvError("La fin doit être après le début.");
}

function conflictMessage(petName: string, conflict: Appointment) {
  return `${petName.trim()} a déjà « ${conflict.title} » prévu à ${formatTime(conflict.startsAt)}.`;
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

/** Futur `POST /api/appointments` : un rendez-vous personnel démarre « Confirmé » (RG-16). */
export function createPersonalAppointment(input: PersonalAppointmentInput): string {
  const endsAt = addMinutes(input.startsAt, input.durationMinutes);
  checkTimes(input.startsAt, endsAt);
  if (!input.title.trim()) throw new RdvError("L'intitulé est obligatoire.");
  if (!input.pet.name.trim()) throw new RdvError("Choisissez l'animal concerné.");

  const conflict = findPetConflict(snapshot().appointments, {
    ownerId: CURRENT_USER_ID,
    petName: input.pet.name,
    start: input.startsAt,
    end: endsAt,
  });
  if (conflict) throw new RdvError(conflictMessage(input.pet.name, conflict));

  const id = newId("rdv");
  const appointment: Appointment = {
    id,
    ownerId: CURRENT_USER_ID,
    petId: input.pet.id,
    petName: input.pet.name.trim(),
    petBreed: input.pet.breed,
    title: input.title.trim(),
    type: input.type,
    startsAt: input.startsAt,
    endsAt,
    status: "confirmed",
    place: input.place,
    location: input.location.trim(),
    notes: input.notes.trim(),
    reminderMinutes: input.reminderMinutes,
    pushReminder: input.pushReminder,
    version: 1,
    changes: [{ action: "create", at: new Date(), by: CURRENT_USER_ID }],
  };
  update((s) => ({ appointments: [...s.appointments, appointment] }));
  return id;
}

/**
 * Applique une modification si la version affichée est toujours la bonne (RG-20)
 * et si la règle `check` l'autorise. Ajoute la ligne d'historique et augmente la version.
 */
function transition(
  shown: Appointment,
  check: (current: Appointment) => string | null,
  changes: (current: Appointment) => Partial<Appointment>,
  history?: { action: AppointmentAction; reason?: string; oldStart?: Date; newStart?: Date },
) {
  const current = snapshot().appointments.find((a) => a.id === shown.id);
  if (!current) throw new RdvError("Ce rendez-vous n'existe plus.");
  if (current.version !== shown.version) {
    throw new RdvError("Ce rendez-vous vient d'être modifié par quelqu'un d'autre. Vérifiez-le puis recommencez.");
  }
  const error = check(current);
  if (error) throw new RdvError(error);

  const by = snapshot().viewAs === "provider" && current.providerId ? current.providerId : CURRENT_USER_ID;
  const next: Appointment = {
    ...current,
    ...changes(current),
    version: current.version + 1,
    changes: history ? [...current.changes, { ...history, at: new Date(), by }] : current.changes,
  };
  update((s) => ({ appointments: s.appointments.map((a) => (a.id === next.id ? next : a)) }));
}

/** Le prestataire confirme une réservation en attente. */
export function confirmAppointment(a: Appointment) {
  transition(a, (c) => (canConfirm(c) ? null : "Ce rendez-vous ne peut plus être confirmé."), () => ({ status: "confirmed" }), {
    action: "confirm",
  });
}

/** Report avant le début, avec un motif (RG-18). Une réservation repasse « En attente ». */
export function rescheduleAppointment(a: Appointment, newStart: Date, reason: string) {
  const newEnd = addMinutes(newStart, (a.endsAt.getTime() - a.startsAt.getTime()) / 60_000);
  checkTimes(newStart, newEnd);
  if (reason.trim().length < 3) throw new RdvError("Indiquez le motif du report.");
  if (newStart.getTime() === a.startsAt.getTime()) {
    throw new RdvError("Choisissez un horaire différent de l'horaire actuel.");
  }
  const conflict = findPetConflict(snapshot().appointments, {
    ownerId: a.ownerId,
    petName: a.petName,
    start: newStart,
    end: newEnd,
    ignoreId: a.id,
  });
  if (conflict) throw new RdvError(conflictMessage(a.petName, conflict));

  transition(
    a,
    (c) => (canReschedule(c) ? null : "Ce rendez-vous ne peut plus être reporté : il a commencé ou est terminé."),
    (c) => ({
      startsAt: newStart,
      endsAt: newEnd,
      status: isBooking(c) ? "planned" : "confirmed",
      // Le rappel est recalculé pour le nouvel horaire (RG-21).
      reminderDoneAt: undefined,
    }),
    { action: "reschedule", reason: reason.trim(), oldStart: a.startsAt, newStart },
  );
}

/** Annulation avant le début (RG-17). CANCELLED est définitif. */
export function cancelAppointment(a: Appointment, reason: string) {
  const clean = reason.trim() || undefined;
  transition(
    a,
    (c) => (canCancel(c) ? null : "Ce rendez-vous ne peut plus être annulé : il a déjà commencé."),
    () => ({ status: "cancelled", cancelReason: clean }),
    { action: "cancel", reason: clean },
  );
}

/** Termine un rendez-vous confirmé après son heure de fin (RG-19). */
export function completeAppointment(a: Appointment) {
  transition(
    a,
    (c) => (canComplete(c) ? null : "Un rendez-vous se termine après son heure de fin, s'il était confirmé."),
    () => ({ status: "completed" }),
    { action: "complete" },
  );
}

/** Active ou désactive le rappel (« Me rappeler 1 jour avant »). */
export function setAppointmentReminder(a: Appointment, minutes: number) {
  transition(
    a,
    (c) => (isActive(c.status) ? null : "Ce rendez-vous est terminé ou annulé."),
    () => ({ reminderMinutes: minutes, reminderDoneAt: undefined }),
  );
}

/** Bouton « Fait » de la liste des rappels pour un rendez-vous. */
export function markAppointmentReminderDone(a: Appointment, done: boolean) {
  transition(a, () => null, () => ({ reminderDoneAt: done ? new Date() : undefined }));
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

/** Futur `POST /api/reminders`. */
export function createReminder(input: ReminderInput) {
  if (!input.petName.trim()) throw new RdvError("Indiquez l'animal concerné.");
  if (!input.title.trim()) throw new RdvError("L'intitulé est obligatoire.");
  const pet = snapshot().pets.find((p) => p.name.toLowerCase() === input.petName.trim().toLowerCase());
  const reminder: Reminder = {
    id: newId("rap"),
    ownerId: CURRENT_USER_ID,
    petName: input.petName.trim(),
    petBreed: pet?.breed,
    title: input.title.trim(),
    description: input.description.trim() || undefined,
    detail: input.detail.trim() || undefined,
    category: input.category,
    dueAt: input.dueAt,
    done: false,
  };
  update((s) => ({ reminders: [...s.reminders, reminder] }));
}

/** Futur `PATCH /api/reminders/:id` : bouton « Fait » ou annulation du « Fait ». */
export function setReminderDone(id: string, done: boolean) {
  update((s) => ({
    reminders: s.reminders.map((r) => (r.id === id ? { ...r, done, doneAt: done ? new Date() : undefined } : r)),
  }));
}

/** Futur `DELETE /api/reminders/:id`. */
export function deleteReminder(id: string) {
  update((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }));
}

/** Message lisible pour l'utilisateur, quelle que soit l'erreur. */
export function errorMessage(error: unknown) {
  return error instanceof RdvError ? error.message : "Une erreur est survenue. Réessayez.";
}
