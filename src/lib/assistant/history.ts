import { api } from "../api";
import { actionFromJson, actionHistoryText, type AssistantAction } from "./actions";
import { parseDay, type ReminderSuggestion } from "./parser";
import { isoDay } from "./prompt";

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
  /** Enregistrements préparés par l'assistant, à confirmer par l'utilisateur. */
  actions?: AssistantAction[];
  rating?: AnswerRating | null;
  /** Message d'erreur affiché à la place d'une réponse (non envoyé au modèle, non enregistré). */
  isError?: boolean;
};

/** Texte renvoyé au modèle dans l'historique : la réponse et l'état de ses actions. */
export const historyText = (m: AssistantMessage) =>
  [m.text, ...(m.actions ?? []).map(actionHistoryText)].filter(Boolean).join("\n");

/** Conversation enregistrée (`/api/assistant/chats`, MongoDB). */
export type AssistantChat = { id: string; title: string; petId?: string | null; petName?: string | null; updatedAt?: string };

type MessageJson = {
  id: string;
  role: "user" | "model";
  text: string;
  listingIds?: string[];
  reminders?: { title: string; dueAt: string }[];
  actions?: unknown[];
  rating?: AnswerRating | null;
};

const chatPath = (chatId: string) => `/api/assistant/chats/${encodeURIComponent(chatId)}`;

/** +1 message aujourd'hui ; l'API refuse (429) au-delà de la limite quotidienne. */
export async function countMessage(): Promise<void> {
  await api("/api/assistant/usage", { method: "POST" });
}

export function listChats(): Promise<AssistantChat[]> {
  return api<AssistantChat[]>("/api/assistant/chats");
}

export async function listMessages(chatId: string): Promise<AssistantMessage[]> {
  const messages = await api<MessageJson[]>(chatPath(chatId));
  return messages.map((m) => ({
    id: m.id,
    fromUser: m.role === "user",
    text: m.text,
    listingIds: m.listingIds ?? [],
    reminders: (m.reminders ?? [])
      .map((r) => ({ title: r.title, dueAt: parseDay(r.dueAt) }))
      .filter((r): r is ReminderSuggestion => Boolean(r.title && r.dueAt)),
    actions: (m.actions ?? []).map(actionFromJson).filter((a): a is AssistantAction => Boolean(a)),
    rating: m.rating ?? null,
  }));
}

/** Crée la conversation à la première question (l'API garde les plus récentes). */
export async function createChat({ firstQuestion, petId, petName }: { firstQuestion: string; petId?: string; petName?: string }) {
  const chat = await api<AssistantChat>("/api/assistant/chats", { method: "POST", body: { title: firstQuestion, petId, petName } });
  return chat.id;
}

/** Ajoute un message et remonte la conversation en tête de l'historique. */
export async function addMessage(chatId: string, message: AssistantMessage, pet?: { id: string; name: string } | null) {
  const saved = await api<MessageJson>(`${chatPath(chatId)}/messages`, {
    method: "POST",
    body: {
      role: message.fromUser ? "user" : "model",
      text: message.text,
      listingIds: message.listingIds ?? [],
      reminders: (message.reminders ?? []).map((r) => ({ title: r.title, dueAt: isoDay(r.dueAt) })),
      actions: message.actions ?? [],
      pet: pet ?? null,
    },
  });
  return saved.id;
}

export function updateMessage(
  chatId: string,
  messageId: string,
  changes: { rating?: AnswerRating | null; actions?: AssistantAction[] },
): Promise<void> {
  return api(`${chatPath(chatId)}/messages/${encodeURIComponent(messageId)}`, { method: "PATCH", body: changes });
}

export function deleteChat(chatId: string): Promise<void> {
  return api(chatPath(chatId), { method: "DELETE" });
}
