// Une notification : seul son destinataire peut la marquer comme lue ou la supprimer.
import { ObjectId } from "mongodb";
import { badRequest, handle, notFound, readJson, requireUser } from "@/lib/server/http";
import { notifications } from "@/lib/server/mongo";

function objectId(id: string): ObjectId {
  if (!ObjectId.isValid(id)) throw notFound();
  return new ObjectId(id);
}

/** Seul changement possible : `{ read: true }`. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/notifications/[id]">) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const _id = objectId((await ctx.params).id);
    const body = await readJson(request);
    if (Object.keys(body).length !== 1 || body.read !== true) throw badRequest("Seul « read: true » est accepté.");
    const result = await (await notifications()).updateOne({ _id, userId: uid }, { $set: { read: true } });
    if (!result.matchedCount) throw notFound();
    return new Response(null, { status: 204 });
  });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/notifications/[id]">) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const _id = objectId((await ctx.params).id);
    const result = await (await notifications()).deleteOne({ _id, userId: uid });
    if (!result.deletedCount) throw notFound();
    return new Response(null, { status: 204 });
  });
}
