import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { parseDay, type ReminderSuggestion } from "./parser";
import { HISTORY_CHATS, isoDay } from "./prompt";

export type AnswerRating = "up" | "down";

/** Message de la conversation avec l'assistant. */
export type AssistantMessage = {
  /** Identifiant dans l'historique (absent pour un visiteur ou une erreur). */
  id?: string;
  fromUser: boolean;
  text: string;
  /** Annonces d'adoption proposées, affichées en cartes sous le message. */
  listingIds?: string[];
  /** Rappels proposés (animal sélectionné). */
  reminders?: ReminderSuggestion[];
  rating?: AnswerRating | null;
  /** Message d'erreur affiché à la place d'une réponse (non envoyé au modèle, non enregistré). */
  isError?: boolean;
};

/** Conversation enregistrée dans `users/{uid}/assistantChats/{chatId}`. */
export type AssistantChat = { id: string; title: string; petId?: string | null; petName?: string | null; updatedAt?: Timestamp };

const chats = (uid: string) => collection(db(), "users", uid, "assistantChats");
const messages = (uid: string, chatId: string) => collection(db(), "users", uid, "assistantChats", chatId, "messages");

function toFirestore(message: AssistantMessage) {
  return {
    role: message.fromUser ? "user" : "model",
    text: message.text,
    ...(message.listingIds?.length ? { listingIds: message.listingIds } : {}),
    ...(message.reminders?.length
      ? { reminders: message.reminders.map((r) => ({ title: r.title, dueAt: isoDay(r.dueAt) })) }
      : {}),
    createdAt: serverTimestamp(),
  };
}

export async function listChats(uid: string): Promise<AssistantChat[]> {
  const snapshot = await getDocs(query(chats(uid), orderBy("updatedAt", "desc"), limit(HISTORY_CHATS)));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }) as AssistantChat);
}

export async function listMessages(uid: string, chatId: string): Promise<AssistantMessage[]> {
  const snapshot = await getDocs(query(messages(uid, chatId), orderBy("createdAt")));
  return snapshot.docs.map((d) => {
    const data = d.data();
    const reminders = ((data.reminders as { title?: unknown; dueAt?: unknown }[] | undefined) ?? [])
      .map((r) => ({ title: String(r.title ?? ""), dueAt: parseDay(String(r.dueAt ?? "")) }))
      .filter((r): r is ReminderSuggestion => Boolean(r.title && r.dueAt));
    return {
      id: d.id,
      fromUser: data.role === "user",
      text: (data.text as string) ?? "",
      listingIds: (data.listingIds as string[] | undefined) ?? [],
      reminders,
      rating: (data.rating as AnswerRating | null | undefined) ?? null,
    };
  });
}

/** Crée la conversation à la première question, puis supprime les plus anciennes au-delà de la limite. */
export async function createChat(
  uid: string,
  { firstQuestion, petId, petName }: { firstQuestion: string; petId?: string; petName?: string },
): Promise<string> {
  const title = firstQuestion.replace(/\s+/g, " ").trim();
  const ref = await addDoc(chats(uid), {
    title: title.length > 60 ? `${title.slice(0, 57)}…` : title,
    petId: petId ?? null,
    petName: petName ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  void pruneOldChats(uid);
  return ref.id;
}

/** Ajoute un message et remonte la conversation en tête de l'historique. */
export async function addMessage(
  uid: string,
  chatId: string,
  message: AssistantMessage,
  pet?: { id: string; name: string } | null,
): Promise<string> {
  const ref = doc(messages(uid, chatId));
  const batch = writeBatch(db());
  batch.set(ref, toFirestore(message));
  batch.update(doc(chats(uid), chatId), { updatedAt: serverTimestamp(), petId: pet?.id ?? null, petName: pet?.name ?? null });
  await batch.commit();
  return ref.id;
}

export function rateMessage(uid: string, chatId: string, messageId: string, rating: AnswerRating | null) {
  return updateDoc(doc(messages(uid, chatId), messageId), { rating });
}

export async function deleteChat(uid: string, chatId: string): Promise<void> {
  const snapshot = await getDocs(messages(uid, chatId));
  const batch = writeBatch(db());
  snapshot.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  await deleteDoc(doc(chats(uid), chatId));
}

async function pruneOldChats(uid: string) {
  try {
    const snapshot = await getDocs(query(chats(uid), orderBy("updatedAt", "desc")));
    for (const old of snapshot.docs.slice(HISTORY_CHATS)) await deleteChat(uid, old.id);
  } catch {
    // Le nettoyage n'est pas bloquant.
  }
}
