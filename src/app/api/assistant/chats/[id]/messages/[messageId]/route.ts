// Avis 👍 / 👎 sur une réponse, ou état des actions proposées (confirmée, annulée).
import { handle, HttpError, readJson, requireUser } from "@/lib/server/http";
import { assistantMessages, assistantObjectId, messageJson, ownChat, parseMessagePatch } from "@/lib/server/assistant";

type Ctx = RouteContext<"/api/assistant/chats/[id]/messages/[messageId]">;

/** PATCH /api/assistant/chats/:id/messages/:messageId — `{ rating }` et/ou `{ actions }`. */
export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const { id, messageId } = await ctx.params;
    const chat = await ownChat(uid, id);
    const updated = await (await assistantMessages()).findOneAndUpdate(
      { _id: assistantObjectId(messageId), chatId: chat._id, ownerId: uid, role: "model" },
      { $set: parseMessagePatch(await readJson(request)) },
      { returnDocument: "after" },
    );
    if (!updated) throw new HttpError(404, "Ce message n'existe plus.");
    return Response.json(messageJson(updated));
  });
}
