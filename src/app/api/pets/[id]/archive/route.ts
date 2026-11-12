import { ARCHIVE_REASON_MAX_LENGTH } from "@/lib/pets-models";
import { badRequest, handle, HttpError, requireUser } from "@/lib/server/http";
import { findOwnPet, fullPetJson, pets } from "@/lib/server/pets";

/**
 * POST /api/pets/:id/archive — `{ reason? }` : l'animal quitte les actifs. Rien n'est supprimé
 * (pesées, photos, contacts et liens avec les autres modules sont conservés).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/pets/[id]/archive">) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const pet = await findOwnPet((await ctx.params).id, uid);
    if (pet.status === "archived") throw new HttpError(409, `${pet.name} est déjà archivé.`);
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    const reason = body?.reason ?? "";
    if (typeof reason !== "string" || reason.trim().length > ARCHIVE_REASON_MAX_LENGTH) {
      throw badRequest(`Motif : ${ARCHIVE_REASON_MAX_LENGTH} caractères maximum.`);
    }
    const now = new Date();
    await (await pets()).updateOne(
      { _id: pet._id },
      {
        $set: { status: "archived", archivedReason: reason.trim(), archivedAt: now, updatedAt: now },
        // Pas d'analyse de poids pour un animal archivé.
        $unset: { weightAlert: "" },
      },
    );
    return Response.json(await fullPetJson(pet._id));
  });
}
