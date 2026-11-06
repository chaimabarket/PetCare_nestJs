// Happy Tails : histoires d'adoption « avant / après ».
import { ADOPTION_ROUTES } from "@/lib/adoption-models";
import {
  happyTailJson,
  happyTails,
  listingObjectId,
  listings,
  parseHappyTail,
  requireProfile,
  type HappyTailDoc,
} from "@/lib/server/adoption";
import { badRequest, forbidden, handle, HttpError, notFound, readJson, requireUser } from "@/lib/server/http";
import { notifyUsers } from "@/lib/server/notify";

/** Toutes les histoires, plus récentes d'abord. Accessible aux visiteurs. */
export async function GET() {
  return handle(async () => {
    const items = await (await happyTails()).find().sort({ createdAt: -1 }).toArray();
    return Response.json(items.map(happyTailJson));
  });
}

/** Publier son histoire : `{ listingId, afterPhoto, story }`. Réservé à l'adoptant, une seule par adoption. */
export async function POST(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const profile = await requireProfile(uid);
    const body = await readJson(request);
    if (typeof body.listingId !== "string") throw badRequest("Annonce manquante.");
    const { afterPhoto, story } = parseHappyTail(body);

    const listing = await (await listings()).findOne({ _id: listingObjectId(body.listingId) });
    if (!listing) throw notFound();
    if (listing.status !== "adoptee" || listing.adopterId !== uid) throw forbidden();

    const tail: HappyTailDoc = {
      _id: body.listingId,
      listingId: body.listingId,
      adopterId: uid,
      adopterName: profile.displayName,
      ownerName: listing.ownerName,
      animalName: listing.name,
      species: listing.species,
      beforePhoto: listing.photos[0] ?? listing.thumbnail,
      afterPhoto,
      story,
      likedBy: [],
      createdAt: new Date(),
    };
    try {
      await (await happyTails()).insertOne(tail);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new HttpError(409, "Votre histoire a déjà été publiée.");
      throw error;
    }

    await notifyUsers([
      {
        userId: listing.ownerId,
        senderId: uid,
        type: "adoption",
        title: `Des nouvelles de ${listing.name} 💛`,
        body: `${profile.displayName} a partagé son histoire d'adoption.`,
        link: ADOPTION_ROUTES.happyTails,
        actionLabel: "Lire l'histoire",
      },
    ]);
    return Response.json(happyTailJson(tail), { status: 201 });
  });
}
