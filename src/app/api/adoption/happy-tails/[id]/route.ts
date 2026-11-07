// L'histoire d'une adoption (id = id de l'annonce), ou `null` si elle n'est pas encore publiée.
import { happyTailJson, happyTails } from "@/lib/server/adoption";
import { handle } from "@/lib/server/http";

export async function GET(_request: Request, ctx: RouteContext<"/api/adoption/happy-tails/[id]">) {
  return handle(async () => {
    const tail = await (await happyTails()).findOne({ _id: (await ctx.params).id });
    return Response.json(tail ? happyTailJson(tail) : null);
  });
}
