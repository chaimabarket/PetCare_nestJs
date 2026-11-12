import { AIError, getAI, getGenerativeModel, GoogleAIBackend, Schema, type Content, type FunctionCall, type GenerativeModel } from "firebase/ai";
import { getApp } from "firebase/app";
import { ENERGY_LEVELS, listPublicListings, PERSONALITY, SEXES, SIZES, SPECIES, type AdoptionListing, type ListingInput } from "../adoption";
import { byNewest } from "../adoption-models";
import { auth } from "../firebase";
import { ACTIONS, type ActionField, type ActionType } from "./actions";
import { historyText, type AssistantMessage } from "./history";
import { ACTIONS_PROMPT, ASSISTANT_MODEL, HISTORY_LENGTH, LISTING_WRITER_PROMPT, SYSTEM_PROMPT } from "./prompt";

/** Erreur affichable telle quelle dans la conversation. */
export class AssistantError extends Error {}

/** Réponse en cours : texte cumulé et actions demandées par le modèle. */
export type AssistantReply = { text: string; calls: FunctionCall[] };

const schemaOf = (f: ActionField) =>
  f.kind === "number"
    ? Schema.number({ description: f.description })
    : f.kind === "choice"
      ? Schema.enumString({ enum: [...(f.options ?? [])], description: f.description })
      : Schema.string({ description: f.description });

/** Fonctions décrites au modèle : les champs obligatoires lui indiquent quoi demander. */
const ACTION_TOOLS = [
  {
    functionDeclarations: (Object.keys(ACTIONS) as ActionType[]).map((name) => ({
      name,
      description: ACTIONS[name].description,
      parameters: Schema.object({
        properties: Object.fromEntries(ACTIONS[name].fields.map((f) => [f.key, schemaOf(f)])),
        optionalProperties: ACTIONS[name].fields.filter((f) => !f.required).map((f) => f.key),
      }),
    })),
  },
];

// GoogleAIBackend = Gemini Developer API, utilisable sur le plan gratuit. Ne pas passer à VertexAIBackend.
let cached: { chat: GenerativeModel; actions: GenerativeModel; writer: GenerativeModel } | null = null;

function models() {
  if (!cached) {
    auth(); // initialise l'application Firebase
    const ai = getAI(getApp(), { backend: new GoogleAIBackend() });
    cached = {
      chat: getGenerativeModel(ai, {
        model: ASSISTANT_MODEL,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: { temperature: 0.4, maxOutputTokens: 700 },
      }),
      // Même modèle avec les fonctions d'enregistrement : il prépare l'action, l'utilisateur la confirme.
      actions: getGenerativeModel(ai, {
        model: ASSISTANT_MODEL,
        systemInstruction: `${SYSTEM_PROMPT}\n${ACTIONS_PROMPT}`,
        generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
        tools: ACTION_TOOLS,
      }),
      writer: getGenerativeModel(ai, {
        model: ASSISTANT_MODEL,
        systemInstruction: LISTING_WRITER_PROMPT,
        generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
      }),
    };
  }
  return cached;
}

/** Annonces disponibles, jointes aux questions d'adoption. */
export async function fetchAvailableListings(): Promise<AdoptionListing[]> {
  const listings = await listPublicListings();
  return listings.filter((l) => l.status === "disponible").sort(byNewest);
}

/**
 * Envoie la question avec les derniers messages ; renvoie la réponse au fur et à mesure.
 * `context` (date du jour, animaux, annonces) est ajouté à la question sans être affiché.
 * `withActions` donne au modèle les fonctions d'enregistrement (utilisateur connecté).
 */
export async function* reply(
  history: AssistantMessage[],
  question: string,
  context: string,
  { withActions = false } = {},
): AsyncGenerator<AssistantReply> {
  const previous = history.filter((m) => !m.isError && historyText(m));
  const content = (fromUser: boolean, text: string): Content => ({
    role: fromUser ? "user" : "model",
    parts: [{ type: "text", text }],
  });
  const contents = [
    ...previous.slice(-HISTORY_LENGTH).map((m) => content(m.fromUser, m.fromUser ? m.text : historyText(m))),
    content(true, `${context}\n\nQUESTION : ${question}`),
  ];
  let answer = "";
  const calls: FunctionCall[] = [];
  try {
    const model = withActions ? models().actions : models().chat;
    const result = await model.generateContentStream({ contents });
    for await (const chunk of result.stream) {
      const newCalls = chunk.functionCalls() ?? [];
      calls.push(...newCalls);
      const text = chunk.text();
      if (text) answer += text;
      if (text || newCalls.length) yield { text: answer, calls: [...calls] };
    }
  } catch (error) {
    throw toAssistantError(error);
  }
  if (!answer && !calls.length) throw new AssistantError("Je ne peux pas répondre à cette question. Essayez de la reformuler.");
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
    const result = await models().writer.generateContent(facts.join("\n"));
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
