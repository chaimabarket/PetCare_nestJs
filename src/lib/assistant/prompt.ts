/**
 * Texte fixe de l'assistant IA : consignes du modèle, questions recommandées et détection
 * des questions d'adoption. Même contenu que la version Flutter.
 */
import type { AssistantPet } from "./pets";
import { isSenior, isYoung } from "./pets";

/**
 * Modèle Gemini gratuit (Gemini Developer API, plan Spark).
 * Vérifier le nom dans la console Firebase (AI Logic) : Google renomme parfois ses modèles.
 */
export const ASSISTANT_MODEL = "gemini-2.5-flash-lite";

/** Messages par utilisateur connecté et par jour (protège le quota gratuit). Même valeur dans firestore.rules. */
export const DAILY_LIMIT = 30;
export const QUESTION_MAX_LENGTH = 500;
/** Nombre de messages précédents envoyés au modèle. */
export const HISTORY_LENGTH = 10;
export const MAX_LISTING_SUGGESTIONS = 3;
export const MAX_REMINDERS = 2;
/** Conversations gardées dans l'historique. */
export const HISTORY_CHATS = 10;

export const SYSTEM_PROMPT = `Tu es « Assistant PetCare », l'assistant de l'application PetCare Community (Tunisie).
Règles :
- Réponds toujours en français, avec un ton chaleureux, clair et court (5 phrases ou une liste de 5 points maximum).
- Sujets autorisés : soins des animaux de compagnie, alimentation, comportement, éducation, hygiène,
  adoption, et utilisation de l'application PetCare. Pour tout autre sujet, dis poliment que tu ne peux
  parler que des animaux et de PetCare.
- Tu n'es pas vétérinaire : ne pose jamais de diagnostic et ne donne pas de dosage de médicament.
  Pour un problème de santé, conseille de consulter un vétérinaire.
- Urgence (saignement, poison avalé, difficulté à respirer, convulsions, animal qui ne bouge plus) :
  commence par « ⚠️ Urgence : contactez immédiatement un vétérinaire. »
- ANIMAL SÉLECTIONNÉ : si ce bloc est fourni, adapte ta réponse à cet animal (espèce, âge, poids, notes,
  carnet de santé) et appelle-le par son nom.
- Rappels : seulement si un ANIMAL SÉLECTIONNÉ est fourni et que tu conseilles un soin à faire à une date
  précise ou de façon régulière (vermifuge, antiparasitaire, vaccin, contrôle vétérinaire, toilettage,
  coupe des griffes…), ajoute à la fin au plus 2 tags [[rappel:Intitulé court|AAAA-MM-JJ]] avec la
  prochaine date conseillée, calculée à partir de la DATE DU JOUR. L'intitulé contient le nom de l'animal
  (ex. [[rappel:Vermifuger Rocky|2027-01-30]]). Sans animal sélectionné, n'ajoute jamais ce tag.
- Annonces d'adoption : tu ne peux proposer QUE des animaux présents dans la liste ANNONCES fournie.
  N'invente jamais d'animal. Pour chaque animal proposé, ajoute le tag [[annonce:ID]] avec son identifiant
  exact, et explique en une phrase pourquoi il correspond. Propose 3 animaux maximum.
  Si aucun ne correspond, dis-le et propose d'élargir les critères.
  Si aucune liste ANNONCES n'est fournie, ne propose aucun animal précis.
  Rappelle que la décision finale revient au refuge ou au propriétaire de l'annonce.
- N'utilise pas de Markdown sauf des listes à puces avec « - ».`;

/** Consignes de « Rédiger avec l'IA » (formulaire d'annonce d'adoption). */
export const LISTING_WRITER_PROMPT = `Tu rédiges la description d'une annonce d'adoption pour l'application PetCare Community.
- En français, 3 à 5 phrases chaleureuses, à la première personne du refuge ou du propriétaire.
- Utilise uniquement les informations fournies : n'invente ni histoire, ni maladie, ni détail.
- Mets en avant le caractère et le type de foyer idéal. Pas de Markdown, pas d'emoji, pas de titre.`;

/** Question recommandée ; `adoption` joint les annonces disponibles. */
export type Suggestion = { label: string; question: string; adoption: boolean };

const q = (emoji: string, question: string): Suggestion => ({ label: `${emoji} ${question}`, question, adoption: false });

const FIND_COMPANION: Suggestion = {
  label: "🐾 Trouver mon compagnon idéal",
  question: "Aide-moi à trouver un animal à adopter qui correspond à mon mode de vie.",
  adoption: true,
};

/** 5 questions recommandées selon le contexte : visiteur, utilisateur, ou animal sélectionné. */
export function recommendedQuestions(signedIn: boolean, pet?: AssistantPet | null, now = new Date()): Suggestion[] {
  if (pet) return petQuestions(pet, now);
  if (!signedIn) {
    return [
      FIND_COMPANION,
      q("🏠", "Comment préparer la maison pour l'arrivée d'un animal adopté ?"),
      q("🐶", "Chien ou chat : lequel choisir pour un appartement ?"),
      q("💰", "Quel budget prévoir pour un premier animal ?"),
      q("📋", "Comment se passe une adoption sur PetCare ?"),
    ];
  }
  return [
    FIND_COMPANION,
    q("🍖", "Comment bien nourrir mon animal ?"),
    q("🐱", "Mon chat griffe le canapé, que faire ?"),
    q("✈️", "Comment faire garder mon animal pendant les vacances ?"),
    q("🌡️", "Comment protéger mon animal de la chaleur en été ?"),
  ];
}

function petQuestions(pet: AssistantPet, now: Date): Suggestion[] {
  const n = pet.name;
  const young = isYoung(pet, now);
  const senior = isSenior(pet, now);
  if (pet.species === "dog") {
    if (young) {
      return [
        q("💉", `Quels vaccins pour ${n} et à quelles dates ?`),
        q("🍖", `Combien de repas par jour pour ${n} ?`),
        q("🏠", `Comment apprendre la propreté à ${n} ?`),
        q("🐕", `Comment bien socialiser ${n} ?`),
        q("🪱", `Quand vermifuger ${n} ?`),
      ];
    }
    if (senior) {
      return [
        q("🦴", `Comment prendre soin des articulations de ${n} ?`),
        q("🩺", `Quel suivi vétérinaire pour ${n} à son âge ?`),
        q("🍖", `Quelle alimentation pour ${n}, chien senior ?`),
        q("🚶", `Combien d'exercice pour ${n} ?`),
        q("🦷", `Comment entretenir les dents de ${n} ?`),
      ];
    }
    return [
      q("🪱", `Quel calendrier de vermifuge et antiparasitaire pour ${n} ?`),
      q("🍖", `Quelle quantité de croquettes pour ${n} ?`),
      q("🚶", `Combien d'activité par jour pour ${n} ?`),
      q("🦷", `Comment entretenir les dents de ${n} ?`),
      q("💉", `Quand faire le rappel de vaccin de ${n} ?`),
    ];
  }
  if (pet.species === "cat") {
    if (young) {
      return [
        q("💉", `Quels vaccins pour ${n} et à quelles dates ?`),
        q("🍖", `Combien de repas par jour pour ${n} ?`),
        q("🪣", `Comment habituer ${n} à la litière ?`),
        q("✂️", `À quel âge stériliser ${n} ?`),
        q("🪱", `Quand vermifuger ${n} ?`),
      ];
    }
    if (senior) {
      return [
        q("🩺", `Quel suivi vétérinaire pour ${n} à son âge ?`),
        q("💧", `Comment faire boire davantage ${n} ?`),
        q("🍖", `Quelle alimentation pour ${n}, chat senior ?`),
        q("🦷", `Comment surveiller les dents de ${n} ?`),
        q("🛋️", `Comment adapter la maison au confort de ${n} ?`),
      ];
    }
    return [
      q("🪱", `Quel calendrier de vermifuge et antiparasitaire pour ${n} ?`),
      q("⚖️", `Quel est le poids idéal pour ${n} ?`),
      q("🐱", `Comment éviter que ${n} griffe les meubles ?`),
      q("🧶", `Comment occuper ${n} en appartement ?`),
      q("💉", `Quand faire le rappel de vaccin de ${n} ?`),
    ];
  }
  return [
    q("🥕", `Quelle alimentation pour ${n} ?`),
    q("🏠", `Quel habitat idéal pour ${n} ?`),
    q("🩺", `Quels signes de bonne santé surveiller chez ${n} ?`),
    q("🧼", `Comment entretenir l'espace de ${n} ?`),
    q("🎾", `Comment occuper et stimuler ${n} ?`),
  ];
}

const ADOPTION_KEYWORDS = [
  "adopt",
  "compagnon",
  "quel animal",
  "quel chien",
  "quel chat",
  "quelle race",
  "me convien",
  "me correspond",
  "disponible",
  "annonce",
  "refuge",
];

/** Vrai si la question concerne le choix d'un animal à adopter : on joint alors les annonces. */
export function isAdoptionQuestion(question: string): boolean {
  const text = question.toLowerCase();
  return ADOPTION_KEYWORDS.some((k) => text.includes(k));
}

/** « 2026-10-30 » (date locale), pour la DATE DU JOUR et les identifiants de jour. */
export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
