// Une annonce : lecture, modification (édition, archivage, remise en ligne) et suppression d'un brouillon.
import { ADOPTION_ROUTES, PENDING_STATUSES, type ApplicationStatus } from "@/lib/adoption-models";
import {
  applications,
  canRead,
  favorites,
  findOwnListing,
  happyTails,
  isAdmin,
  listingJson,
  listingObjectId,
  listings,
  parseListingInput,
} from "@/lib/server/adoption";
import { badRequest, handle, HttpError, notFound, optionalUser, readJson, requireUser } from "@/lib/server/http";
import { withTransaction } from "@/lib/server/mongo";
import { notifyUsers } from "@/lib/server/notify";

type Ctx = RouteContext<"/api/adoption/listings/[id]">;

const OPEN_STATUSES: ApplicationStatus[] = [...PENDING_STATUSES, "acceptee"];

/** Lire une annonce : en ligne pour tous, brouillon / archive pour son auteur. Sinon `null`. */
export async function GET(request: Request, ctx: Ctx) {
  return handle(async () => {
    const user = await optionalUser(request);
    const { id } = await ctx.params;
    let listing = null;
    try {
      listing = await (await listings()).findOne({ _id: listingObjectId(id) });
    } catch (error) {
      if (!(error instanceof HttpError)) throw error; // identifiant mal formé → annonce introuvable
    }
    if (!listing || !canRead(listing, user?.uid, await isAdmin(user?.uid))) return Response.json(null);
    return Response.json(listingJson(listing));
  });
}

/**
 * Actions de l'auteur :
 * - `{ action: "update", input, publish? }` : modifier (et publier un brouillon) ;
 * - `{ action: "archive" }` : retirer l'annonce, les candidatures en cours sont refusées ;
 * - `{ action: "republish" }` : remettre en ligne une annonce archivée.
 */
export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const listing = await findOwnListing((await ctx.params).id, uid);
    const body = await readJson(request);
    const now = new Date();
    const col = await listings();

    switch (body.action) {
      case "update": {
        if (listing.status === "adoptee") throw badRequest("Une annonce adoptée ne peut plus être modifiée.");
        const publishing = body.publish === true && listing.status === "brouillon";
        // Une annonce déjà en ligne doit rester complète.
        const input = parseListingInput(body.input, publishing || listing.status !== "brouillon");
        await col.updateOne(
          { _id: listing._id },
          { $set: { ...input, updatedAt: now, ...(publishing && { status: "disponible" as const, publishedAt: now }) } },
        );
        break;
      }

      case "archive": {
        if (listing.status !== "disponible" && listing.status !== "reservee") {
          throw badRequest("Seule une annonce en ligne peut être archivée.");
        }
        const listingId = listing._id.toHexString();
        const apps = await applications();
        const open = await apps.find({ listingId, status: { $in: OPEN_STATUSES } }).toArray();
        await withTransaction(async (session) => {
          await col.updateOne(
            { _id: listing._id },
            { $set: { status: "archivee", updatedAt: now }, $unset: { acceptedApplicationId: "" } },
            { session },
          );
          await apps.updateMany(
            { listingId, status: { $in: OPEN_STATUSES } },
            { $set: { status: "refusee", decidedAt: now, updatedAt: now } },
            { session },
          );
        });
        await notifyUsers(
          open.map((a) => ({
            userId: a.applicantId,
            senderId: uid,
            type: "adoption",
            title: `L'annonce de ${listing.name} a été retirée`,
            body: `${listing.ownerName} a retiré l'annonce : votre candidature est close.`,
            link: ADOPTION_ROUTES.myApplications,
            actionLabel: "Voir mes candidatures",
          })),
        );
        break;
      }

      case "republish": {
        if (listing.status !== "archivee") throw badRequest("Seule une annonce archivée peut être remise en ligne.");
        await col.updateOne({ _id: listing._id }, { $set: { status: "disponible", publishedAt: now, updatedAt: now } });
        break;
      }

      default:
        throw badRequest("Action inconnue.");
    }

    const updated = await col.findOne({ _id: listing._id });
    if (!updated) throw notFound();
    return Response.json(listingJson(updated));
  });
}

/** Supprimer un brouillon (un administrateur peut supprimer n'importe quelle annonce). */
export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const listing = await findOwnListing((await ctx.params).id, uid);
    if (listing.status !== "brouillon" && !(await isAdmin(uid))) {
      throw badRequest("Seul un brouillon peut être supprimé : archivez plutôt l'annonce.");
    }
    const listingId = listing._id.toHexString();
    await withTransaction(async (session) => {
      await (await listings()).deleteOne({ _id: listing._id }, { session });
      await (await applications()).deleteMany({ listingId }, { session });
      await (await favorites()).deleteMany({ listingId }, { session });
      await (await happyTails()).deleteOne({ _id: listingId }, { session });
    });
    return new Response(null, { status: 204 });
  });
}
