// Cycle d'une candidature : envoyee → en-etude → acceptee (animal réservé) → adoptee.
// Le candidat peut seulement la retirer ; l'auteur de l'annonce fait avancer le statut.
import type { ClientSession } from "mongodb";
import { ADOPTION_ROUTES, PENDING_STATUSES, type ApplicationStatus } from "@/lib/adoption-models";
import {
  applicationJson,
  applications,
  listingObjectId,
  listings,
  type ApplicationDoc,
  type ListingDoc,
} from "@/lib/server/adoption";
import { badRequest, forbidden, handle, HttpError, notFound, readJson, requireUser } from "@/lib/server/http";
import { withTransaction } from "@/lib/server/mongo";
import { notifyUsers, type ServerNotification } from "@/lib/server/notify";

type Ctx = RouteContext<"/api/adoption/applications/[id]">;

const OPEN_STATUSES: ApplicationStatus[] = [...PENDING_STATUSES, "acceptee"];

/** L'état a changé entre-temps (autre onglet, autre action) : on demande de recharger. */
const conflict = () => new HttpError(409, "La situation a changé entre-temps : rechargez la page.");

/** Mise à jour conditionnelle : échoue si le document n'est plus dans l'état attendu. */
async function mustUpdate(result: Promise<{ matchedCount: number }>) {
  if (!(await result).matchedCount) throw conflict();
}

/**
 * `{ action }` parmi :
 * - candidat : `withdraw` ;
 * - auteur de l'annonce : `review`, `accept`, `refuse`, `cancel-acceptance`, `confirm-adoption`.
 */
export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const { id } = await ctx.params;
    const { action } = await readJson(request);
    const apps = await applications();
    const application = await apps.findOne({ _id: id });
    if (!application || (application.applicantId !== uid && application.ownerId !== uid)) throw notFound();

    const isApplicant = application.applicantId === uid;
    if (action === "withdraw" ? !isApplicant : application.ownerId !== uid) throw forbidden();

    const now = new Date();
    const col = await listings();
    const notes: ServerNotification[] = [];
    const toApplicant = (n: Omit<ServerNotification, "userId" | "senderId" | "type">) =>
      notes.push({ userId: application.applicantId, senderId: uid, type: "adoption", ...n });

    async function loadListing(): Promise<ListingDoc> {
      const listing = await col.findOne({ _id: listingObjectId(application!.listingId) });
      if (!listing) throw notFound();
      return listing;
    }

    switch (action) {
      case "withdraw": {
        if (!PENDING_STATUSES.includes(application.status)) throw badRequest("Cette candidature ne peut plus être retirée.");
        await mustUpdate(
          apps.updateOne(
            { _id: id, status: { $in: PENDING_STATUSES } },
            { $set: { status: "retiree", withdrawnAt: now, updatedAt: now } },
          ),
        );
        notes.push({
          userId: application.ownerId,
          senderId: uid,
          type: "adoption",
          title: `Candidature retirée pour ${application.animalName}`,
          body: `${application.applicantName} a retiré sa candidature.`,
          link: ADOPTION_ROUTES.received(application.listingId),
          actionLabel: "Voir les candidatures",
        });
        break;
      }

      case "review": {
        // Première ouverture par l'auteur ; sans effet si la candidature a déjà été vue.
        const result = await apps.updateOne(
          { _id: id, status: "envoyee" },
          { $set: { status: "en-etude", reviewedAt: now, updatedAt: now } },
        );
        if (result.modifiedCount) {
          toApplicant({
            title: `Votre candidature pour ${application.animalName} est en étude`,
            body: `${application.ownerName} étudie votre dossier.`,
            link: ADOPTION_ROUTES.myApplications,
            actionLabel: "Suivre ma candidature",
          });
        }
        break;
      }

      case "accept": {
        if (!PENDING_STATUSES.includes(application.status)) throw badRequest("Cette candidature n'est plus en attente.");
        const listing = await loadListing();
        if (listing.status !== "disponible") throw badRequest(`${listing.name} n'est plus disponible.`);
        await withTransaction(async (session) => {
          await mustUpdate(
            col.updateOne(
              { _id: listing._id, status: "disponible" },
              { $set: { status: "reservee", acceptedApplicationId: id, updatedAt: now } },
              { session },
            ),
          );
          await mustUpdate(
            apps.updateOne(
              { _id: id, status: { $in: PENDING_STATUSES } },
              { $set: { status: "acceptee", decidedAt: now, updatedAt: now } },
              { session },
            ),
          );
        });
        toApplicant({
          title: `Candidature acceptée pour ${listing.name}`,
          body: `${listing.ownerName} a accepté votre candidature : ${listing.name} vous est réservé(e).`,
          link: ADOPTION_ROUTES.myApplications,
          actionLabel: "Voir ma candidature",
        });
        break;
      }

      case "refuse": {
        if (!PENDING_STATUSES.includes(application.status)) throw badRequest("Cette candidature n'est plus en attente.");
        await mustUpdate(
          apps.updateOne(
            { _id: id, status: { $in: PENDING_STATUSES } },
            { $set: { status: "refusee", decidedAt: now, updatedAt: now } },
          ),
        );
        toApplicant({
          title: `Candidature non retenue pour ${application.animalName}`,
          body: `${application.ownerName} n'a pas retenu votre candidature. Merci pour votre démarche !`,
          link: ADOPTION_ROUTES.myApplications,
          actionLabel: "Voir mes candidatures",
        });
        break;
      }

      case "cancel-acceptance": {
        if (application.status !== "acceptee") throw badRequest("Cette candidature n'est pas acceptée.");
        const listing = await loadListing();
        await withTransaction(async (session) => {
          await mustUpdate(
            col.updateOne(
              { _id: listing._id, status: "reservee", acceptedApplicationId: id },
              { $set: { status: "disponible", updatedAt: now }, $unset: { acceptedApplicationId: "" } },
              { session },
            ),
          );
          await mustUpdate(
            apps.updateOne({ _id: id, status: "acceptee" }, { $set: { status: "en-etude", updatedAt: now } }, { session }),
          );
        });
        toApplicant({
          title: `Réservation de ${listing.name} annulée`,
          body: `${listing.ownerName} a annulé l'acceptation : votre candidature est de nouveau en étude.`,
          link: ADOPTION_ROUTES.myApplications,
          actionLabel: "Voir ma candidature",
        });
        break;
      }

      case "confirm-adoption": {
        if (application.status !== "acceptee") throw badRequest("Acceptez d'abord la candidature.");
        const listing = await loadListing();
        const others = await apps
          .find({ listingId: application.listingId, _id: { $ne: id }, status: { $in: OPEN_STATUSES } })
          .toArray();
        await withTransaction((session: ClientSession) => confirmAdoption(session, listing, application, now));
        toApplicant({
          title: `${listing.name} a trouvé sa famille ! 🎉`,
          body: `${listing.ownerName} a confirmé l'adoption. Partagez votre histoire dans Happy Tails !`,
          link: ADOPTION_ROUTES.shareHappyTail(application.listingId),
          actionLabel: "Partager mon Happy Tail",
        });
        others.forEach((a) =>
          notes.push({
            userId: a.applicantId,
            senderId: uid,
            type: "adoption",
            title: `${listing.name} a été adopté(e)`,
            body: `${listing.name} a trouvé une famille : votre candidature est close. Merci pour votre démarche !`,
            link: ADOPTION_ROUTES.feed,
            actionLabel: "Découvrir d'autres animaux",
          }),
        );
        break;
      }

      default:
        throw badRequest("Action inconnue.");
    }

    await notifyUsers(notes);
    const updated = await apps.findOne({ _id: id });
    if (!updated) throw notFound();
    return Response.json(applicationJson(updated));
  });
}

/** L'annonce passe « Adopté », la candidature retenue « Adoptée », les autres candidatures ouvertes sont refusées. */
async function confirmAdoption(session: ClientSession, listing: ListingDoc, application: ApplicationDoc, now: Date) {
  const apps = await applications();
  await mustUpdate(
    (await listings()).updateOne(
      { _id: listing._id, status: "reservee", acceptedApplicationId: application._id },
      {
        $set: {
          status: "adoptee",
          adopterId: application.applicantId,
          adopterName: application.applicantName,
          adoptedAt: now,
          updatedAt: now,
        },
      },
      { session },
    ),
  );
  await mustUpdate(
    apps.updateOne(
      { _id: application._id, status: "acceptee" },
      { $set: { status: "adoptee", adoptedAt: now, updatedAt: now } },
      { session },
    ),
  );
  await apps.updateMany(
    { listingId: application.listingId, _id: { $ne: application._id }, status: { $in: OPEN_STATUSES } },
    { $set: { status: "refusee", decidedAt: now, updatedAt: now } },
    { session },
  );
}
