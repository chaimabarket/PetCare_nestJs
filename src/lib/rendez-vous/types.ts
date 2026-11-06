/**
 * Modèles du module Rendez-vous et rappels (repris de l'application Flutter).
 * Les noms de champs sont ceux des futures collections MongoDB `appointments` et `reminders`.
 */

/** PLANNED et CONFIRMED sont actifs ; COMPLETED et CANCELLED sont définitifs (RG-20). */
export type AppointmentStatus = "planned" | "confirmed" | "completed" | "cancelled";

export type AppointmentType = "vaccin" | "veterinaire" | "toilettage" | "soin" | "education" | "garde" | "autre";

export type AppointmentPlace = "domicile" | "exterieur" | "autre";

/** Action de l'historique. « Reporté » est une action, pas un statut (RG-18). */
export type AppointmentAction = "create" | "confirm" | "reschedule" | "cancel" | "complete";

export type AppointmentChange = {
  action: AppointmentAction;
  at: Date;
  by: string;
  reason?: string;
  oldStart?: Date;
  newStart?: Date;
};

/**
 * Un rendez-vous. Avec `providerId` c'est une réservation d'un service (module Services),
 * sans `providerId` c'est un rendez-vous personnel (RG-12).
 */
export type Appointment = {
  id: string;
  ownerId: string;
  petId?: string;
  petName: string;
  petBreed?: string;
  title: string;
  description?: string;
  type: AppointmentType;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  providerId?: string;
  providerName?: string;
  providerAddress?: string;
  providerPhone?: string;
  serviceId?: string;
  /** Prix indicatif en dinars. Aucun paiement en ligne. */
  price?: number;
  place: AppointmentPlace;
  location: string;
  notes: string;
  /** Délai du rappel avant le début, en minutes. 0 = sans rappel. */
  reminderMinutes: number;
  pushReminder: boolean;
  cancelReason?: string;
  /** Moment où l'utilisateur a validé le rappel (« Fait »). Remis à zéro après un report. */
  reminderDoneAt?: Date;
  /** Incrémentée à chaque modification : détecte une modification concurrente (RG-20). */
  version: number;
  changes: AppointmentChange[];
};

export type ReminderCategory = "medicament" | "soin" | "veterinaire" | "traitement" | "hygiene" | "controle";

/** Un rappel de soin créé à la main (« Nouveau rappel »). */
export type Reminder = {
  id: string;
  ownerId: string;
  petName: string;
  petBreed?: string;
  title: string;
  description?: string;
  /** Petite information en bas de la carte : « 1 comprimé », « Protection 1 mois »… */
  detail?: string;
  category: ReminderCategory;
  dueAt: Date;
  appointmentId?: string;
  done: boolean;
  doneAt?: Date;
};

/** Un animal que l'on peut choisir (les fiches complètes appartiennent au module Animaux). */
export type PetOption = { id?: string; name: string; breed?: string };

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  planned: "En attente",
  confirmed: "Confirmé",
  completed: "Terminé",
  cancelled: "Annulé",
};

export const TYPE_LABELS: Record<AppointmentType, string> = {
  vaccin: "Vaccin",
  veterinaire: "Vétérinaire",
  toilettage: "Toilettage",
  soin: "Soin personnel",
  education: "Séance éducation",
  garde: "Garde / Promenade",
  autre: "Autre",
};

/** Icônes Material Symbols des types. */
export const TYPE_ICONS: Record<AppointmentType, string> = {
  vaccin: "vaccines",
  veterinaire: "local_hospital",
  toilettage: "content_cut",
  soin: "content_cut",
  education: "school",
  garde: "directions_walk",
  autre: "event_note",
};

/** Les types proposés dans le formulaire « Nouveau rendez-vous » (rendez-vous personnel). */
export const PERSONAL_TYPES: AppointmentType[] = ["soin", "education", "garde", "autre"];

export const PLACE_LABELS: Record<AppointmentPlace, string> = {
  domicile: "À domicile",
  exterieur: "En extérieur / Parc",
  autre: "Autre adresse",
};

export const ACTION_LABELS: Record<AppointmentAction, string> = {
  create: "Rendez-vous créé",
  confirm: "Confirmé",
  reschedule: "Reporté",
  cancel: "Annulé",
  complete: "Terminé",
};

export const REMINDER_CATEGORY_LABELS: Record<ReminderCategory, string> = {
  medicament: "Médicament",
  soin: "Soin",
  veterinaire: "Vétérinaire",
  traitement: "Traitement",
  hygiene: "Hygiène",
  controle: "Contrôle",
};

export const REMINDER_CATEGORY_ICONS: Record<ReminderCategory, string> = {
  medicament: "medication",
  soin: "healing",
  veterinaire: "calendar_month",
  traitement: "science",
  hygiene: "content_cut",
  controle: "biotech",
};
