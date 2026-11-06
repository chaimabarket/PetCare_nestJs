// Annonces de l'utilisateur connecté, tous statuts (page « Mes annonces »).
import { LIST_PROJECTION, listingJson, listings } from "@/lib/server/adoption";
import { handle, requireUser } from "@/lib/server/http";

export async function GET(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const items = await (await listings())
      .find({ ownerId: uid }, { projection: LIST_PROJECTION })
      .sort({ publishedAt: -1, createdAt: -1 })
      .toArray();
    return Response.json(items.map(listingJson));
  });
}
