// Un rappel de soin : bouton « Fait » (PATCH `{ done }`) et suppression. Propriétaire uniquement.
import { badRequest, handle, HttpError, readJson, requireUser } from "@/lib/server/http";
import { rdvObjectId, reminderJson, reminders } from "@/lib/server/rendez-vous";

type Ctx = RouteContext<"/api/reminders/[id]">;
const reminderNotFound = () => new HttpError(404, "Ce rappel n'existe plus.");

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const _id = rdvObjectId((await ctx.params).id, reminderNotFound);
    const { done } = await readJson(request);
    if (typeof done !== "boolean") throw badRequest("Valeur « done » attendue.");
    const updated = await (await reminders()).findOneAndUpdate(
      { _id, ownerId: uid },
      done ? { $set: { done: true, doneAt: new Date() } } : { $set: { done: false }, $unset: { doneAt: "" } },
      { returnDocument: "after" },
    );
    if (!updated) throw reminderNotFound();
    return Response.json(reminderJson(updated));
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const _id = rdvObjectId((await ctx.params).id, reminderNotFound);
    const result = await (await reminders()).deleteOne({ _id, ownerId: uid });
    if (!result.deletedCount) throw reminderNotFound();
    return new Response(null, { status: 204 });
  });
}
