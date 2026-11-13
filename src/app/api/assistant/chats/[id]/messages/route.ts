// Ajout d'un message (question ou réponse) à une conversation de l'utilisateur.
import { ObjectId } from "mongodb";
import { handle, readJson, requireUser } from "@/lib/server/http";
import { assistantChats, assistantMessages, messageJson, ownChat, parseMessage, type AssistantMessageDoc } from "@/lib/server/assistant";

type Ctx = RouteContext<"/api/assistant/chats/[id]/messages">;

/** POST /api/assistant/chats/:id/messages — ajoute le message et remonte la conversation en tête. */
export async function POST(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const chat = await ownChat(uid, (await ctx.params).id);
    const body = await readJson(request);
    const now = new Date();
    const doc: AssistantMessageDoc = { _id: new ObjectId(), chatId: chat._id, ownerId: uid, ...parseMessage(body), rating: null, createdAt: now };
    await (await assistantMessages()).insertOne(doc);
    const pet = (body.pet ?? null) as { id?: unknown; name?: unknown } | null;
    await (await assistantChats()).updateOne(
      { _id: chat._id, ownerId: uid },
      {
        $set: {
          updatedAt: now,
          petId: typeof pet?.id === "string" ? pet.id.slice(0, 128) : null,
          petName: typeof pet?.name === "string" ? pet.name.slice(0, 80) : null,
        },
      },
    );
    return Response.json(messageJson(doc), { status: 201 });
  });
}
