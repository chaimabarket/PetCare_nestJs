// Un animal : lecture, modification complète (PUT) et partielle (PATCH). Propriétaire uniquement.
import { ObjectId } from "mongodb";
import { NOTES_MAX_LENGTH, validateContacts, validateWeight } from "@/lib/pets-models";
import { badRequest, handle, HttpError, readJson, requireUser } from "@/lib/server/http";
import {
  findOwnPet,
  fullPetJson,
  latestAllowedDay,
  measuredOn,
  parsePetInput,
  pets,
  petWeights,
  refreshWeightAlert,
  requireEditable,
  type PetDoc,
} from "@/lib/server/pets";

type Ctx = RouteContext<"/api/pets/[id]">;

/** GET /api/pets/:id — fiche complète (photos, contacts, dernier poids, alerte en cours). */
export async function GET(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const pet = await findOwnPet((await ctx.params).id, uid);
    // Une alerte devient caduque quand la dernière pesée vieillit : on la recalcule à l'ouverture.
    if (pet.weightAlert) await refreshWeightAlert(pet._id);
    return Response.json(await fullPetJson(pet._id));
  });
}

/**
 * PUT /api/pets/:id — `{ pet, draft?, photoOrder?, weight? }` : modification complète du formulaire.
 * Un brouillon devient actif dès que `draft` vaut `false` (fiche complète exigée) ; `photoOrder` réordonne
 * les photos (la première est la couverture) ; `weight` enregistre ou corrige la pesée du jour.
 */
export async function PUT(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const pet = await findOwnPet((await ctx.params).id, uid);
    requireEditable(pet);
    const body = await readJson(request);
    const staysDraft = pet.status === "draft" && body.draft === true;
    const input = parsePetInput(body.pet, staysDraft);

    let photos = pet.photos;
    if (body.photoOrder !== undefined) {
      const order = body.photoOrder;
      const ids = pet.photos.map((p) => p._id.toHexString());
      if (
        !Array.isArray(order) ||
        order.length !== ids.length ||
        !order.every((id) => typeof id === "string" && ids.includes(id)) ||
        new Set(order).size !== order.length
      ) {
        throw badRequest("Ordre des photos invalide.");
      }
      photos = order.map((id) => pet.photos.find((p) => p._id.toHexString() === id)!);
    }

    const now = new Date();
    await (await pets()).updateOne(
      { _id: pet._id },
      { $set: { ...input, photos, status: staysDraft ? "draft" : "active", updatedAt: now } },
    );

    if (body.weight !== undefined && body.weight !== null) {
      const { value, errors } = validateWeight(body.weight, { today: latestAllowedDay(), birthDate: input.birthDate });
      const first = Object.values(errors).find(Boolean);
      if (first) throw badRequest(first);
      const petId = pet._id.toHexString();
      await (await petWeights()).updateOne(
        { petId, day: value.day },
        {
          $set: { weightKg: value.weightKg, updatedAt: now },
          $setOnInsert: {
            _id: new ObjectId(),
            petId,
            ownerId: uid,
            day: value.day,
            measuredOn: measuredOn(value.day, now),
            note: value.note,
            createdAt: now,
          },
        },
        { upsert: true },
      );
    }
    // La date de naissance ou l'espèce peuvent changer le résultat (âge adulte, petit animal).
    await refreshWeightAlert(pet._id);
    return Response.json(await fullPetJson(pet._id));
  });
}

/**
 * PATCH /api/pets/:id — modification partielle depuis la fiche :
 * `{ notes?, contacts?, favorite?, dismissAlert? }`.
 */
export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const pet = await findOwnPet((await ctx.params).id, uid);
    requireEditable(pet);
    const body = await readJson(request);
    const changes: Partial<PetDoc> = {};

    for (const [key, value] of Object.entries(body)) {
      switch (key) {
        case "notes": {
          if (typeof value !== "string") throw badRequest("Notes : valeur invalide.");
          if (value.trim().length > NOTES_MAX_LENGTH) throw badRequest(`${NOTES_MAX_LENGTH} caractères maximum.`);
          changes.notes = value.trim();
          break;
        }
        case "contacts": {
          const { value: contacts, error } = validateContacts(value);
          if (error) throw badRequest(error);
          changes.contacts = contacts.map(({ id, ...c }) => ({
            ...c,
            _id: id && ObjectId.isValid(id) && id.length === 24 ? new ObjectId(id) : new ObjectId(),
          }));
          break;
        }
        case "favorite":
          if (typeof value !== "boolean") throw badRequest("Favori : valeur invalide.");
          changes.favorite = value;
          break;
        case "dismissAlert":
          if (value !== true) throw badRequest("Requête invalide.");
          if (!pet.weightAlert) throw new HttpError(409, "Aucune alerte de poids en cours.");
          changes.weightAlert = { ...pet.weightAlert, dismissed: true };
          break;
        default:
          throw badRequest(`Le champ « ${key} » ne peut pas être modifié ici.`);
      }
    }
    if (!Object.keys(changes).length) throw badRequest("Aucune modification.");

    await (await pets()).updateOne({ _id: pet._id }, { $set: { ...changes, updatedAt: new Date() } });
    return Response.json(await fullPetJson(pet._id));
  });
}

// Pas de DELETE : un animal n'est jamais supprimé, il est archivé (POST /api/pets/:id/archive).
