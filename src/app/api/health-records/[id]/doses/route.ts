// Prises d'un traitement : cocher (POST) ou décocher (DELETE) une prise du jour.
import { isValidIsoDate, isValidTime } from "@/lib/health-records";
import { doseTimesForDay, shiftIsoDay } from "@/lib/health-summary";
import { healthRecords, recordNotFound, recordObjectId, requirePetAccess, toHealthRecord, treatmentDoses } from "@/lib/server/health";
import { badRequest, handle, readJson, requireUser } from "@/lib/server/http";
import { latestAllowedDay } from "@/lib/server/pets";

type Ctx = RouteContext<"/api/health-records/[id]/doses">;

/**
 * Vérifie la prise demandée : traitement de l'utilisateur, animal non archivé, heure prévue ce jour-là.
 * Seuls le jour même et la veille sont acceptés. Le serveur ne connaît pas le fuseau de l'utilisateur :
 * il tolère donc de J-2 à J+1 par rapport au jour UTC (le navigateur n'envoie que son jour local).
 */
async function checkDose(uid: string, id: string, day: unknown, time: unknown) {
  if (typeof day !== "string" || !isValidIsoDate(day)) throw badRequest("Jour invalide.");
  if (typeof time !== "string" || !isValidTime(time)) throw badRequest("Heure invalide.");
  const latest = latestAllowedDay();
  if (day > latest || day < shiftIsoDay(latest, -3)) {
    throw badRequest("Seules les prises du jour et de la veille peuvent être notées.");
  }
  const _id = recordObjectId(id);
  const doc = await (await healthRecords()).findOne({ _id, ownerId: uid }, { projection: { attachments: 0 } });
  if (!doc) throw recordNotFound();
  await requirePetAccess(uid, doc.petId, { write: true });
  const record = toHealthRecord({ ...doc, attachments: [] });
  if (record.type !== "traitement") throw badRequest("Seul un traitement a des prises.");
  if (!doseTimesForDay(record, day).includes(time)) throw badRequest("Aucune prise n'est prévue à cette heure ce jour-là.");
  return { recordId: _id.toHexString(), petId: doc.petId, day, time };
}

/** POST /api/health-records/:id/doses { day, time } — note la prise (sans effet si elle l'est déjà). */
export async function POST(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const body = await readJson(request);
    const dose = await checkDose(uid, (await ctx.params).id, body.day, body.time);
    await (await treatmentDoses()).updateOne(
      { recordId: dose.recordId, day: dose.day, time: dose.time },
      { $setOnInsert: { ...dose, ownerId: uid, takenAt: new Date() } },
      { upsert: true },
    );
    return Response.json({ dose: { ...dose, taken: true } }, { status: 201 });
  });
}

/** DELETE /api/health-records/:id/doses?day=…&time=… — annule la prise notée. */
export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const params = new URL(request.url).searchParams;
    const dose = await checkDose(uid, (await ctx.params).id, params.get("day"), params.get("time"));
    await (await treatmentDoses()).deleteOne({ recordId: dose.recordId, day: dose.day, time: dose.time, ownerId: uid });
    return new Response(null, { status: 204 });
  });
}
