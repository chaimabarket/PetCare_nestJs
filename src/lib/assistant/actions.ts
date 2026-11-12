/**
 * Actions que l'assistant peut préparer : rien n'est enregistré sans la confirmation de l'utilisateur.
 * Fichier sans Firebase (testé avec `npm test`) ; la description des fonctions envoyée à Gemini
 * est construite à partir de ces champs dans `service.ts`.
 */
import type { AssistantPet } from "./pets-model";

export type ActionType = "ajouter_soin" | "ajouter_traitement" | "creer_rendez_vous" | "ajouter_pesee" | "creer_rappel";
export type ActionStatus = "pending" | "done" | "cancelled";
export type ActionArgs = Record<string, string | number>;
export type AssistantAction = { type: ActionType; args: ActionArgs; status: ActionStatus };

type FieldKind = "text" | "date" | "time" | "number" | "choice";
export type ActionField = {
  key: string;
  label: string;
  description: string;
  kind: FieldKind;
  required: boolean;
  options?: readonly string[];
};

const field = (
  key: string,
  label: string,
  description: string,
  { kind = "text", required = true, options }: { kind?: FieldKind; required?: boolean; options?: readonly string[] } = {},
): ActionField => ({ key, label, description, kind, required, options });

const HEALTH_TYPES = ["visite", "vaccin", "examen", "allergie", "note"] as const;
/** Types d'acte du carnet qui demandent le nom du vétérinaire (formulaire du carnet de santé). */
const VET_REQUIRED = ["visite", "vaccin", "examen"];
const APPOINTMENT_TYPES = ["vaccin", "veterinaire", "toilettage", "soin", "education", "garde", "autre"] as const;
const REMINDER_CATEGORIES = ["medicament", "soin", "veterinaire", "traitement", "hygiene", "controle"] as const;

const animal = field("animal", "Animal", "Nom de l'animal, tel qu'il apparaît dans ANIMAUX DE L'UTILISATEUR.");

export const ACTIONS: Record<ActionType, { label: string; goal: string; description: string; fields: ActionField[] }> = {
  ajouter_soin: {
    label: "Ajouter au carnet de santé",
    goal: "ajouter ce soin au carnet",
    description:
      "Prépare un acte du carnet de santé déjà fait (visite, vaccin, examen, allergie ou note) pour un animal de l'utilisateur.",
    fields: [
      animal,
      field("type", "Type", "Type d'acte.", { kind: "choice", options: HEALTH_TYPES }),
      field("titre", "Intitulé", "Intitulé court : « Pollen » pour une allergie, le nom du vaccin pour un vaccin, « Bilan annuel »…"),
      field("date", "Date", "Date de l'acte (AAAA-MM-JJ), aujourd'hui ou dans le passé.", { kind: "date" }),
      field(
        "veterinaire",
        "Vétérinaire",
        "Nom du vétérinaire. Obligatoire pour une visite, un vaccin ou un examen : si l'utilisateur ne l'a pas donné, n'appelle pas la fonction et demande-le.",
        { required: false },
      ),
      field("clinique", "Clinique", "Clinique ou cabinet.", { required: false }),
      field(
        "prochain_rappel",
        "Prochain rappel",
        "Vaccin : date du prochain rappel (AAAA-MM-JJ) donnée par l'utilisateur. Ne la calcule jamais toi-même.",
        { kind: "date", required: false },
      ),
      field("notes", "Notes", "Détails donnés par l'utilisateur.", { required: false }),
    ],
  },
  ajouter_traitement: {
    label: "Ajouter un traitement",
    goal: "ajouter ce traitement",
    description: "Prépare un traitement médicamenteux prescrit pour un animal de l'utilisateur (carnet de santé).",
    fields: [
      animal,
      field("nom", "Médicament", "Nom du médicament ou du produit."),
      field("posologie", "Posologie", "Posologie prescrite, recopiée telle que l'utilisateur l'a donnée."),
      field("debut", "Début", "Date de début (AAAA-MM-JJ), aujourd'hui ou dans le passé.", { kind: "date" }),
      field("fin", "Fin", "Date de fin (AAAA-MM-JJ), le même jour ou après le début.", { kind: "date", required: false }),
      field("veterinaire", "Vétérinaire", "Vétérinaire qui l'a prescrit.", { required: false }),
    ],
  },
  creer_rendez_vous: {
    label: "Créer un rendez-vous",
    goal: "créer ce rendez-vous",
    description: "Prépare un rendez-vous personnel (vétérinaire, toilettage…) pour un animal de l'utilisateur.",
    fields: [
      animal,
      field("titre", "Intitulé", "Intitulé court, par exemple « Vaccin rage » ou « Toilettage »."),
      field("type", "Type", "Type de rendez-vous.", { kind: "choice", options: APPOINTMENT_TYPES }),
      field("date", "Date", "Date du rendez-vous (AAAA-MM-JJ), dans le futur, donnée par l'utilisateur (« demain » est accepté).", {
        kind: "date",
      }),
      field(
        "heure",
        "Heure",
        "Heure de début (HH:MM, sur 24 h), telle que l'utilisateur l'a donnée. Si l'utilisateur ne l'a pas donnée, n'appelle pas la fonction et demande-la.",
        { kind: "time" },
      ),
      field("duree_minutes", "Durée", "Durée en minutes (30 par défaut).", { kind: "number", required: false }),
      field("lieu", "Lieu", "Adresse, clinique ou lieu du rendez-vous.", { required: false }),
    ],
  },
  ajouter_pesee: {
    label: "Ajouter une pesée",
    goal: "ajouter cette pesée",
    description: "Prépare une pesée pour un animal de l'utilisateur.",
    fields: [
      animal,
      field("poids_kg", "Poids", "Poids en kilogrammes.", { kind: "number" }),
      field("date", "Date", "Date de la pesée (AAAA-MM-JJ), aujourd'hui par défaut.", { kind: "date", required: false }),
    ],
  },
  creer_rappel: {
    label: "Créer un rappel",
    goal: "créer ce rappel",
    description: "Prépare un rappel de soin à une date donnée pour un animal de l'utilisateur.",
    fields: [
      animal,
      field("titre", "Intitulé", "Intitulé court qui contient le nom de l'animal, par exemple « Vermifuger Rex »."),
      field("date", "Date", "Date du rappel (AAAA-MM-JJ), aujourd'hui ou dans le futur.", { kind: "date" }),
      field("categorie", "Catégorie", "Catégorie du rappel.", { kind: "choice", required: false, options: REMINDER_CATEGORIES }),
    ],
  },
};

const isActionType = (name: string): name is ActionType => name in ACTIONS;

/** Appel de fonction du modèle → action ; `null` si la fonction est inconnue. Champs inconnus ou vides retirés. */
export function actionFromCall(name: string, args: object): AssistantAction | null {
  if (!isActionType(name)) return null;
  const known = new Set(ACTIONS[name].fields.map((f) => f.key));
  const clean: ActionArgs = {};
  for (const [key, value] of Object.entries(args ?? {})) {
    if (!known.has(key) || value === null || value === undefined) continue;
    if (typeof value === "number") clean[key] = value;
    else if (String(value).trim()) clean[key] = String(value).trim();
  }
  return { type: name, args: clean, status: "pending" };
}

/** Action relue depuis l'historique. */
export function actionFromJson(value: unknown): AssistantAction | null {
  const raw = (value ?? {}) as { type?: unknown; args?: unknown; status?: unknown };
  if (typeof raw.type !== "string" || !isActionType(raw.type) || typeof raw.args !== "object" || !raw.args) return null;
  const status: ActionStatus = raw.status === "done" || raw.status === "cancelled" ? raw.status : "pending";
  return { type: raw.type, args: raw.args as ActionArgs, status };
}

const text = (a: AssistantAction, key: string) => String(a.args[key] ?? "").trim();

/** « 2026-11-13 » → date locale (minuit), ou `undefined` si la date n'existe pas. */
export function actionDate(a: AssistantAction, key: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(a, key));
  if (!match) return undefined;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  return date.getMonth() === m - 1 && date.getDate() === d ? date : undefined;
}

export function actionNumber(a: AssistantAction, key: string): number | undefined {
  const value = a.args[key];
  if (value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/** Début du rendez-vous (date + heure). */
export function actionStartsAt(a: AssistantAction): Date | undefined {
  const day = actionDate(a, "date");
  const match = /^(\d{1,2})[:hH](\d{2})$/.exec(text(a, "heure"));
  if (!day || !match) return undefined;
  const [h, m] = [Number(match[1]), Number(match[2])];
  if (h > 23 || m > 59) return undefined;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

export type ActionCheck = { pet?: AssistantPet; missing: string[]; error?: string };

export const isActionReady = (check: ActionCheck) => Boolean(check.pet) && !check.missing.length && !check.error;

/** Phrase affichée (et gardée dans l'historique) quand l'action ne peut pas être proposée. */
export function actionProblem(a: AssistantAction, check: ActionCheck): string {
  if (check.missing.length) {
    return `Pour ${ACTIONS[a.type].goal}, il me manque : ${check.missing.join(", ")}. Pouvez-vous me les donner ?`;
  }
  return check.error ?? "";
}

/** Vérifie l'action comme le ferait le formulaire : informations manquantes, animal connu, dates cohérentes. */
export function checkAction(a: AssistantAction, pets: AssistantPet[], now = new Date()): ActionCheck {
  const fields = ACTIONS[a.type].fields;
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const missing = fields.filter((f) => f.required && !text(a, f.key)).map((f) => f.label.toLowerCase());
  if (a.type === "ajouter_soin" && VET_REQUIRED.includes(text(a, "type")) && !text(a, "veterinaire")) {
    missing.push("nom du vétérinaire");
  }
  if (missing.length) return { missing };

  const name = text(a, "animal").toLowerCase();
  const pet = pets.find((p) => p.name.trim().toLowerCase() === name);
  if (!pet) {
    return {
      missing: [],
      error: pets.length
        ? `Je ne trouve pas « ${text(a, "animal")} » parmi vos animaux (${pets.map((p) => p.name).join(", ")}). Pour lequel est-ce ?`
        : "Je ne trouve aucun animal dans votre compte. Ajoutez-le d'abord dans « Mes animaux ».",
    };
  }

  for (const f of fields) {
    const value = text(a, f.key);
    if (!value) continue;
    const valid =
      f.kind === "date"
        ? Boolean(actionDate(a, f.key))
        : f.kind === "time"
          ? Boolean(actionStartsAt(a))
          : f.kind === "number"
            ? actionNumber(a, f.key) !== undefined
            : f.kind === "choice"
              ? Boolean(f.options?.includes(value))
              : value.length <= 120 || f.key === "notes" || f.key === "posologie";
    if (!valid) return { pet, missing: [], error: `${f.label} « ${value} » n'est pas valide. Pouvez-vous le préciser ?` };
  }

  let error: string | undefined;
  switch (a.type) {
    case "ajouter_soin": {
      const date = actionDate(a, "date")!;
      const next = actionDate(a, "prochain_rappel");
      if (date > now) {
        error =
          "Le carnet de santé note les soins déjà faits : la date ne peut pas être dans le futur. Voulez-vous plutôt un rendez-vous ou un rappel ?";
      } else if (next && next <= date) {
        error = "Le prochain rappel doit être après la date du soin. Quelle date souhaitez-vous ?";
      }
      break;
    }
    case "ajouter_traitement": {
      const start = actionDate(a, "debut")!;
      const end = actionDate(a, "fin");
      if (start > now) error = "Le début du traitement ne peut pas être dans le futur.";
      else if (end && end < start) error = "La fin du traitement doit être après son début.";
      break;
    }
    case "creer_rendez_vous": {
      const minutes = actionNumber(a, "duree_minutes");
      if (actionStartsAt(a)! <= now) error = "Le rendez-vous doit être dans le futur. Quelle date et quelle heure ?";
      else if (minutes !== undefined && (minutes < 5 || minutes > 24 * 60)) error = "La durée doit être entre 5 minutes et 24 heures.";
      break;
    }
    case "ajouter_pesee": {
      const kg = actionNumber(a, "poids_kg")!;
      if (kg <= 0 || kg > 500) error = "Le poids doit être compris entre 0 et 500 kg.";
      else if ((actionDate(a, "date") ?? startOfDay) > now) error = "Une pesée ne peut pas être datée dans le futur.";
      break;
    }
    case "creer_rappel":
      if (actionDate(a, "date")! < startOfDay) error = "Le rappel doit être aujourd'hui ou plus tard. Quelle date ?";
      break;
  }
  return { pet, missing: [], error };
}

const CHOICE_LABELS: Record<string, string> = {
  visite: "Visite",
  vaccin: "Vaccin",
  examen: "Examen",
  allergie: "Allergie",
  note: "Note",
  veterinaire: "Vétérinaire",
  toilettage: "Toilettage",
  soin: "Soin",
  education: "Séance éducation",
  garde: "Garde / Promenade",
  autre: "Autre",
  medicament: "Médicament",
  traitement: "Traitement",
  hygiene: "Hygiène",
  controle: "Contrôle",
};

const day = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/** Lignes « libellé : valeur » de la carte de confirmation. */
export function describeAction(a: AssistantAction): [string, string][] {
  return ACTIONS[a.type].fields
    .filter((f) => text(a, f.key))
    .map((f) => {
      const value = text(a, f.key);
      if (f.kind === "date") return [f.label, actionDate(a, f.key) ? day(actionDate(a, f.key)!) : value];
      if (f.key === "poids_kg") return [f.label, `${value} kg`];
      if (f.key === "duree_minutes") return [f.label, `${value} min`];
      if (f.kind === "choice") return [f.label, CHOICE_LABELS[value] ?? value];
      return [f.label, value];
    });
}

/** Version texte envoyée au modèle avec l'historique, pour qu'il sache ce qui a été confirmé ou non. */
export function actionHistoryText(a: AssistantAction): string {
  const status = {
    pending: "proposée, pas encore confirmée par l'utilisateur",
    done: "confirmée et enregistrée par l'utilisateur",
    cancelled: "annulée par l'utilisateur",
  }[a.status];
  const details = describeAction(a)
    .map(([label, value]) => `${label} : ${value}`)
    .join(", ");
  return `[Action « ${ACTIONS[a.type].label} » ${status} — ${details}]`;
}
