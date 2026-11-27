// Historique privé des conversations avec l'assistant IA.
import { ObjectId } from "mongodb";
import { HISTORY_CHATS } from "@/lib/assistant/limits";
import { handle, readJson, requireUser } from "@/lib/server/http";
import { assistantChats, chatJson, parseChat, pruneOldChats, type AssistantChatDoc } from "@/lib/server/assistant";

/** GET /api/assistant/chats — mes dernières conversations, la plus récente en premier. */
export async function GET(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const chats = await (await assistantChats()).find({ ownerId: uid }).sort({ updatedAt: -1 }).limit(HISTORY_CHATS).toArray();
    return Response.json(chats.map(chatJson));
  });
}

/** POST /api/assistant/chats — nouvelle conversation (à la première question). */
export async function POST(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const now = new Date();
    const doc: AssistantChatDoc = { _id: new ObjectId(), ownerId: uid, ...parseChat(await readJson(request)), createdAt: now, updatedAt: now };
    await (await assistantChats()).insertOne(doc);
    await pruneOldChats(uid);
    return Response.json(chatJson(doc), { status: 201 });
  });
}
