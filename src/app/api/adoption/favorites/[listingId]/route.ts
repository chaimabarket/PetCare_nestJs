// Ajouter (PUT) ou retirer (DELETE) une annonce des favoris.
import { canRead, favorites, isAdmin, listingObjectId, listings } from "@/lib/server/adoption";
import { handle, notFound, requireUser } from "@/lib/server/http";

type Ctx = RouteContext<"/api/adoption/favorites/[listingId]">;

export async function PUT(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const { listingId } = await ctx.params;
    const listing = await (await listings()).findOne({ _id: listingObjectId(listingId) });
    if (!listing || !canRead(listing, uid, await isAdmin(uid))) throw notFound();
    await (await favorites()).updateOne(
      { _id: `${uid}_${listingId}` },
      { $setOnInsert: { userId: uid, listingId, createdAt: new Date() } },
      { upsert: true },
    );
    return new Response(null, { status: 204 });
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const { listingId } = await ctx.params;
    await (await favorites()).deleteOne({ _id: `${uid}_${listingId}` });
    return new Response(null, { status: 204 });
  });
}
