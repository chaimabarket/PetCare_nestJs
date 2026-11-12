import { handle, notFound, requireUser } from "@/lib/server/http";
import { findOwnPet, fullPetJson, objectId, pets, requireEditable } from "@/lib/server/pets";

/** DELETE /api/pets/:id/photos/:fileId — retire une photo (la suivante devient la couverture si besoin). */
export async function DELETE(request: Request, ctx: RouteContext<"/api/pets/[id]/photos/[fileId]">) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const { id, fileId } = await ctx.params;
    const pet = await findOwnPet(id, uid);
    requireEditable(pet);
    const _id = objectId(fileId);
    const result = await (await pets()).updateOne(
      { _id: pet._id, "photos._id": _id },
      { $pull: { photos: { _id } }, $set: { updatedAt: new Date() } },
    );
    if (!result.modifiedCount) throw notFound();
    return Response.json(await fullPetJson(pet._id));
  });
}
