// « J'aime » sur une histoire : chacun ajoute (PUT) ou retire (DELETE) uniquement son propre cœur.
import { happyTails } from "@/lib/server/adoption";
import { handle, notFound, requireUser } from "@/lib/server/http";

type Ctx = RouteContext<"/api/adoption/happy-tails/[id]/like">;

async function setLike(request: Request, ctx: Ctx, liked: boolean) {
  const { uid } = await requireUser(request);
  const result = await (await happyTails()).updateOne(
    { _id: (await ctx.params).id },
    liked ? { $addToSet: { likedBy: uid } } : { $pull: { likedBy: uid } },
  );
  if (!result.matchedCount) throw notFound();
  return new Response(null, { status: 204 });
}

export async function PUT(request: Request, ctx: Ctx) {
  return handle(() => setLike(request, ctx, true));
}

export async function DELETE(request: Request, ctx: Ctx) {
  return handle(() => setLike(request, ctx, false));
}
