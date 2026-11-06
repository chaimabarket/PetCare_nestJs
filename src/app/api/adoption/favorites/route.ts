// Favoris de l'utilisateur connecté.
import { canRead, favorites, isAdmin, LIST_PROJECTION, listingJson, listings } from "@/lib/server/adoption";
import { handle, requireUser } from "@/lib/server/http";
import { ObjectId } from "mongodb";

/**
 * - par défaut : identifiants des annonces favorites, plus récents d'abord ;
 * - `?include=listings` : les annonces elles-mêmes (celles retirées par leur auteur sont ignorées).
 */
export async function GET(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const ids = (await (await favorites()).find({ userId: uid }).sort({ createdAt: -1 }).toArray()).map((f) => f.listingId);
    if (new URL(request.url).searchParams.get("include") !== "listings") return Response.json(ids);

    const admin = await isAdmin(uid);
    const found = await (await listings())
      .find({ _id: { $in: ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)) } }, { projection: LIST_PROJECTION })
      .toArray();
    const byId = new Map(found.map((l) => [l._id.toHexString(), l]));
    const visible = ids
      .map((id) => byId.get(id))
      .filter((l) => l && l.status !== "brouillon" && canRead(l, uid, admin));
    return Response.json(visible.map((l) => listingJson(l!)));
  });
}
