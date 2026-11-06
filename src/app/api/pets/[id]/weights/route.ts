// Pesées d'un animal : historique et ajout (une pesée par jour). Propriétaire uniquement.
import { ObjectId } from "mongodb";
import { validateWeight } from "@/lib/pets-models";
import { badRequest, handle, HttpError, readJson, requireUser } from "@/lib/server/http";
import {
  findOwnPet,
  latestAllowedDay,
  measuredOn,
  pets,
  petWeights,
  refreshWeightAlert,
  requireEditable,
  weightJson,
  type PetWeightDoc,
} from "@/lib/server/pets";

type Ctx = RouteContext<"/api/pets/[id]/weights">;

/** GET /api/pets/:id/weights — toutes les pesées, la plus récente d'abord. */
export async function GET(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const pet = await findOwnPet((await ctx.params).id, uid);
    const items = await (await petWeights()).find({ petId: pet._id.toHexString() }).sort({ day: -1 }).toArray();
    return Response.json(items.map(weightJson));
  });
}

/**
 * POST /api/pets/:id/weights — `{ day, weightKg, note? }`. 409 si le jour a déjà une pesée.
 * Renvoie `{ weight, weightAlert }` : l'alerte de poids recalculée (absente s'il n'y en a pas).
 */
export async function POST(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const pet = await findOwnPet((await ctx.params).id, uid);
    requireEditable(pet);
    const { value, errors } = validateWeight(await readJson(request), {
      today: latestAllowedDay(),
      birthDate: pet.birthDate,
    });
    const first = Object.values(errors).find(Boolean);
    if (first) throw badRequest(first);

    const now = new Date();
    const weight: PetWeightDoc = {
      _id: new ObjectId(),
      petId: pet._id.toHexString(),
      ownerId: uid,
      day: value.day,
      measuredOn: measuredOn(value.day, now),
      weightKg: value.weightKg,
      note: value.note,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await (await petWeights()).insertOne(weight);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new HttpError(409, "Une pesée existe déjà pour ce jour : corrigez-la dans l'historique.");
      }
      throw error;
    }
    await refreshWeightAlert(pet._id);
    const updated = await (await pets()).findOne({ _id: pet._id }, { projection: { weightAlert: 1 } });
    return Response.json(
      { weight: weightJson(weight), weightAlert: updated?.weightAlert ?? null },
      { status: 201 },
    );
  });
}
