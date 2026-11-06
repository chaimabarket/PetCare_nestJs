import type { NextRequest } from "next/server";
import { ATTACHMENTS_MAX_COUNT } from "@/lib/health-records";
import { ApiError, handle, notFound, parseNewAttachments, parseObjectId, readJson, recordFields } from "@/lib/server/api";
import { HealthRecordModel, LIST_PROJECTION, toHealthRecord, type HealthRecordDoc } from "@/lib/server/health-record-model";

/** GET /api/health-records/:id — détail d'un acte. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/health-records/[id]">) {
  return handle(request, async (uid) => {
    const _id = parseObjectId((await ctx.params).id);
    const doc = await HealthRecordModel.findOne({ _id, ownerId: uid }, LIST_PROJECTION).lean<HealthRecordDoc>();
    if (!doc) throw notFound();
    return Response.json({ record: toHealthRecord(doc) });
  });
}

/**
 * PUT /api/health-records/:id — modifie un acte.
 * Pièces jointes : `keepAttachmentIds` (celles à conserver) + `newAttachments` (à ajouter).
 */
export async function PUT(request: NextRequest, ctx: RouteContext<"/api/health-records/[id]">) {
  return handle(request, async (uid) => {
    const _id = parseObjectId((await ctx.params).id);
    const body = await readJson(request);
    const fields = recordFields(body);
    const added = parseNewAttachments(body.newAttachments);
    const keep = Array.isArray(body.keepAttachmentIds) ? body.keepAttachmentIds.filter((v) => typeof v === "string") : [];

    const record = await HealthRecordModel.findOne({ _id, ownerId: uid });
    if (!record) throw notFound();
    // L'animal d'un acte ne change pas.
    if (record.petId !== fields.petId) throw new ApiError(400, "L'animal d'un acte ne peut pas être modifié.");

    const kept = record.attachments.filter((a) => keep.includes(String(a._id)));
    if (kept.length + added.length > ATTACHMENTS_MAX_COUNT) {
      throw new ApiError(400, `${ATTACHMENTS_MAX_COUNT} pièces jointes maximum par acte.`);
    }
    record.set({ ...fields, attachments: [...kept, ...added] });
    await record.save();

    const doc = await HealthRecordModel.findById(_id, LIST_PROJECTION).lean<HealthRecordDoc>();
    return Response.json({ record: toHealthRecord(doc!) });
  });
}

/** DELETE /api/health-records/:id — supprime un acte (et ses pièces jointes). */
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/health-records/[id]">) {
  return handle(request, async (uid) => {
    const _id = parseObjectId((await ctx.params).id);
    const result = await HealthRecordModel.deleteOne({ _id, ownerId: uid });
    if (result.deletedCount === 0) throw notFound();
    return new Response(null, { status: 204 });
  });
}
