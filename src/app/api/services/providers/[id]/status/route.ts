// Validation d'un profil prestataire par un administrateur.
import { REJECTION_REASON_MAX, SERVICES_ROUTES } from "@/lib/services-models";
import { badRequest, handle, HttpError, notFound, readJson, requireUser } from "@/lib/server/http";
import { notifyService, objectId, providerJson, providers, requireAdmin } from "@/lib/server/services";

/**
 * PUT /api/services/providers/:id/status — `{ status: "published" | "rejected", reason? }`.
 * Seul un profil en attente peut être validé ou refusé (409 sinon). Le prestataire est notifié.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/services/providers/[id]/status">) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    await requireAdmin(uid);
    const _id = objectId((await ctx.params).id);
    const body = await readJson(request);
    if (body.status !== "published" && body.status !== "rejected") throw badRequest("Statut attendu : published ou rejected.");
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length > REJECTION_REASON_MAX) throw badRequest(`Motif : ${REJECTION_REASON_MAX} caractères maximum.`);
    if (body.status === "rejected" && reason.length < 3) throw badRequest("Indiquez le motif du refus : le prestataire pourra corriger son profil.");

    const col = await providers();
    const now = new Date();
    const updated = await col.findOneAndUpdate(
      { _id, status: "pending" },
      body.status === "published"
        ? { $set: { status: "published", reviewedAt: now }, $unset: { rejectionReason: "" } }
        : { $set: { status: "rejected", rejectionReason: reason, reviewedAt: now } },
      { returnDocument: "after" },
    );
    if (!updated) {
      if (!(await col.countDocuments({ _id }, { limit: 1 }))) throw notFound();
      throw new HttpError(409, "Ce profil n'est plus en attente de validation.");
    }
    await notifyService([
      body.status === "published"
        ? {
            userId: updated.ownerId,
            senderId: uid,
            title: "Votre profil prestataire est publié",
            body: `${updated.name} apparaît maintenant dans l'annuaire des services.`,
            link: SERVICES_ROUTES.mySpace,
            actionLabel: "Mon espace",
          }
        : {
            userId: updated.ownerId,
            senderId: uid,
            title: "Votre profil prestataire est à corriger",
            body: `Motif : ${reason}. Corrigez votre profil : il repartira en validation.`,
            link: SERVICES_ROUTES.mySpace,
            actionLabel: "Corriger mon profil",
          },
    ]);
    return Response.json(providerJson(updated));
  });
}
