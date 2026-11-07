// Agenda : rendez-vous de l'utilisateur connecté (propriétaire, ou prestataire d'une réservation).
import { ObjectId } from "mongodb";
import { handle, readJson, requireUser } from "@/lib/server/http";
import {
  appointmentJson,
  appointments,
  assertNoConflict,
  checkTimes,
  parsePersonalAppointment,
  type AppointmentDoc,
} from "@/lib/server/rendez-vous";

/** GET /api/appointments — tous mes rendez-vous, du plus ancien au plus récent. */
export async function GET(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const items = await (await appointments())
      .find({ $or: [{ ownerId: uid }, { providerId: uid }] })
      .sort({ startsAt: 1 })
      .toArray();
    return Response.json(items.map(appointmentJson));
  });
}

/** POST /api/appointments — rendez-vous personnel, « Confirmé » dès sa création (RG-16). */
export async function POST(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const fields = parsePersonalAppointment(await readJson(request));
    checkTimes(fields.startsAt, fields.endsAt);
    await assertNoConflict(uid, fields.petName, fields.startsAt, fields.endsAt);

    const now = new Date();
    const doc: AppointmentDoc = {
      _id: new ObjectId(),
      ...fields,
      ownerId: uid,
      status: "confirmed",
      version: 1,
      changes: [{ action: "create", at: now, by: uid }],
    };
    // Les champs facultatifs absents ne sont pas enregistrés.
    if (doc.petId === undefined) delete doc.petId;
    if (doc.petBreed === undefined) delete doc.petBreed;
    await (await appointments()).insertOne(doc);
    return Response.json(appointmentJson(doc), { status: 201 });
  });
}
