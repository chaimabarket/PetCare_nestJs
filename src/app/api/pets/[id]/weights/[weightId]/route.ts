// Une pesée : correction du poids et de la note (la date ne change pas), ou suppression.
import { validateWeight } from "@/lib/pets-models";
import { badRequest, handle, notFound, readJson, requireUser } from "@/lib/server/http";
import {
  findOwnPet,
  latestAllowedDay,
  objectId,
  pets,
  petWeights,
  refreshWeightAlert,
  requireEditable,
  weightJson,
} from "@/lib/server/pets";

type Ctx = RouteContext<"/api/pets/[id]/weights/[weightId]">;

/** PUT /api/pets/:id/weights/:weightId — `{ weightKg, note? }`. Renvoie `{ weight, weightAlert }`. */
export async function PUT(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const { id, weightId } = await ctx.params;
    const pet = await findOwnPet(id, uid);
    requireEditable(pet);
    const col = await petWeights();
    const existing = await col.findOne({ _id: objectId(weightId), petId: pet._id.toHexString() });
    if (!existing) throw notFound();
    const body = await readJson(request);
    // Le jour de la pesée ne change pas : on valide avec le jour existant.
    const { value, errors } = validateWeight({ ...body, day: existing.day }, { today: latestAllowedDay() });
    const first = Object.values(errors).find(Boolean);
    if (first) throw badRequest(first);

    const updated = await col.findOneAndUpdate(
      { _id: existing._id },
      { $set: { weightKg: value.weightKg, note: value.note, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!updated) throw notFound();
    await refreshWeightAlert(pet._id);
    const doc = await (await pets()).findOne({ _id: pet._id }, { projection: { weightAlert: 1 } });
    return Response.json({ weight: weightJson(updated), weightAlert: doc?.weightAlert ?? null });
  });
}

/** DELETE /api/pets/:id/weights/:weightId */
export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const { id, weightId } = await ctx.params;
    const pet = await findOwnPet(id, uid);
    requireEditable(pet);
    const result = await (await petWeights()).deleteOne({ _id: objectId(weightId), petId: pet._id.toHexString() });
    if (!result.deletedCount) throw notFound();
    await refreshWeightAlert(pet._id);
    return new Response(null, { status: 204 });
  });
}
