import { handle, notFound, requireUser } from "@/lib/server/http";
import { findOwnPet, fullPetJson, pets, requireEditable } from "@/lib/server/pets";

/** POST /api/pets/:id/photos/:fileId/cover — cette photo devient la couverture (première position). */
export async function POST(request: Request, ctx: RouteContext<"/api/pets/[id]/photos/[fileId]/cover">) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const { id, fileId } = await ctx.params;
    const pet = await findOwnPet(id, uid);
    requireEditable(pet);
    const cover = pet.photos.find((p) => p._id.toHexString() === fileId);
    if (!cover) throw notFound();
    const photos = [cover, ...pet.photos.filter((p) => p !== cover)];
    await (await pets()).updateOne({ _id: pet._id }, { $set: { photos, updatedAt: new Date() } });
    return Response.json(await fullPetJson(pet._id));
  });
}
