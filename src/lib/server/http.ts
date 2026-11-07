import "server-only";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

/**
 * Erreur renvoyée telle quelle au navigateur : `{ error: message, fieldErrors? }` avec ce statut.
 * `fieldErrors` (facultatif) associe un message à chaque champ de formulaire invalide.
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string | undefined>,
  ) {
    super(message);
  }
}

export const forbidden = () => new HttpError(403, "Vous n'avez pas l'autorisation d'effectuer cette action.");
export const notFound = () => new HttpError(404, "Élément introuvable.");
export const badRequest = (message: string) => new HttpError(400, message);

// Vérifier un jeton d'identification Firebase ne demande que l'identifiant du projet
// (les clés publiques de Google sont téléchargées automatiquement) : pas de compte de service.
function firebaseAdminAuth() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!getApps().length) initializeApp({ projectId });
  return getAuth();
}

/** Utilisateur Firebase connecté, d'après l'en-tête `Authorization: Bearer <jeton>`. */
export async function requireUser(request: Request): Promise<DecodedIdToken> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Vous devez être connecté.");
  try {
    return await firebaseAdminAuth().verifyIdToken(token);
  } catch {
    throw new HttpError(401, "Session expirée. Reconnectez-vous.");
  }
}

/** Pour les pages publiques : l'utilisateur s'il est connecté, sinon `undefined` (visiteur). */
export async function optionalUser(request: Request): Promise<DecodedIdToken | undefined> {
  return request.headers.has("authorization") ? requireUser(request) : undefined;
}

/** Corps JSON de la requête (objet attendu). */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw badRequest("Requête invalide.");
  return body as Record<string, unknown>;
}

/**
 * Exécute un gestionnaire de route et transforme les erreurs en réponses JSON.
 * Les routes API répondent toujours à la demande (jamais pré-rendues au build).
 */
export async function handle(action: () => Promise<Response>): Promise<Response> {
  try {
    await connection();
    return await action();
  } catch (error) {
    unstable_rethrow(error); // signaux internes de Next.js : à laisser passer
    if (error instanceof HttpError) {
      return Response.json({ error: error.message, fieldErrors: error.fieldErrors }, { status: error.status });
    }
    console.error("Erreur API :", error);
    return Response.json({ error: "Erreur du serveur. Réessayez." }, { status: 500 });
  }
}
