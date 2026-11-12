// Réservations de services : liste (client ou prestataire) et nouvelle demande.
import type { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { fitsAvailability, firstError, formatDateTime, SERVICES_ROUTES, validateBooking } from "@/lib/services-models";
import { badRequest, handle, HttpError, notFound, readJson, requireUser } from "@/lib/server/http";
import { users, withTransaction } from "@/lib/server/mongo";
import { pets } from "@/lib/server/pets";
import { assertNoConflict } from "@/lib/server/rendez-vous";
import {
  bookingJson,
  bookings,
  createBooking,
  getAvailability,
  notifyService,
  providers,
  requireCategory,
  services,
  syncFromAgenda,
} from "@/lib/server/services";

/** GET /api/services/bookings?as=client|provider — ses réservations (client) ou les demandes reçues (prestataire). */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const as = request.nextUrl.searchParams.get("as");
    if (as !== "client" && as !== "provider") throw badRequest("Paramètre « as » attendu : client ou provider.");
    const list = await (await bookings())
      .find(as === "client" ? { clientId: uid } : { providerOwnerId: uid })
      .sort({ dateTime: -1 })
      .toArray();
    return Response.json((await syncFromAgenda(list)).map(bookingJson));
  });
}

/**
 * POST /api/services/bookings — `{ serviceId, dateTime, animalName, petId?, notes }` : demande de réservation
 * (en attente), ajoutée à l'agenda du client et du prestataire ; le prestataire est notifié.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const body = await readJson(request);
    const unknown = Object.keys(body).find((k) => !["serviceId", "dateTime", "animalName", "petId", "notes"].includes(k));
    if (unknown) throw badRequest(`Le champ « ${unknown} » n'est pas autorisé.`);
    const { value, errors } = validateBooking(body);
    const error = firstError(errors);
    if (error) throw new HttpError(400, error, errors);

    if (!ObjectId.isValid(value.serviceId) || value.serviceId.length !== 24) throw notFound();
    const service = await (await services()).findOne({ _id: new ObjectId(value.serviceId), status: "published" });
    if (!service) throw new HttpError(404, "Cette prestation n'est plus proposée.");
    const provider = await (await providers()).findOne({ _id: new ObjectId(service.providerId), status: "published" });
    if (!provider) throw new HttpError(404, "Ce prestataire n'est plus disponible.");
    if (provider.ownerId === uid) throw badRequest("Vous ne pouvez pas réserver vos propres services.");

    if (value.petId) {
      const pet = ObjectId.isValid(value.petId) && value.petId.length === 24
        ? await (await pets()).findOne({ _id: new ObjectId(value.petId), ownerId: uid, status: { $ne: "archived" } })
        : null;
      if (!pet) throw badRequest("Animal introuvable dans « Mes animaux ».");
    }

    const start = new Date(value.dateTime);
    const end = new Date(start.getTime() + service.durationMinutes * 60_000);
    const providerId = provider._id.toHexString();
    if (!fitsAvailability(start, service.durationMinutes, await getAvailability(providerId))) {
      throw badRequest("Ce créneau n'est pas dans les disponibilités du prestataire.");
    }
    const taken = await (await bookings()).countDocuments(
      { providerId, status: { $in: ["pending", "confirmed"] }, dateTime: { $lt: end }, endsAt: { $gt: start } },
      { limit: 1 },
    );
    if (taken) throw new HttpError(409, "Ce créneau vient d'être réservé : choisissez-en un autre.");
    // RG-13 du module Rendez-vous : pas deux rendez-vous du même animal sur le même créneau.
    await assertNoConflict(uid, value.animalName, start, end);

    const client = await (await users()).findOne({ _id: uid }, { projection: { displayName: 1 } });
    if (!client) throw badRequest("Complétez votre profil avant de réserver.");
    const icon = await requireCategory(service.category).catch(() => "autre" as const);

    const booking = await withTransaction((session) =>
      createBooking(
        {
          providerId,
          providerOwnerId: provider.ownerId,
          clientId: uid,
          clientName: client.displayName,
          providerName: provider.name,
          serviceId: service._id.toHexString(),
          serviceName: service.name,
          durationMinutes: service.durationMinutes,
          price: service.price,
          animalName: value.animalName,
          ...(value.petId && { petId: value.petId }),
          dateTime: start,
          endsAt: end,
          notes: value.notes,
        },
        provider,
        icon,
        session,
      ),
    );
    await notifyService([
      {
        userId: provider.ownerId,
        senderId: uid,
        title: `Nouvelle demande : ${service.name}`.slice(0, 120),
        body: `${client.displayName} souhaite réserver « ${service.name} » pour ${value.animalName} le ${formatDateTime(start)}.`,
        link: `${SERVICES_ROUTES.mySpace}#demandes`,
        actionLabel: "Répondre",
      },
    ]);
    return Response.json(bookingJson(booking), { status: 201 });
  });
}
