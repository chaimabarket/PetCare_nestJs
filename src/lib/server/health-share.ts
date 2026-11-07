// Partage sécurisé du carnet côté serveur : collection MongoDB `health_shares`.
// Le jeton du lien (32 octets aléatoires) n'est jamais stocké : seule son empreinte SHA-256 l'est,
// si bien qu'une fuite de la base ne donne accès à aucun carnet.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { ObjectId, type Collection } from "mongodb";
import { SHARE_TOKEN_PATTERN, type HealthShare, type ShareScope } from "@/lib/health-share";
import { HttpError } from "./http";
import { mongo } from "./mongo";

export type HealthShareDoc = {
  _id: ObjectId;
  ownerId: string;
  petId: string;
  tokenHash: string;
  label: string;
  scope: ShareScope;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  accessCount: number;
  lastAccessAt: Date | null;
  /** Dernières consultations (dates uniquement : ni adresse IP ni navigateur). */
  accessLog: Date[];
};

const cache = globalThis as unknown as { _petcareShareIndexes?: Promise<void> };

export async function healthShares(): Promise<Collection<HealthShareDoc>> {
  const db = await mongo();
  cache._petcareShareIndexes ??= Promise.all([
    db.collection("health_shares").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("health_shares").createIndex({ ownerId: 1, petId: 1, createdAt: -1 }),
  ])
    .then(() => undefined)
    .catch((error) => {
      cache._petcareShareIndexes = undefined;
      throw error;
    });
  await cache._petcareShareIndexes;
  return db.collection<HealthShareDoc>("health_shares");
}

/** Nouveau jeton (base64url, 43 caractères) et son empreinte. */
export function newShareToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashShareToken(token) };
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const shareNotFound = () => new HttpError(404, "Ce lien de partage n'existe pas.");
export const shareGone = (reason: "expired" | "revoked") =>
  new HttpError(410, reason === "expired" ? "Ce lien de partage a expiré." : "Ce lien de partage a été désactivé par le propriétaire.");

/** Lien d'après le jeton reçu dans l'adresse : 404 s'il est inconnu, 410 s'il a expiré ou a été révoqué. */
export async function findShareByToken(token: string): Promise<HealthShareDoc> {
  if (!SHARE_TOKEN_PATTERN.test(token)) throw shareNotFound();
  const share = await (await healthShares()).findOne({ tokenHash: hashShareToken(token) });
  if (!share) throw shareNotFound();
  if (share.revokedAt) throw shareGone("revoked");
  if (share.expiresAt.getTime() <= Date.now()) throw shareGone("expired");
  return share;
}

export function shareObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id) || id.length !== 24) throw shareNotFound();
  return new ObjectId(id);
}

export function toHealthShare(doc: HealthShareDoc): HealthShare {
  return {
    id: doc._id.toHexString(),
    petId: doc.petId,
    label: doc.label,
    scope: doc.scope,
    createdAt: doc.createdAt.toISOString(),
    expiresAt: doc.expiresAt.toISOString(),
    revokedAt: doc.revokedAt?.toISOString() ?? null,
    accessCount: doc.accessCount,
    lastAccessAt: doc.lastAccessAt?.toISOString() ?? null,
    accessLog: doc.accessLog.map((d) => d.toISOString()),
  };
}
