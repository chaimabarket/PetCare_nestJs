import "server-only";
import { ObjectId, type Collection } from "mongodb";
import { DAILY_LIMIT, HISTORY_CHATS } from "@/lib/assistant/limits";
import { badRequest, HttpError } from "./http";
import { mongo } from "./mongo";

/** Compteur de messages du jour : `_id` = `{uid}_{AAAA-MM-JJ}`. */
export type AssistantUsageDoc = { _id: string; uid: string; day: string; count: number; updatedAt: Date };

export type AssistantChatDoc = {
  _id: ObjectId;
  ownerId: string;
  title: string;
  petId: string | null;
  petName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AssistantMessageDoc = {
  _id: ObjectId;
  chatId: ObjectId;
  ownerId: string;
  role: "user" | "model";
  text: string;
  listingIds: string[];
  reminders: { title: string; dueAt: string }[];
  actions: { type: string; args: Record<string, string | number>; status: string }[];
  rating: "up" | "down" | null;
  createdAt: Date;
};

export async function assistantUsage(): Promise<Collection<AssistantUsageDoc>> {
  return (await mongo()).collection<AssistantUsageDoc>("assistantUsage");
}

export async function assistantChats(): Promise<Collection<AssistantChatDoc>> {
  const collection = (await mongo()).collection<AssistantChatDoc>("assistantChats");
  await collection.createIndex({ ownerId: 1, updatedAt: -1 });
  return collection;
}

export async function assistantMessages(): Promise<Collection<AssistantMessageDoc>> {
  const collection = (await mongo()).collection<AssistantMessageDoc>("assistantMessages");
  await collection.createIndex({ chatId: 1, createdAt: 1 });
  return collection;
}

const chatNotFound = () => new HttpError(404, "Cette conversation n'existe plus.");

export function assistantObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id) || id.length !== 24) throw chatNotFound();
  return new ObjectId(id);
}

/** Conversation de l'utilisateur, sinon 404 (jamais celle d'un autre). */
export async function ownChat(uid: string, id: string): Promise<AssistantChatDoc> {
  const chat = await (await assistantChats()).findOne({ _id: assistantObjectId(id), ownerId: uid });
  if (!chat) throw chatNotFound();
  return chat;
}

/**
 * +1 au compteur du jour, refusé au-delà de la limite : la condition `count < limite` et
 * l'incrément sont une seule opération MongoDB, donc deux onglets ne peuvent pas dépasser la limite.
 */
export async function countMessage(uid: string, now = new Date()): Promise<number> {
  const day = now.toISOString().slice(0, 10);
  try {
    const doc = await (await assistantUsage()).findOneAndUpdate(
      { _id: `${uid}_${day}`, count: { $lt: DAILY_LIMIT } },
      { $inc: { count: 1 }, $set: { updatedAt: now }, $setOnInsert: { uid, day } },
      { upsert: true, returnDocument: "after" },
    );
    return doc?.count ?? 1;
  } catch (error) {
    // Limite atteinte : le document existe mais ne correspond pas au filtre, l'insertion échoue (clé en double).
    if ((error as { code?: number }).code === 11000) {
      throw new HttpError(429, `Vous avez atteint vos ${DAILY_LIMIT} messages du jour. À demain ! 🐾`);
    }
    throw error;
  }
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Nouvelle conversation : titre tiré de la première question. */
export function parseChat(body: Record<string, unknown>) {
  const title = text(body.title, 200).replace(/\s+/g, " ");
  if (!title) throw badRequest("Le titre est obligatoire.");
  return {
    title: title.length > 60 ? `${title.slice(0, 57)}…` : title,
    petId: text(body.petId, 128) || null,
    petName: text(body.petName, 80) || null,
  };
}

const ACTION_STATUSES = ["pending", "done", "cancelled"];

function parseActions(value: unknown): AssistantMessageDoc["actions"] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 3) throw badRequest("Actions invalides.");
  return value.map((raw) => {
    const a = (raw ?? {}) as Record<string, unknown>;
    const args = (a.args ?? {}) as Record<string, unknown>;
    if (typeof args !== "object" || Object.keys(args).length > 12) throw badRequest("Action invalide.");
    return {
      type: text(a.type, 40),
      args: Object.fromEntries(
        Object.entries(args)
          .filter(([, v]) => typeof v === "string" || typeof v === "number")
          .map(([k, v]) => [k.slice(0, 40), typeof v === "string" ? v.slice(0, 500) : v]),
      ) as Record<string, string | number>,
      status: ACTION_STATUSES.includes(a.status as string) ? (a.status as string) : "pending",
    };
  });
}

/** Message ajouté à une conversation (question ou réponse de l'assistant). */
export function parseMessage(body: Record<string, unknown>) {
  if (body.role !== "user" && body.role !== "model") throw badRequest("Rôle invalide.");
  const messageText = text(body.text, 4000);
  if (!messageText) throw badRequest("Le message est vide.");
  const listingIds = Array.isArray(body.listingIds) ? body.listingIds.slice(0, 3).map((id) => text(id, 64)) : [];
  const reminders = Array.isArray(body.reminders)
    ? body.reminders.slice(0, 2).map((r) => {
        const reminder = (r ?? {}) as Record<string, unknown>;
        return { title: text(reminder.title, 80), dueAt: text(reminder.dueAt, 10) };
      })
    : [];
  return { role: body.role as "user" | "model", text: messageText, listingIds, reminders, actions: parseActions(body.actions) };
}

/** Changements autorisés sur un message : l'avis 👍 / 👎 et l'état des actions proposées. */
export function parseMessagePatch(body: Record<string, unknown>) {
  const changes: Partial<Pick<AssistantMessageDoc, "rating" | "actions">> = {};
  if ("rating" in body) {
    if (body.rating !== null && body.rating !== "up" && body.rating !== "down") throw badRequest("Avis invalide.");
    changes.rating = body.rating;
  }
  if ("actions" in body) changes.actions = parseActions(body.actions);
  if (!Object.keys(changes).length) throw badRequest("Rien à modifier.");
  return changes;
}

/** Garde les {@link HISTORY_CHATS} conversations les plus récentes. */
export async function pruneOldChats(uid: string): Promise<void> {
  const chats = await assistantChats();
  const old = await chats.find({ ownerId: uid }).sort({ updatedAt: -1 }).skip(HISTORY_CHATS).project({ _id: 1 }).toArray();
  if (!old.length) return;
  const ids = old.map((c) => c._id);
  await (await assistantMessages()).deleteMany({ chatId: { $in: ids } });
  await chats.deleteMany({ _id: { $in: ids }, ownerId: uid });
}

export function chatJson({ _id, createdAt, updatedAt, ...rest }: AssistantChatDoc) {
  return { ...rest, id: _id.toHexString(), createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
}

export function messageJson({ _id, chatId, createdAt, ...rest }: AssistantMessageDoc) {
  return { ...rest, id: _id.toHexString(), chatId: chatId.toHexString(), createdAt: createdAt.toISOString() };
}
