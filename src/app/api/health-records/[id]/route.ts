// Un acte médical : lecture, modification et suppression (propriétaire uniquement ; lecture seule si l'animal est archivé).
import { ATTACHMENTS_MAX_COUNT } from "@/lib/health-records";
import {
  healthRecords,
  LIST_PROJECTION,
  parseNewAttachments,
  recordFields,
  recordNotFound,
  recordObjectId,
  requirePetAccess,
  syncVaccineReminder,
  toHealthRecord,
  treatmentDoses,
} from "@/lib/server/health";
import { badRequest, handle, readJson, requireUser } from "@/lib/server/http";

type Ctx = RouteContext<"/api/health-records/[id]">;

/** GET /api/health-records/:id — détail d'un acte. */
export async function GET(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const _id = recordObjectId((await ctx.params).id);
    const doc = await (await healthRecords()).findOne({ _id, ownerId: uid }, { projection: LIST_PROJECTION });
    if (!doc) throw recordNotFound();
    await requirePetAccess(uid, doc.petId);
    return Response.json({ record: toHealthRecord(doc) });
  });
}

/**
 * PUT /api/health-records/:id — modifie un acte.
 * Pièces jointes : `keepAttachmentIds` (celles à conserver) + `newAttachments` (à ajouter).
 */
export async function PUT(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const _id = recordObjectId((await ctx.params).id);
    const body = await readJson(request);
    const fields = recordFields(body);
    const added = parseNewAttachments(body.newAttachments);
    const keep = Array.isArray(body.keepAttachmentIds) ? body.keepAttachmentIds.filter((v) => typeof v === "string") : [];

    const col = await healthRecords();
    const record = await col.findOne({ _id, ownerId: uid });
    if (!record) throw recordNotFound();
    // L'animal d'un acte ne change pas.
    if (record.petId !== fields.petId) throw badRequest("L'animal d'un acte ne peut pas être modifié.");
    const pet = await requirePetAccess(uid, record.petId, { write: true });
    fields.petName = pet.name.slice(0, 60);

    const kept = record.attachments.filter((a) => keep.includes(a._id.toHexString()));
    if (kept.length + added.length > ATTACHMENTS_MAX_COUNT) {
      throw badRequest(`${ATTACHMENTS_MAX_COUNT} pièces jointes maximum par acte.`);
    }
    const updated = await col.findOneAndUpdate(
      { _id, ownerId: uid },
      { $set: { ...fields, attachments: [...kept, ...added], updatedAt: new Date() } },
      { returnDocument: "after", projection: LIST_PROJECTION },
    );
    if (!updated) throw recordNotFound();
    // Prises déjà cochées qui ne correspondent plus aux horaires (horaires modifiés, acte devenu autre chose).
    await (await treatmentDoses()).deleteMany({
      recordId: _id.toHexString(),
      ...(updated.type === "traitement" && { time: { $nin: updated.doseTimes ?? [] } }),
    });
    await syncVaccineReminder({ ...updated, attachments: [] }, _id, uid, record.petId);
    return Response.json({ record: toHealthRecord(updated) });
  });
}

/** DELETE /api/health-records/:id — supprime un acte, ses pièces jointes, ses prises et son rappel. */
export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const _id = recordObjectId((await ctx.params).id);
    const col = await healthRecords();
    const existing = await col.findOne({ _id, ownerId: uid }, { projection: { petId: 1 } });
    if (!existing) throw recordNotFound();
    await requirePetAccess(uid, existing.petId, { write: true });
    const record = await col.findOneAndDelete({ _id, ownerId: uid }, { projection: { petId: 1 } });
    if (!record) throw recordNotFound();
    await (await treatmentDoses()).deleteMany({ recordId: _id.toHexString() });
    await syncVaccineReminder(null, _id, uid, record.petId);
    return new Response(null, { status: 204 });
  });
}
