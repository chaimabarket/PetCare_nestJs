// Marque plusieurs notifications comme lues en une requête : `{ ids: string[] }`.
import { ObjectId } from "mongodb";
import { badRequest, handle, readJson, requireUser } from "@/lib/server/http";
import { notifications } from "@/lib/server/mongo";

const MAX_IDS = 1000;

export async function POST(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const { ids } = await readJson(request);
    if (!Array.isArray(ids) || ids.length > MAX_IDS || !ids.every((id) => typeof id === "string" && ObjectId.isValid(id))) {
      throw badRequest("Liste de notifications invalide.");
    }
    // Le filtre sur userId ignore les identifiants qui appartiennent à quelqu'un d'autre.
    const result = await (await notifications()).updateMany(
      { _id: { $in: ids.map((id) => new ObjectId(id)) }, userId: uid },
      { $set: { read: true } },
    );
    return Response.json({ updated: result.modifiedCount });
  });
}
