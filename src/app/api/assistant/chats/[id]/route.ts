// Une conversation : ses messages, ou sa suppression. Propriétaire uniquement.
import { handle, requireUser } from "@/lib/server/http";
import { assistantChats, assistantMessages, messageJson, ownChat } from "@/lib/server/assistant";

type Ctx = RouteContext<"/api/assistant/chats/[id]">;

/** GET /api/assistant/chats/:id — messages de la conversation, dans l'ordre. */
export async function GET(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const chat = await ownChat(uid, (await ctx.params).id);
    const messages = await (await assistantMessages()).find({ chatId: chat._id }).sort({ createdAt: 1 }).toArray();
    return Response.json(messages.map(messageJson));
  });
}

/** DELETE /api/assistant/chats/:id — supprime la conversation et ses messages. */
export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const chat = await ownChat(uid, (await ctx.params).id);
    await (await assistantMessages()).deleteMany({ chatId: chat._id });
    await (await assistantChats()).deleteOne({ _id: chat._id, ownerId: uid });
    return new Response(null, { status: 204 });
  });
}
