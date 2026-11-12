// Un rendez-vous : confirmer, reporter, annuler, terminer, régler le rappel.
// Chaque action vérifie la version affichée (RG-20) et les règles de src/lib/rendez-vous/rules.ts.
import type { UpdateFilter } from "mongodb";
import { addMinutes } from "@/lib/rendez-vous/format";
import { canCancel, canComplete, canConfirm, canReschedule, isActive, isBooking } from "@/lib/rendez-vous/rules";
import type { AppointmentAction } from "@/lib/rendez-vous/types";
import { badRequest, forbidden, handle, HttpError, readJson, requireUser } from "@/lib/server/http";
import {
  appointmentJson,
  appointments,
  assertNoConflict,
  checkTimes,
  date,
  int,
  isParticipant,
  rdvNotFound,
  rdvObjectId,
  text,
  toAppointment,
  type AppointmentDoc,
} from "@/lib/server/rendez-vous";

type Ctx = RouteContext<"/api/appointments/[id]">;

const staleVersion = () =>
  new HttpError(409, "Ce rendez-vous vient d'être modifié par quelqu'un d'autre. Vérifiez-le puis recommencez.");

/**
 * `{ action, version, … }` :
 * - `confirm` (prestataire) ;
 * - `reschedule` `{ startsAt, reason }` ; `cancel` `{ reason? }` ; `complete` ;
 * - `reminder` `{ minutes }` (activer / désactiver le rappel) ; `reminder-done` `{ done }` (bouton « Fait »).
 */
export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const _id = rdvObjectId((await ctx.params).id, rdvNotFound);
    const body = await readJson(request);
    const col = await appointments();
    const doc = await col.findOne({ _id });
    if (!doc || !isParticipant(doc, uid)) throw rdvNotFound();
    if (body.version !== doc.version) throw staleVersion();

    const current = toAppointment(doc);
    const now = new Date();
    let set: Partial<AppointmentDoc> = {};
    const unset: Record<string, ""> = {};
    let history: { action: AppointmentAction; reason?: string; oldStart?: Date; newStart?: Date } | undefined;

    switch (body.action) {
      case "confirm":
        if (doc.providerId !== uid) throw forbidden();
        if (!canConfirm(current, now)) throw badRequest("Ce rendez-vous ne peut plus être confirmé.");
        set = { status: "confirmed" };
        history = { action: "confirm" };
        break;

      case "reschedule": {
        if (!canReschedule(current, now)) {
          throw badRequest("Ce rendez-vous ne peut plus être reporté : il a commencé ou est terminé.");
        }
        const newStart = date(body.startsAt, "Nouvel horaire");
        const newEnd = addMinutes(newStart, (doc.endsAt.getTime() - doc.startsAt.getTime()) / 60_000);
        const reason = text(body.reason, "Le motif", 300);
        checkTimes(newStart, newEnd);
        if (reason.length < 3) throw badRequest("Indiquez le motif du report.");
        if (newStart.getTime() === doc.startsAt.getTime()) {
          throw badRequest("Choisissez un horaire différent de l'horaire actuel.");
        }
        await assertNoConflict(doc.ownerId, doc.petName, newStart, newEnd, current.id);
        // Une réservation repasse « En attente » (RG-18) ; le rappel est recalculé (RG-21).
        set = { startsAt: newStart, endsAt: newEnd, status: isBooking(current) ? "planned" : "confirmed" };
        unset.reminderDoneAt = "";
        history = { action: "reschedule", reason, oldStart: doc.startsAt, newStart };
        break;
      }

      case "cancel": {
        if (!canCancel(current, now)) throw badRequest("Ce rendez-vous ne peut plus être annulé : il a déjà commencé.");
        const reason = text(body.reason, "Le motif", 300) || undefined;
        set = { status: "cancelled", ...(reason && { cancelReason: reason }) };
        history = { action: "cancel", ...(reason && { reason }) };
        break;
      }

      case "complete":
        if (!canComplete(current, now)) {
          throw badRequest("Un rendez-vous se termine après son heure de fin, s'il était confirmé.");
        }
        set = { status: "completed" };
        history = { action: "complete" };
        break;

      case "reminder":
        if (doc.ownerId !== uid) throw forbidden();
        if (!isActive(doc.status)) throw badRequest("Ce rendez-vous est terminé ou annulé.");
        set = { reminderMinutes: int(body.minutes, "Rappel", 0, 7 * 24 * 60) };
        unset.reminderDoneAt = "";
        break;

      case "reminder-done":
        if (doc.ownerId !== uid) throw forbidden();
        if (body.done === true) set = { reminderDoneAt: now };
        else unset.reminderDoneAt = "";
        break;

      default:
        throw badRequest("Action inconnue.");
    }

    const update: UpdateFilter<AppointmentDoc> = { $set: set, $inc: { version: 1 } };
    if (Object.keys(unset).length) update.$unset = unset;
    if (history) update.$push = { changes: { ...history, at: now, by: uid } };
    // Mise à jour seulement si personne n'a modifié le rendez-vous entre-temps (RG-20).
    const updated = await col.findOneAndUpdate({ _id, version: doc.version }, update, { returnDocument: "after" });
    if (!updated) throw staleVersion();
    return Response.json(appointmentJson(updated));
  });
}
