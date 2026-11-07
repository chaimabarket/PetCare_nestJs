// Rappels de soins de l'utilisateur connecté.
import { ObjectId } from "mongodb";
import { handle, readJson, requireUser } from "@/lib/server/http";
import { parseReminder, reminderJson, reminders, type ReminderDoc } from "@/lib/server/rendez-vous";

/** GET /api/reminders — mes rappels, par échéance. */
export async function GET(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const items = await (await reminders()).find({ ownerId: uid }).sort({ dueAt: 1 }).toArray();
    return Response.json(items.map(reminderJson));
  });
}

/** POST /api/reminders — « Nouveau rappel ». */
export async function POST(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const fields = parseReminder(await readJson(request));
    const doc: ReminderDoc = { _id: new ObjectId(), ownerId: uid, ...fields, done: false };
    if (doc.description === undefined) delete doc.description;
    if (doc.detail === undefined) delete doc.detail;
    await (await reminders()).insertOne(doc);
    return Response.json(reminderJson(doc), { status: 201 });
  });
}
