// Animaux de l'utilisateur connecté : liste et ajout (module 1 « Mes animaux »).
import { ObjectId } from "mongodb";
import { validateWeight } from "@/lib/pets-models";
import { badRequest, handle, readJson, requireUser } from "@/lib/server/http";
import {
  checkPhotos,
  fullPetJson,
  latestAllowedDay,
  latestWeights,
  measuredOn,
  parsePetInput,
  parsePhoto,
  petJson,
  pets,
  petWeights,
  type PetDoc,
} from "@/lib/server/pets";

/** GET /api/pets — tous ses animaux (actifs, brouillons et archivés), avec la couverture et le dernier poids. */
export async function GET(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const docs = await (await pets())
      .find({ ownerId: uid }, { projection: { photos: { $slice: 1 } } })
      .sort({ createdAt: -1 })
      .toArray();
    const latest = await latestWeights(docs.map((d) => d._id.toHexString()));
    return Response.json(docs.map((d) => petJson(d, { list: true, latestWeight: latest.get(d._id.toHexString()) })));
  });
}

/**
 * POST /api/pets — `{ pet, draft?, photos?: [{ url, thumbnail }], weight?: { weightKg, day } }`.
 * `draft: true` enregistre un brouillon (seul le nom est exigé). Le poids facultatif devient la pesée du jour.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const body = await readJson(request);
    const draft = body.draft === true;
    const input = parsePetInput(body.pet, draft);
    if (body.photos !== undefined && !Array.isArray(body.photos)) throw badRequest("Photos invalides.");
    const now = new Date();
    const photos = ((body.photos as unknown[] | undefined) ?? []).map((p) => ({
      _id: new ObjectId(),
      ...parsePhoto(p),
      createdAt: now,
    }));
    checkPhotos(photos);

    let weight: ReturnType<typeof validateWeight>["value"] | null = null;
    if (body.weight !== undefined && body.weight !== null) {
      const result = validateWeight(body.weight, { today: latestAllowedDay(), birthDate: input.birthDate });
      const first = Object.values(result.errors).find(Boolean);
      if (first) throw badRequest(first);
      weight = result.value;
    }

    const pet: PetDoc = {
      _id: new ObjectId(),
      ...input,
      ownerId: uid,
      status: draft ? "draft" : "active",
      favorite: false,
      contacts: [],
      photos,
      notifiedAlertKeys: [],
      createdAt: now,
      updatedAt: now,
    };
    await (await pets()).insertOne(pet);
    if (weight) {
      await (await petWeights()).insertOne({
        _id: new ObjectId(),
        petId: pet._id.toHexString(),
        ownerId: uid,
        day: weight.day,
        measuredOn: measuredOn(weight.day, now),
        weightKg: weight.weightKg,
        note: weight.note,
        createdAt: now,
        updatedAt: now,
      });
    }
    return Response.json(await fullPetJson(pet._id), { status: 201 });
  });
}
