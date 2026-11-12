import "server-only";
import { ObjectId } from "mongodb";
import type { NotificationType } from "@/lib/models";
import { notifications } from "./mongo";

export type ServerNotification = {
  /** Destinataire. */
  userId: string;
  /** Utilisateur à l'origine de l'action. */
  senderId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  actionLabel?: string;
};

/**
 * Notifications envoyées par le serveur à la suite d'une action (candidature acceptée…).
 * Elles ne bloquent jamais l'action principale : une erreur est seulement journalisée.
 * Par défaut, on ne se notifie pas soi-même ; `includeSelf` le permet (alerte de poids de son propre animal…).
 */
export async function notifyUsers(
  list: ServerNotification[],
  { includeSelf = false }: { includeSelf?: boolean } = {},
): Promise<void> {
  const items = list.filter((n) => n.userId && (includeSelf || n.userId !== n.senderId));
  if (!items.length) return;
  const now = new Date();
  try {
    await (await notifications()).insertMany(
      items.map((n) => ({ _id: new ObjectId(), ...n, read: false, createdAt: now, showAt: now })),
    );
  } catch (error) {
    console.error("Notifications non envoyées :", error);
  }
}
