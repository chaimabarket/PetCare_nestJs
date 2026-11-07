import { handle, HttpError, requireUser } from "@/lib/server/http";
import { findOwnPet, fullPetJson, isComplete, pets, refreshWeightAlert } from "@/lib/server/pets";

/** POST /api/pets/:id/restore — l'animal archivé revient dans les actifs (en brouillon si sa fiche est incomplète). */
export async function POST(request: Request, ctx: RouteContext<"/api/pets/[id]/restore">) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const pet = await findOwnPet((await ctx.params).id, uid);
    if (pet.status !== "archived") throw new HttpError(409, `${pet.name} n'est pas archivé.`);
    await (await pets()).updateOne(
      { _id: pet._id },
      {
        $set: { status: isComplete(pet) ? "active" : "draft", updatedAt: new Date() },
        $unset: { archivedReason: "", archivedAt: "" },
      },
    );
    await refreshWeightAlert(pet._id);
    return Response.json(await fullPetJson(pet._id));
  });
}
