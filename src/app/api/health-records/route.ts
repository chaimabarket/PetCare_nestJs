import type { NextRequest } from "next/server";
import { ATTACHMENTS_MAX_COUNT, RECORD_TYPES, type RecordType } from "@/lib/health-records";
import { ApiError, handle, parseNewAttachments, readJson, recordFields } from "@/lib/server/api";
import { HealthRecordModel, LIST_PROJECTION, toHealthRecord, type HealthRecordDoc } from "@/lib/server/health-record-model";

/** GET /api/health-records?petId=…&type=… — carnet de santé d'un animal (plus récent d'abord). */
export async function GET(request: NextRequest) {
  return handle(request, async (uid) => {
    const petId = request.nextUrl.searchParams.get("petId")?.trim();
    const type = request.nextUrl.searchParams.get("type");
    if (!petId) throw new ApiError(400, "Le paramètre petId est obligatoire.");
    if (type && !RECORD_TYPES.includes(type as RecordType)) throw new ApiError(400, "Type d'acte inconnu.");

    const docs = await HealthRecordModel.find({ ownerId: uid, petId, ...(type ? { type } : {}) }, LIST_PROJECTION)
      .sort({ date: -1, createdAt: -1 })
      .lean<HealthRecordDoc[]>();
    return Response.json({ records: docs.map(toHealthRecord) });
  });
}

/** POST /api/health-records — ajoute un acte médical. */
export async function POST(request: NextRequest) {
  return handle(request, async (uid) => {
    const body = await readJson(request);
    const fields = recordFields(body);
    const attachments = parseNewAttachments(body.newAttachments);
    if (attachments.length > ATTACHMENTS_MAX_COUNT) {
      throw new ApiError(400, `${ATTACHMENTS_MAX_COUNT} pièces jointes maximum par acte.`);
    }

    const created = await HealthRecordModel.create({ ...fields, ownerId: uid, attachments });
    const doc = await HealthRecordModel.findById(created._id, LIST_PROJECTION).lean<HealthRecordDoc>();
    return Response.json({ record: toHealthRecord(doc!) }, { status: 201 });
  });
}
