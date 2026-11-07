// Types et constantes partagés entre le navigateur et les routes API (aucune dépendance).
// Les dates arrivent de l'API au format ISO (ex. "2026-11-06T10:00:00.000Z").

export type UserRole = "proprietaire" | "prestataire" | "refuge" | "admin";

/** Rôles proposés à l'inscription (admin est attribué directement dans MongoDB Atlas). */
export const SIGNUP_ROLES = ["proprietaire", "prestataire", "refuge"] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

/** Préférences d'alerte (voir lib/notification-prefs.ts pour les libellés). */
export type NotificationPrefs = {
  appointments: boolean;
  careReminders: boolean;
  adoption: boolean;
  lostFoundAlerts: boolean;
  /** Pas encore géré : l'application n'envoie pas d'e-mails. */
  email: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  appointments: true,
  careReminders: true,
  adoption: true,
  lostFoundAlerts: true,
  email: false,
};

export const BIO_MAX_LENGTH = 300;

/** Profil `users` (MongoDB, `_id` = uid Firebase), partagé par tous les modules. */
export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  city: string;
  role: UserRole;
  phone?: string;
  bio?: string;
  notificationPrefs?: Partial<NotificationPrefs>;
  createdAt?: string;
  updatedAt?: string;
  passwordChangedAt?: string;
};

export type EditableProfile = Pick<UserProfile, "displayName" | "city"> & { phone: string; bio: string };

/**
 * Types de notification. Chaque module utilise le sien :
 * rendez-vous / rappel → module 3, sante → module 2, perdu-trouve → module 4,
 * adoption → module 5, service → module 6, compte → module Utilisateurs.
 */
export const NOTIFICATION_TYPE_KEYS = [
  "rendez-vous",
  "rappel",
  "sante",
  "adoption",
  "perdu-trouve",
  "service",
  "compte",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPE_KEYS)[number];

export const NOTIFICATION_TITLE_MAX = 120;
export const NOTIFICATION_BODY_MAX = 1000;

/** Notification `notifications` (MongoDB). */
export type AppNotification = {
  id: string;
  /** Destinataire. */
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Page à ouvrir (ex. "/rendez-vous/abc123"). */
  link?: string;
  /** Texte du bouton d'action (ex. "Voir le rendez-vous"). */
  actionLabel?: string;
  read: boolean;
  senderId: string;
  createdAt: string;
  /** Date d'affichage : dans le futur pour un rappel programmé. */
  showAt: string;
};

export type NewNotification = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  actionLabel?: string;
  /** Pour programmer un rappel (par défaut : maintenant). */
  showAt?: Date;
};
