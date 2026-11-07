import { api } from "./api";
import type { AppNotification, NewNotification, NotificationPrefs, NotificationType } from "./models";
import { isTypeEnabled } from "./notification-prefs";

// Notifications stockées dans MongoDB, lues / modifiées via les routes /api/notifications/*.
export type { AppNotification, NewNotification, NotificationType } from "./models";

export type NotificationCategory = "sante" | "adoption" | "alerte" | "autre";

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

// MongoDB ne pousse pas les changements au navigateur : la liste est rechargée
// régulièrement, au retour sur l'onglet, et immédiatement après chaque action de l'utilisateur.
const POLL_INTERVAL_MS = 20_000;
const listeners = new Set<() => void>();

function refreshSubscriptions() {
  listeners.forEach((reload) => reload());
}

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
  const { showAt, ...fields } = notification;
  const created = await api<AppNotification>("/api/notifications", {
    method: "POST",
    body: { ...fields, ...(showAt && { showAt: showAt.toISOString() }) },
  });
  refreshSubscriptions();
  return created.id;
}

/** Suit les notifications de l'utilisateur connecté (plus récentes d'abord). */
export function subscribeToNotifications(
  uid: string,
  onChange: (notifications: AppNotification[]) => void,
  onError: (error: Error) => void,
): () => void {
  let active = true;
  let request = 0;

  const reload = () => {
    const current = ++request;
    api<AppNotification[]>("/api/notifications")
      .then((items) => {
        // Ignore une réponse dépassée par une requête plus récente, ou arrivée après la déconnexion.
        if (!active || current !== request) return;
        onChange(items.filter((n) => n.userId === uid));
      })
      .catch((error: Error) => active && current === request && onError(error));
  };
  const onVisible = () => document.visibilityState === "visible" && reload();

  reload();
  listeners.add(reload);
  const timer = setInterval(() => document.visibilityState === "visible" && reload(), POLL_INTERVAL_MS);
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    active = false;
    listeners.delete(reload);
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

export async function markAsRead(id: string): Promise<void> {
  await api(`/api/notifications/${encodeURIComponent(id)}`, { method: "PATCH", body: { read: true } });
  refreshSubscriptions();
}

export async function markAllAsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await api("/api/notifications/read-all", { method: "POST", body: { ids } });
  refreshSubscriptions();
}

export async function deleteNotification(id: string): Promise<void> {
  await api(`/api/notifications/${encodeURIComponent(id)}`, { method: "DELETE" });
  refreshSubscriptions();
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
    if (new Date(n.showAt).getTime() > now + CLOCK_TOLERANCE_MS) return false;
    return isTypeEnabled(n.type, prefs);
  });
}
