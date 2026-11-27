// Carnet de santé : liste des actes d'un animal et ajout d'un acte. Chacun ne voit que les carnets de ses animaux.
import { ObjectId } from "mongodb";
import { RECORD_TYPES, type RecordType } from "@/lib/health-records";
import {
  healthRecords,
  LIST_PROJECTION,
  parseNewAttachments,
  recordFields,
  requirePetAccess,
  syncVaccineReminder,
  toHealthRecord,
  type HealthRecordDoc,
} from "@/lib/server/health";
import { badRequest, handle, readJson, requireUser } from "@/lib/server/http";

/** GET /api/health-records?petId=…&type=… — carnet de santé d'un animal (plus récent d'abord). */
export async function GET(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const params = new URL(request.url).searchParams;
    const petId = params.get("petId")?.trim();
    const type = params.get("type");
    if (!petId) throw badRequest("Le paramètre petId est obligatoire.");
    if (type && !RECORD_TYPES.includes(type as RecordType)) throw badRequest("Type d'acte inconnu.");
    await requirePetAccess(uid, petId);

    const docs = await (await healthRecords())
      .find({ ownerId: uid, petId, ...(type && { type: type as RecordType }) }, { projection: LIST_PROJECTION })
      .sort({ date: -1, createdAt: -1 })
      .toArray();
    return Response.json({ records: docs.map(toHealthRecord) });
  });
}

/** POST /api/health-records — ajoute un acte médical (et programme le rappel d'un vaccin). Refusé si l'animal est archivé. */
export async function POST(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const body = await readJson(request);
    const fields = recordFields(body);
    const attachments = parseNewAttachments(body.newAttachments);
    const pet = await requirePetAccess(uid, fields.petId, { write: true });
    // Le nom affiché vient de la fiche de l'animal, pas du navigateur.
    fields.petName = pet.name.slice(0, 60);

    const now = new Date();
    const record: HealthRecordDoc = { _id: new ObjectId(), ...fields, ownerId: uid, attachments, createdAt: now, updatedAt: now };
    await (await healthRecords()).insertOne(record);
    await syncVaccineReminder(record, record._id, uid, record.petId);
    return Response.json({ record: toHealthRecord(record) }, { status: 201 });
  });
}
