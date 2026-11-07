import { handle, notFound, readJson, requireUser } from "@/lib/server/http";
import { findMyProvider, objectId, parseService, requireProviderRole, serviceJson, services } from "@/lib/server/services";

/**
 * PUT /api/services/providers/me/services/:serviceId — modifie une de ses prestations ; `status: "archived"`
 * la retire de sa fiche (les réservations passées sont conservées), `"published"` la remet en ligne.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/services/providers/me/services/[serviceId]">) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    await requireProviderRole(uid);
    const provider = await findMyProvider(uid);
    const _id = objectId((await ctx.params).serviceId);
    const input = await parseService(await readJson(request));
    const updated = await (await services()).findOneAndUpdate(
      { _id, providerId: provider._id.toHexString() },
      { $set: { ...input, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!updated) throw notFound();
    return Response.json(serviceJson(updated));
  });
}
