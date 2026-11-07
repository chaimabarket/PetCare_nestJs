import type { Appointment, AppointmentStatus } from "./types";

/** Règles métier RG-12 à RG-21, identiques à l'application Flutter. Le serveur les appliquera aussi. */

export const isActive = (status: AppointmentStatus) => status === "planned" || status === "confirmed";

export const isBooking = (a: Appointment) => a.providerId !== undefined;

export const durationMinutes = (a: Appointment) => Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000);

export const hasStarted = (a: Appointment, now = new Date()) => a.startsAt <= now;
export const hasEnded = (a: Appointment, now = new Date()) => a.endsAt <= now;

/** Seule une réservation en attente et pas encore commencée peut être confirmée (RG-16, RG-17). */
export const canConfirm = (a: Appointment, now = new Date()) => a.status === "planned" && !hasStarted(a, now);

/** Report et annulation : seulement avant le début (RG-17). */
export const canReschedule = (a: Appointment, now = new Date()) => isActive(a.status) && !hasStarted(a, now);
export const canCancel = canReschedule;

/** COMPLETED seulement depuis CONFIRMED, après l'heure de fin (RG-19). */
export const canComplete = (a: Appointment, now = new Date()) => a.status === "confirmed" && hasEnded(a, now);

/** Vrai si le rendez-vous chevauche [start, end[. Un créneau qui commence à la fin exacte d'un autre est libre. */
export const overlaps = (a: Appointment, start: Date, end: Date) => a.startsAt < end && start < a.endsAt;

/** Le rendez-vous actif du même animal qui chevauche [start, end[, s'il y en a un (RG-13). */
export function findPetConflict(
  appointments: Appointment[],
  { ownerId, petName, start, end, ignoreId }: { ownerId: string; petName: string; start: Date; end: Date; ignoreId?: string },
) {
  const name = petName.trim().toLowerCase();
  return appointments.find(
    (a) =>
      a.id !== ignoreId &&
      a.ownerId === ownerId &&
      isActive(a.status) &&
      a.petName.trim().toLowerCase() === name &&
      overlaps(a, start, end),
  );
}
