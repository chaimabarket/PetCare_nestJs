import "server-only";
import { MongoClient, type Collection, type Db, type ObjectId } from "mongodb";
import type { NotificationPrefs, NotificationType, UserRole } from "@/lib/models";

/** Document stocké dans `users` : `_id` = uid Firebase. */
export type UserDoc = {
  _id: string;
  email: string;
  displayName: string;
  city: string;
  role: UserRole;
  phone: string;
  bio: string;
  notificationPrefs: Partial<NotificationPrefs>;
  createdAt: Date;
  updatedAt: Date;
  passwordChangedAt?: Date;
};

/** Document stocké dans `notifications`. */
export type NotificationDoc = {
  _id: ObjectId;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  actionLabel?: string;
  read: boolean;
  senderId: string;
  createdAt: Date;
  showAt: Date;
};

// Une seule connexion par processus, conservée entre les rechargements à chaud de `next dev`.
const cache = globalThis as unknown as { _petcareMongo?: Promise<Db> };

async function connect(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI manquant : ajoutez-le dans .env.local.");
  const client = await new MongoClient(uri, { appName: "petcare-web" }).connect();
  const db = client.db(process.env.MONGODB_DB || "petcare");
  await db.collection("notifications").createIndex({ userId: 1, showAt: -1 });
  return db;
}

export async function mongo(): Promise<Db> {
  cache._petcareMongo ??= connect().catch((error) => {
    cache._petcareMongo = undefined; // nouvelle tentative à la prochaine requête
    throw error;
  });
  return cache._petcareMongo;
}

export async function users(): Promise<Collection<UserDoc>> {
  return (await mongo()).collection<UserDoc>("users");
}

export async function notifications(): Promise<Collection<NotificationDoc>> {
  return (await mongo()).collection<NotificationDoc>("notifications");
}

/** Conversion vers le format JSON envoyé au navigateur (dates ISO, `uid`/`id` au lieu de `_id`). */
export function toProfile({ _id, createdAt, updatedAt, passwordChangedAt, ...rest }: UserDoc) {
  return {
    ...rest,
    uid: _id,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    passwordChangedAt: passwordChangedAt?.toISOString(),
  };
}

export function toNotification({ _id, createdAt, showAt, ...rest }: NotificationDoc) {
  return { ...rest, id: _id.toHexString(), createdAt: createdAt.toISOString(), showAt: showAt.toISOString() };
}
