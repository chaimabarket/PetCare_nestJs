import { doc, getDocs, collection, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { AIError, getAI, getGenerativeModel, GoogleAIBackend, type Content, type GenerativeModel } from "firebase/ai";
import { getApp } from "firebase/app";
import { db } from "../firebase";
import { ENERGY_LEVELS, PERSONALITY, SEXES, SIZES, SPECIES, type AdoptionListing, type ListingInput } from "../adoption";
import type { AssistantMessage } from "./history";
import { ASSISTANT_MODEL, DAILY_LIMIT, HISTORY_LENGTH, isoDay, LISTING_WRITER_PROMPT, SYSTEM_PROMPT } from "./prompt";

/** Erreur affichable telle quelle dans la conversation. */
export class AssistantError extends Error {}

export const LIMIT_REACHED = `Vous avez atteint vos ${DAILY_LIMIT} messages du jour. À demain ! 🐾`;

// GoogleAIBackend = Gemini Developer API, utilisable sur le plan gratuit. Ne pas passer à VertexAIBackend.
let chatModel: GenerativeModel | null = null;
let writerModel: GenerativeModel | null = null;

function models() {
  if (!chatModel || !writerModel) {
    db(); // initialise l'application Firebase
    const ai = getAI(getApp(), { backend: new GoogleAIBackend() });
    chatModel = getGenerativeModel(ai, {
      model: ASSISTANT_MODEL,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: { temperature: 0.4, maxOutputTokens: 700 },
    });
    writerModel = getGenerativeModel(ai, {
      model: ASSISTANT_MODEL,
      systemInstruction: LISTING_WRITER_PROMPT,
      generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
    });
  }
  return { chatModel, writerModel };
}

/** Annonces disponibles, jointes aux questions d'adoption. */
export async function fetchAvailableListings(): Promise<AdoptionListing[]> {
  const snapshot = await getDocs(query(collection(db(), "adoptionListings"), where("status", "==", "disponible")));
  const millis = (l: AdoptionListing) => (l.publishedAt ?? l.createdAt)?.toMillis() ?? 0;
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as AdoptionListing)
    .sort((a, b) => millis(b) - millis(a));
}

/** Compte un message dans `users/{uid}/assistantUsage/{jour}` ; refuse au-delà de la limite. */
export async function countMessage(uid: string): Promise<void> {
  const ref = doc(db(), "users", uid, "assistantUsage", isoDay(new Date()));
  try {
    await runTransaction(db(), async (tx) => {
      const snapshot = await tx.get(ref);
      const count = (snapshot.data()?.count as number | undefined) ?? 0;
      if (count >= DAILY_LIMIT) throw new AssistantError(LIMIT_REACHED);
      tx.set(ref, { count: count + 1, updatedAt: serverTimestamp() });
    });
  } catch (error) {
    if (error instanceof AssistantError) throw error;
    console.error("Compteur de l'assistant :", error);
    const denied = (error as { code?: string }).code === "permission-denied";
    throw new AssistantError(denied ? LIMIT_REACHED : "Impossible d'envoyer le message. Vérifiez votre connexion.");
  }
}

/**
 * Envoie la question avec les derniers messages ; renvoie la réponse au fur et à mesure (texte cumulé).
 * `context` (date du jour, animal sélectionné, annonces) est ajouté à la question sans être affiché.
 */
export async function* reply(history: AssistantMessage[], question: string, context: string): AsyncGenerator<string> {
  const previous = history.filter((m) => !m.isError && m.text);
  const content = (fromUser: boolean, text: string): Content => ({
    role: fromUser ? "user" : "model",
    parts: [{ type: "text", text }],
  });
  const contents = [
    ...previous.slice(-HISTORY_LENGTH).map((m) => content(m.fromUser, m.text)),
    content(true, `${context}\n\nQUESTION : ${question}`),
  ];
  let answer = "";
  try {
    const result = await models().chatModel.generateContentStream({ contents });
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (!text) continue;
      answer += text;
      yield answer;
    }
  } catch (error) {
    throw toAssistantError(error);
  }
  if (!answer) throw new AssistantError("Je ne peux pas répondre à cette question. Essayez de la reformuler.");
}

/** « Rédiger avec l'IA » : description d'annonce à partir des champs du formulaire. */
export async function writeListingDescription(form: ListingInput): Promise<string> {
  const facts = [
    `Nom : ${form.name.trim()}`,
    `Espèce : ${SPECIES[form.species].label}`,
    form.breed.trim() ? `Race : ${form.breed.trim()}` : null,
    `Sexe : ${SEXES[form.sex].label}`,
    form.ageLabel.trim() ? `Âge : ${form.ageLabel.trim()}` : null,
    `Gabarit : ${SIZES[form.size]}`,
    form.personality.length ? `Personnalité : ${form.personality.map((p) => PERSONALITY[p].label).join(", ")}` : null,
    `Énergie : ${ENERGY_LEVELS[form.energy]}`,
    `Entente enfants : ${form.compatibility.kids ? "oui" : "non"}`,
    `Entente chats : ${form.compatibility.cats ? "oui" : "non"}`,
    `Entente chiens : ${form.compatibility.dogs ? "oui" : "non"}`,
    form.compatibility.garden ? "Besoin d'un jardin" : null,
    `Peut rester seul : ${form.aloneHours} h`,
    form.story.trim() ? `Notes actuelles : ${form.story.trim()}` : null,
  ].filter(Boolean);
  try {
    const result = await models().writerModel.generateContent(facts.join("\n"));
    const text = result.response.text().trim();
    if (!text) throw new AssistantError("L'IA n'a pas pu rédiger de description. Réessayez.");
    return text;
  } catch (error) {
    throw toAssistantError(error);
  }
}

function toAssistantError(error: unknown): AssistantError {
  if (error instanceof AssistantError) return error;
  console.error("Assistant IA :", error);
  if (error instanceof AIError) {
    const message = error.message.toLowerCase();
    if (error.code === "api-not-enabled") return new AssistantError("L'assistant n'est pas encore activé pour ce projet.");
    if (message.includes("429") || message.includes("quota") || message.includes("resource_exhausted")) {
      return new AssistantError("L'assistant est très demandé, réessayez dans quelques minutes.");
    }
    if (message.includes("blocked") || message.includes("safety")) {
      return new AssistantError("Je ne peux pas répondre à cette question. Essayez de la reformuler.");
    }
    if (error.code === "fetch-error" && typeof navigator !== "undefined" && !navigator.onLine) {
      return new AssistantError("Pas de connexion internet. Vérifiez votre réseau et réessayez.");
    }
    return new AssistantError("L'assistant n'est pas disponible pour le moment. Réessayez plus tard.");
  }
  return new AssistantError("Pas de connexion internet. Vérifiez votre réseau et réessayez.");
}
