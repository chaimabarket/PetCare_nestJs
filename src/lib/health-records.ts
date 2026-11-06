import type { FieldErrors } from "./validation";

/**
 * Module 2 — Carnet de santé.
 * Données stockées dans MongoDB (collection `health_records`), via les routes /api/health-records.
 * Ce fichier ne dépend ni de Firebase ni de MongoDB : il est partagé par le navigateur et le serveur.
 */

/** Types d'acte, repris des maquettes « Carnet de santé » et « Ajouter un acte médical ». */
export const RECORD_TYPES = ["visite", "vaccin", "examen", "traitement", "allergie", "note"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const RECORD_TYPE_INFO: Record<
  RecordType,
  { label: string; plural: string; icon: string; badge: string; dot: string; vetRequired: boolean }
> = {
  visite: {
    label: "Visite & Consultation",
    plural: "Visites & Consultations",
    icon: "stethoscope",
    badge: "bg-primary-fixed/60 text-on-primary-fixed-variant",
    dot: "bg-primary text-on-primary",
    vetRequired: true,
  },
  vaccin: {
    label: "Vaccin",
    plural: "Vaccins",
    icon: "vaccines",
    badge: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
    dot: "bg-tertiary-container text-on-tertiary",
    vetRequired: true,
  },
  examen: {
    label: "Examen & Analyse",
    plural: "Examens & Analyses",
    icon: "biotech",
    badge: "bg-surface-container text-on-surface-variant",
    dot: "bg-primary-container text-on-primary",
    vetRequired: true,
  },
  traitement: {
    label: "Traitement",
    plural: "Traitements",
    icon: "medication",
    badge: "bg-primary-fixed/60 text-on-primary-fixed-variant",
    dot: "bg-primary text-on-primary",
    vetRequired: false,
  },
  allergie: {
    label: "Allergie & Vigilance",
    plural: "Allergies & Vigilances",
    icon: "warning",
    badge: "bg-error-container/60 text-on-error-container",
    dot: "bg-error text-on-error",
    vetRequired: false,
  },
  note: {
    label: "Note & Observation",
    plural: "Notes & Observations",
    icon: "notes",
    badge: "bg-surface-container text-on-surface-variant",
    dot: "bg-outline text-on-primary",
    vetRequired: false,
  },
};

export const TITLE_MAX_LENGTH = 120;
export const NOTES_MAX_LENGTH = 1000;
export const SHORT_TEXT_MAX_LENGTH = 120;

/** Pièces jointes (ordonnance, certificat, photo de vignette) stockées dans le document MongoDB. */
export const ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;
export const ATTACHMENTS_MAX_COUNT = 3;
export const ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export type AttachmentInfo = { id: string; name: string; mimeType: string; size: number };

/** Nouvelle pièce jointe envoyée par le formulaire (contenu en base64, sans préfixe data:). */
export type NewAttachment = { name: string; mimeType: string; data: string };

/** Acte médical tel que renvoyé par l'API. Les dates sont au format AAAA-MM-JJ. */
export type HealthRecord = {
  id: string;
  petId: string;
  petName: string;
  type: RecordType;
  title: string;
  date: string;
  veterinarian: string;
  clinic: string;
  notes: string;
  /** Vaccin : numéro de lot. */
  lotNumber: string;
  /** Vaccin : date du prochain rappel. */
  nextDueDate: string | null;
  /** Traitement : posologie. */
  dosage: string;
  /** Traitement : date de fin. */
  endDate: string | null;
  attachments: AttachmentInfo[];
  createdAt: string;
  updatedAt: string;
};

/** Champs saisis dans le formulaire (création et modification). */
export type HealthRecordInput = {
  petId: string;
  petName: string;
  type: RecordType;
  title: string;
  date: string;
  veterinarian: string;
  clinic: string;
  notes: string;
  lotNumber: string;
  nextDueDate: string;
  dosage: string;
  endDate: string;
};

export type HealthRecordField = keyof HealthRecordInput;

export const EMPTY_RECORD_INPUT: Omit<HealthRecordInput, "petId" | "petName"> = {
  type: "visite",
  title: "",
  date: "",
  veterinarian: "",
  clinic: "",
  notes: "",
  lotNumber: "",
  nextDueDate: "",
  dosage: "",
  endDate: "",
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!isoDatePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Date du jour au format AAAA-MM-JJ, dans le fuseau du navigateur ou du serveur. */
export function todayIso(offsetDays = 0, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Ajoute des mois à une date AAAA-MM-JJ (raccourcis « + 1 an », « + 6 mois »…). */
export function addMonthsIso(value: string, months: number): string {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * Nettoie et valide un acte médical. Utilisé par le formulaire et, côté serveur,
 * par les routes de l'API (les données du navigateur ne sont jamais crues sur parole).
 */
export function validateHealthRecord(
  raw: unknown,
  { today = todayIso(1) }: { today?: string } = {},
): { value: HealthRecordInput; errors: FieldErrors<HealthRecordField> } {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const type = RECORD_TYPES.includes(data.type as RecordType) ? (data.type as RecordType) : null;
  const value: HealthRecordInput = {
    petId: str(data.petId),
    petName: str(data.petName),
    type: type ?? "visite",
    title: str(data.title),
    date: str(data.date),
    veterinarian: str(data.veterinarian),
    clinic: str(data.clinic),
    notes: str(data.notes),
    lotNumber: type === "vaccin" ? str(data.lotNumber) : "",
    nextDueDate: type === "vaccin" ? str(data.nextDueDate) : "",
    dosage: type === "traitement" ? str(data.dosage) : "",
    endDate: type === "traitement" ? str(data.endDate) : "",
  };
  const errors: FieldErrors<HealthRecordField> = {};

  if (!value.petId) errors.petId = "L'animal est obligatoire.";
  else if (value.petId.length > 128) errors.petId = "Identifiant d'animal invalide.";
  if (value.petName.length > 60) errors.petName = "Le nom de l'animal est trop long.";
  if (!type) errors.type = "Choisissez un type d'acte.";

  if (!value.title) errors.title = "Le titre est obligatoire.";
  else if (value.title.length > TITLE_MAX_LENGTH) errors.title = `${TITLE_MAX_LENGTH} caractères maximum.`;

  if (!value.date) errors.date = "La date est obligatoire.";
  else if (!isValidIsoDate(value.date)) errors.date = "La date n'est pas valide.";
  else if (value.date > today) errors.date = "La date ne peut pas être dans le futur.";

  if (type && RECORD_TYPE_INFO[type].vetRequired && !value.veterinarian) {
    errors.veterinarian = "Le vétérinaire est obligatoire pour ce type d'acte.";
  }
  for (const field of ["veterinarian", "clinic", "lotNumber", "dosage"] as const) {
    if (value[field].length > SHORT_TEXT_MAX_LENGTH) errors[field] = `${SHORT_TEXT_MAX_LENGTH} caractères maximum.`;
  }
  if (value.notes.length > NOTES_MAX_LENGTH) errors.notes = `${NOTES_MAX_LENGTH} caractères maximum.`;

  for (const field of ["nextDueDate", "endDate"] as const) {
    const date = value[field];
    if (!date) continue;
    if (!isValidIsoDate(date)) errors[field] = "La date n'est pas valide.";
    else if (isValidIsoDate(value.date) && date < value.date) {
      errors[field] = field === "nextDueDate" ? "Le rappel doit être après la date de l'acte." : "La fin doit être après le début.";
    }
  }

  return { value, errors };
}

/** « 14 mai 2024 » à partir de AAAA-MM-JJ (sans décalage de fuseau horaire). */
export function formatRecordDate(value: string, options: Intl.DateTimeFormatOptions = { dateStyle: "long" }): string {
  return new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}
