import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Vérifie le jeton d'identification Firebase envoyé par le navigateur
 * (en-tête `Authorization: Bearer <idToken>`), sans compte de service :
 * la signature est contrôlée avec les clés publiques de Google.
 */
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export class AuthError extends Error {}

export async function verifyFirebaseToken(request: Request): Promise<{ uid: string }> {
  // Lire l'en-tête en premier : la route est ainsi rendue à la demande, jamais pré-rendue au build.
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new AuthError("Vous devez être connecté.");

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID n'est pas défini dans .env.local.");

  try {
    const { payload } = await jwtVerify(token, googleKeys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
    });
    if (typeof payload.sub !== "string" || !payload.sub) throw new AuthError("Session invalide.");
    return { uid: payload.sub };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError("Session expirée ou invalide. Reconnectez-vous.");
  }
}
