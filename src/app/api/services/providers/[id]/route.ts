// Fiche d'un prestataire : publique s'il est publié ; sinon visible seulement par son propriétaire et les admins.
import { handle, notFound, optionalUser } from "@/lib/server/http";
import { getAvailability, objectId, providerJson, providers, serviceJson, services, userRole } from "@/lib/server/services";

/** GET /api/services/providers/:id — profil, prestations publiées (toutes pour le propriétaire) et disponibilités. */
export async function GET(request: Request, ctx: RouteContext<"/api/services/providers/[id]">) {
  return handle(async () => {
    const user = await optionalUser(request);
    const provider = await (await providers()).findOne({ _id: objectId((await ctx.params).id) });
    if (!provider) throw notFound();
    const owner = user?.uid === provider.ownerId;
    if (provider.status !== "published" && !owner && (!user || (await userRole(user.uid)) !== "admin")) throw notFound();
    const id = provider._id.toHexString();
    const list = await (await services())
      .find({ providerId: id, ...(!owner && { status: "published" as const }) })
      .sort({ name: 1 })
      .toArray();
    return Response.json({ ...providerJson(provider), services: list.map(serviceJson), availability: await getAvailability(id) });
  });
}
