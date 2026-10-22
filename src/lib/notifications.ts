import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { isTypeEnabled } from "./notification-prefs";
import type { NotificationPrefs } from "./users";

/**
 * Types de notification. Chaque module utilise le sien :
 * rendez-vous / rappel → module 3, sante → module 2, perdu-trouve → module 4,
 * adoption → module 5, service → module 6, compte → module Utilisateurs.
 */
export type NotificationType = "rendez-vous" | "rappel" | "sante" | "adoption" | "perdu-trouve" | "service" | "compte";

export type NotificationCategory = "sante" | "adoption" | "alerte" | "autre";

/** Document Firestore `notifications/{id}`. */
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
  createdAt: Timestamp;
  /** Date d'affichage : dans le futur pour un rappel programmé. */
  showAt: Timestamp;
};

export const NOTIFICATION_TYPES: Record<
  NotificationType,
  { label: string; icon: string; category: NotificationCategory; tone: "primary" | "secondary" | "tertiary" | "neutral" }
> = {
  "rendez-vous": { label: "Rendez-vous", icon: "calendar_month", category: "sante", tone: "primary" },
  rappel: { label: "Rappel", icon: "vaccines", category: "sante", tone: "primary" },
  sante: { label: "Santé", icon: "medical_services", category: "sante", tone: "primary" },
  adoption: { label: "Adoption", icon: "favorite", category: "adoption", tone: "secondary" },
  "perdu-trouve": { label: "Perdu / trouvé", icon: "campaign", category: "alerte", tone: "tertiary" },
  service: { label: "Service", icon: "storefront", category: "sante", tone: "primary" },
  compte: { label: "Compte", icon: "person", category: "autre", tone: "neutral" },
};

export const NOTIFICATION_CATEGORIES: { key: NotificationCategory | "all"; label: string; dot?: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "sante", label: "Santé & RDV", dot: "bg-primary-container" },
  { key: "adoption", label: "Adoptions", dot: "bg-secondary" },
  { key: "alerte", label: "Perdus & trouvés", dot: "bg-tertiary" },
];

const notificationsCollection = "notifications";

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

/**
 * Envoie une notification dans l'application à un utilisateur.
 *
 * Exemple (module Adoption) :
 *   await sendNotification({
 *     userId: candidature.candidatId,
 *     type: "adoption",
 *     title: "Candidature acceptée pour Nala",
 *     body: "Le refuge Les Amis a accepté votre candidature.",
 *     link: `/communaute/adoption/mes-candidatures`,
 *     actionLabel: "Voir ma candidature",
 *   });
 */
export async function sendNotification(notification: NewNotification): Promise<string> {
  const sender = auth().currentUser;
  if (!sender) throw new Error("Vous devez être connecté pour envoyer une notification.");
  const { showAt, ...fields } = notification;
  const ref = await addDoc(collection(db(), notificationsCollection), {
    ...fields,
    read: false,
    senderId: sender.uid,
    createdAt: serverTimestamp(),
    showAt: showAt ? Timestamp.fromDate(showAt) : serverTimestamp(),
  });
  return ref.id;
}

/** Écoute en temps réel les notifications d'un utilisateur (plus récentes d'abord). */
export function subscribeToNotifications(
  uid: string,
  onChange: (notifications: AppNotification[]) => void,
  onError: (error: Error) => void,
): () => void {
  const q = query(collection(db(), notificationsCollection), where("userId", "==", uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }) as AppNotification,
      );
      items.sort((a, b) => b.showAt.toMillis() - a.showAt.toMillis());
      onChange(items);
    },
    onError,
  );
}

export async function markAsRead(id: string): Promise<void> {
  await updateDoc(doc(db(), notificationsCollection, id), { read: true });
}

export async function markAllAsRead(ids: string[]): Promise<void> {
  // Un lot Firestore est limité à 500 écritures.
  for (let i = 0; i < ids.length; i += 500) {
    const batch = writeBatch(db());
    ids.slice(i, i + 500).forEach((id) => batch.update(doc(db(), notificationsCollection, id), { read: true }));
    await batch.commit();
  }
}

export async function deleteNotification(id: string): Promise<void> {
  await deleteDoc(doc(db(), notificationsCollection, id));
}

// showAt vient de l'horloge du serveur : une horloge locale en retard de quelques
// minutes ne doit pas cacher une notification envoyée « maintenant ».
const CLOCK_TOLERANCE_MS = 5 * 60_000;

/** Notifications à afficher maintenant, en respectant les préférences du profil. */
export function visibleNotifications(
  notifications: AppNotification[],
  prefs: NotificationPrefs,
  now = Date.now(),
): AppNotification[] {
  return notifications.filter((n) => {
    if (n.showAt.toMillis() > now + CLOCK_TOLERANCE_MS) return false;
    return isTypeEnabled(n.type, prefs);
  });
}
