// Annonces d'adoption : fil public et publication.
import { ObjectId } from "mongodb";
import { FEED_LISTING_STATUSES, PUBLISHER_ROLES } from "@/lib/adoption-models";
import {
  LIST_PROJECTION,
  listingJson,
  listings,
  parseListingInput,
  requireProfile,
  type ListingDoc,
} from "@/lib/server/adoption";
import { forbidden, handle, readJson, requireUser } from "@/lib/server/http";

/** Fil : annonces disponibles et réservées, plus récentes d'abord. Accessible aux visiteurs. */
export async function GET() {
  return handle(async () => {
    const items = await (await listings())
      .find({ status: { $in: FEED_LISTING_STATUSES } }, { projection: LIST_PROJECTION })
      .sort({ publishedAt: -1, createdAt: -1 })
      .toArray();
    return Response.json(items.map(listingJson));
  });
}

/** Publier (ou enregistrer en brouillon) : `{ input, publish }`. Réservé aux propriétaires et refuges. */
export async function POST(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const profile = await requireProfile(uid);
    if (!PUBLISHER_ROLES.includes(profile.role)) throw forbidden();
    const body = await readJson(request);
    const publish = body.publish === true;
    const input = parseListingInput(body.input, publish);

    const now = new Date();
    const listing: ListingDoc = {
      _id: new ObjectId(),
      ...input,
      ownerId: uid,
      ownerName: profile.displayName,
      ownerRole: profile.role,
      ownerCity: profile.city,
      status: publish ? "disponible" : "brouillon",
      createdAt: now,
      updatedAt: now,
      ...(publish && { publishedAt: now }),
    };
    await (await listings()).insertOne(listing);
    return Response.json(listingJson(listing), { status: 201 });
  });
}
