import { ObjectId } from "mongodb";
import { MAX_PET_PHOTOS } from "@/lib/pets-models";
import { badRequest, handle, readJson, requireUser } from "@/lib/server/http";
import { checkPhotos, findOwnPet, fullPetJson, parsePhoto, pets, requireEditable } from "@/lib/server/pets";

/**
 * POST /api/pets/:id/photos — `{ url, thumbnail }` (images compressées dans le navigateur) :
 * ajoute une photo à la fin (5 maximum). Renvoie la fiche ; la nouvelle photo est la dernière de `photos`.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/pets/[id]/photos">) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const pet = await findOwnPet((await ctx.params).id, uid);
    requireEditable(pet);
    const photo = { _id: new ObjectId(), ...parsePhoto(await readJson(request)), createdAt: new Date() };
    checkPhotos([...pet.photos, photo]);
    // « pas de 5e photo » dans le filtre : deux ajouts simultanés ne peuvent pas dépasser la limite.
    const result = await (await pets()).updateOne(
      { _id: pet._id, [`photos.${MAX_PET_PHOTOS - 1}`]: { $exists: false } },
      { $push: { photos: photo }, $set: { updatedAt: new Date() } },
    );
    if (!result.modifiedCount) throw badRequest(`${MAX_PET_PHOTOS} photos maximum.`);
    return Response.json(await fullPetJson(pet._id), { status: 201 });
  });
}
