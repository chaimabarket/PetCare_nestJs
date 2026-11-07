// Notifications de l'utilisateur connecté (remplace la section `notifications` de firestore.rules).
import {
  NOTIFICATION_BODY_MAX,
  NOTIFICATION_TITLE_MAX,
  NOTIFICATION_TYPE_KEYS,
  type NotificationType,
} from "@/lib/models";
import { badRequest, handle, readJson, requireUser } from "@/lib/server/http";
import { notifications, toNotification, users, type NotificationDoc } from "@/lib/server/mongo";
import { ObjectId } from "mongodb";

const ALLOWED_FIELDS = ["userId", "type", "title", "body", "link", "actionLabel", "showAt"];
const MAX_LISTED = 500;

/** Ses propres notifications, plus récentes d'abord. */
export async function GET(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const items = await (await notifications())
      .find({ userId: uid })
      .sort({ showAt: -1 })
      .limit(MAX_LISTED)
      .toArray();
    return Response.json(items.map(toNotification));
  });
}

function optionalText(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || value.length > max) throw badRequest(`${label} invalide.`);
  return value;
}

/** Notifier un utilisateur, toujours au nom de l'utilisateur connecté. */
export async function POST(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const body = await readJson(request);
    if (Object.keys(body).some((key) => !ALLOWED_FIELDS.includes(key))) throw badRequest("Champ non autorisé.");

    const { userId, type, title, body: text, showAt } = body;
    if (typeof userId !== "string" || !userId) throw badRequest("Destinataire invalide.");
    if (!NOTIFICATION_TYPE_KEYS.includes(type as NotificationType)) throw badRequest("Type de notification inconnu.");
    if (typeof title !== "string" || !title.trim() || title.length > NOTIFICATION_TITLE_MAX) {
      throw badRequest(`Le titre est obligatoire (${NOTIFICATION_TITLE_MAX} caractères maximum).`);
    }
    if (typeof text !== "string" || text.length > NOTIFICATION_BODY_MAX) {
      throw badRequest(`Le message est limité à ${NOTIFICATION_BODY_MAX} caractères.`);
    }
    const link = optionalText(body.link, "Lien", 300);
    // Uniquement des liens internes : pas de redirection vers un autre site ni de « javascript: ».
    if (link && !/^\/(?!\/)/.test(link)) throw badRequest("Le lien doit être une page de l'application.");
    const actionLabel = optionalText(body.actionLabel, "Texte du bouton", 60);

    const now = new Date();
    let showAtDate = now;
    if (showAt !== undefined) {
      showAtDate = new Date(typeof showAt === "string" ? showAt : NaN);
      if (Number.isNaN(showAtDate.getTime())) throw badRequest("Date d'affichage invalide.");
    }

    if (!(await (await users()).countDocuments({ _id: userId }, { limit: 1 }))) {
      throw badRequest("Destinataire introuvable.");
    }

    const notification: NotificationDoc = {
      _id: new ObjectId(),
      userId,
      type: type as NotificationType,
      title: title.trim(),
      body: text,
      ...(link && { link }),
      ...(actionLabel && { actionLabel }),
      read: false,
      senderId: uid,
      createdAt: now,
      showAt: showAtDate,
    };
    await (await notifications()).insertOne(notification);
    return Response.json(toNotification(notification), { status: 201 });
  });
}
