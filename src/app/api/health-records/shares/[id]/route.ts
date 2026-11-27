// Un lien de partage : désactivation (propriétaire uniquement). Le lien est gardé pour son journal de consultations.
import { healthShares, shareNotFound, shareObjectId, toHealthShare } from "@/lib/server/health-share";
import { handle, requireUser } from "@/lib/server/http";

/** DELETE /api/health-records/shares/:id — désactive le lien immédiatement (sans effet s'il l'est déjà). */
export async function DELETE(request: Request, ctx: RouteContext<"/api/health-records/shares/[id]">) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const _id = shareObjectId((await ctx.params).id);
    const col = await healthShares();
    const share = await col.findOne({ _id, ownerId: uid });
    if (!share) throw shareNotFound();
    if (!share.revokedAt) await col.updateOne({ _id, ownerId: uid }, { $set: { revokedAt: new Date() } });
    const updated = await col.findOne({ _id, ownerId: uid });
    return Response.json({ share: toHealthShare(updated!) });
  });
}
