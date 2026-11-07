// Lien public de partage du carnet : lecture seule, sans compte. Le jeton de l'adresse est la seule clé d'accès.
import { recordsForScope, SHARE_ACCESS_LOG_MAX, type SharedHealthBook } from "@/lib/health-share";
import { shiftIsoDay } from "@/lib/health-summary";
import { healthRecords, toHealthRecord } from "@/lib/server/health";
import { findShareByToken, healthShares, shareNotFound } from "@/lib/server/health-share";
import { handle } from "@/lib/server/http";
import { latestAllowedDay, pets } from "@/lib/server/pets";
import { ObjectId } from "mongodb";

/** Rien de ce qui est renvoyé ne doit être mis en cache ni indexé. */
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

/**
 * GET /api/partage/:token — carnet partagé (selon la portée du lien) : 404 si le lien est inconnu,
 * 410 s'il a expiré ou a été désactivé. Chaque consultation est comptée et datée pour le propriétaire.
 * Jamais renvoyés : e-mail, téléphone ou nom du propriétaire, contacts de la fiche, pièces jointes.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/partage/[token]">) {
  const response = await handle(async () => {
    const share = await findShareByToken((await ctx.params).token);
    const pet = await (await pets()).findOne(
      { _id: new ObjectId(share.petId), ownerId: share.ownerId },
      { projection: { name: 1, species: 1, breed: 1, sex: 1, birthDate: 1, sterilized: 1, chipNumber: 1, vet: 1, status: 1, photos: { $slice: 1 } } },
    );
    if (!pet) throw shareNotFound();

    const docs = await (await healthRecords())
      .find({ ownerId: share.ownerId, petId: share.petId }, { projection: { "attachments.data": 0 } })
      .toArray();
    const today = shiftIsoDay(latestAllowedDay(), -1);
    const records = recordsForScope(docs.map(toHealthRecord), share.scope, today);

    const now = new Date();
    await (await healthShares()).updateOne(
      { _id: share._id },
      {
        $inc: { accessCount: 1 },
        $set: { lastAccessAt: now },
        $push: { accessLog: { $each: [now], $position: 0, $slice: SHARE_ACCESS_LOG_MAX } },
      },
    );

    const book: SharedHealthBook = {
      scope: share.scope,
      expiresAt: share.expiresAt.toISOString(),
      pet: {
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        sex: pet.sex,
        birthDate: pet.birthDate,
        sterilized: pet.sterilized,
        chipNumber: share.scope === "complet" ? pet.chipNumber : "",
        photo: pet.photos?.[0]?.thumbnail ?? "",
        archived: pet.status === "archived",
      },
      vet: { name: pet.vet?.name ?? "", clinic: pet.vet?.clinic ?? "", address: pet.vet?.address ?? "", phone: pet.vet?.phone ?? "" },
      records,
    };
    return Response.json(book);
  });
  for (const [key, value] of Object.entries(PRIVATE_HEADERS)) response.headers.set(key, value);
  return response;
}
