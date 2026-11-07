// Changement de statut d'une réservation : le prestataire confirme ou refuse, le client annule.
import { BOOKING_STATUSES, canChangeBooking, formatDateTime, SERVICES_ROUTES, type BookingStatus } from "@/lib/services-models";
import { badRequest, handle, HttpError, notFound, readJson, requireUser } from "@/lib/server/http";
import { withTransaction } from "@/lib/server/mongo";
import { bookingJson, bookings, notifyService, notPending, objectId, syncFromAgenda, updateBookingAppointment } from "@/lib/server/services";

const MESSAGES: Record<Exclude<BookingStatus, "pending">, { title: string; verb: string }> = {
  confirmed: { title: "Réservation confirmée", verb: "a confirmé" },
  declined: { title: "Réservation refusée", verb: "a refusé" },
  cancelled: { title: "Réservation annulée", verb: "a annulé" },
};

/**
 * PATCH /api/services/bookings/:id/status — `{ status }` : `confirmed` ou `declined` (prestataire),
 * `cancelled` (client). Seule une demande en attente peut changer de statut (409 sinon).
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/services/bookings/[id]/status">) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const _id = objectId((await ctx.params).id);
    const col = await bookings();
    const found = await col.findOne({ _id });
    if (!found || (found.clientId !== uid && found.providerOwnerId !== uid)) throw notFound();
    const [booking] = await syncFromAgenda([found]); // un changement fait depuis l'agenda compte aussi
    const status = (await readJson(request)).status as BookingStatus;
    if (!BOOKING_STATUSES.includes(status) || status === "pending") throw badRequest("Statut inconnu.");

    const actor = booking.providerOwnerId === uid ? "provider" : "client";
    if (booking.status !== "pending") throw notPending();
    if (!canChangeBooking(booking.status, status, actor)) {
      throw new HttpError(403, actor === "client" ? "Seul le prestataire confirme ou refuse une demande." : "Seul le client annule sa demande.");
    }
    if (status === "confirmed" && booking.dateTime <= new Date()) {
      throw new HttpError(409, "La date de cette demande est passée : elle ne peut plus être confirmée.");
    }

    const now = new Date();
    const updated = await withTransaction(async (session) => {
      const result = await col.findOneAndUpdate(
        { _id, status: "pending" },
        { $set: { status, decidedAt: now, updatedAt: now } },
        { returnDocument: "after", session },
      );
      if (!result) throw notPending();
      await updateBookingAppointment(result, status, uid, session);
      return result;
    });

    const message = MESSAGES[status];
    const author = actor === "provider" ? updated.providerName : updated.clientName;
    await notifyService([
      {
        userId: actor === "provider" ? updated.clientId : updated.providerOwnerId,
        senderId: uid,
        title: `${message.title} : ${updated.serviceName}`.slice(0, 120),
        body: `${author} ${message.verb} « ${updated.serviceName} » pour ${updated.animalName} le ${formatDateTime(updated.dateTime)}.`,
        link: actor === "provider" ? SERVICES_ROUTES.myBookings : `${SERVICES_ROUTES.mySpace}#demandes`,
        actionLabel: actor === "provider" ? "Mes réservations" : "Voir les demandes",
      },
    ]);
    return Response.json(bookingJson(updated));
  });
}
