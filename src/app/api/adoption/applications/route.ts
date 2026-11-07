// Candidatures d'adoption : listes (envoyées / reçues) et envoi d'une candidature.
import type { Filter } from "mongodb";
import { ADOPTION_ROUTES, applicationId } from "@/lib/adoption-models";
import {
  applicationJson,
  applications,
  findOwnListing,
  listingObjectId,
  listings,
  parseAnswers,
  requireProfile,
  type ApplicationDoc,
} from "@/lib/server/adoption";
import { badRequest, handle, HttpError, notFound, readJson, requireUser } from "@/lib/server/http";
import { notifyUsers } from "@/lib/server/notify";

/**
 * - `?scope=mine` : mes candidatures (`&listingId=` pour une annonce précise) ;
 * - `?scope=received` : candidatures reçues sur mes annonces (`&listingId=` pour une annonce précise).
 */
export async function GET(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const params = new URL(request.url).searchParams;
    const listingId = params.get("listingId");
    let filter: Filter<ApplicationDoc>;

    if (params.get("scope") === "mine") {
      filter = { applicantId: uid, ...(listingId && { listingId }) };
    } else if (params.get("scope") === "received") {
      if (listingId) {
        await findOwnListing(listingId, uid); // 404 si ce n'est pas mon annonce
        filter = { listingId };
      } else {
        filter = { ownerId: uid };
      }
    } else {
      throw badRequest("Paramètre « scope » attendu : mine ou received.");
    }

    const items = await (await applications()).find(filter).sort({ createdAt: -1 }).toArray();
    return Response.json(items.map(applicationJson));
  });
}

/** Envoyer une candidature : `{ listingId, answers }`. Une seule par annonce et par candidat. */
export async function POST(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const profile = await requireProfile(uid);
    const body = await readJson(request);
    if (typeof body.listingId !== "string") throw badRequest("Annonce manquante.");
    const answers = parseAnswers(body.answers);

    const listing = await (await listings()).findOne({ _id: listingObjectId(body.listingId) });
    if (!listing) throw notFound();
    if (listing.ownerId === uid) throw badRequest("Vous ne pouvez pas candidater à votre propre annonce.");
    if (listing.status !== "disponible") throw badRequest(`${listing.name} n'est plus disponible à l'adoption.`);

    const now = new Date();
    const application: ApplicationDoc = {
      _id: applicationId(body.listingId, uid),
      ...answers,
      listingId: body.listingId,
      ownerId: listing.ownerId,
      ownerName: listing.ownerName,
      animalName: listing.name,
      animalThumbnail: listing.thumbnail,
      applicantId: uid,
      applicantName: profile.displayName,
      applicantCity: answers.housing.city,
      status: "envoyee",
      createdAt: now,
      updatedAt: now,
    };
    try {
      await (await applications()).insertOne(application);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new HttpError(409, `Vous avez déjà envoyé une candidature pour ${listing.name}.`);
      }
      throw error;
    }

    await notifyUsers([
      {
        userId: listing.ownerId,
        senderId: uid,
        type: "adoption",
        title: `Nouvelle candidature pour ${listing.name}`,
        body: `${profile.displayName} (${answers.housing.city}) souhaite adopter ${listing.name}.`,
        link: ADOPTION_ROUTES.received(body.listingId),
        actionLabel: "Voir la candidature",
      },
    ]);
    return Response.json(applicationJson(application), { status: 201 });
  });
}
