import "server-only";
import mongoose from "mongoose";
import { connection } from "next/server";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_TYPES,
  validateHealthRecord,
  type HealthRecordInput,
} from "@/lib/health-records";
import { AuthError, verifyFirebaseToken } from "./firebase-auth";
import { connectMongo, DatabaseConfigError } from "./mongodb";

/** Erreur renvoyée telle quelle au navigateur (message en français + code HTTP). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string | undefined>,
  ) {
    super(message);
  }
}

export const notFound = () => new ApiError(404, "Acte médical introuvable.");

/**
 * Enveloppe commune des routes : vérifie la session Firebase, ouvre MongoDB,
 * et transforme les erreurs en réponses JSON `{ error, fieldErrors? }`.
 */
export async function handle(request: Request, run: (uid: string) => Promise<Response>): Promise<Response> {
  // Hors du try : Next.js signale par une exception que la route doit être rendue à la demande.
  await connection();
  try {
    const { uid } = await verifyFirebaseToken(request);
    await connectMongo();
    return await run(uid);
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json({ error: error.message, fieldErrors: error.fieldErrors }, { status: error.status });
    }
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: 401 });
    if (error instanceof mongoose.Error.ValidationError) {
      return Response.json({ error: "Certaines informations ne sont pas valides." }, { status: 400 });
    }
    console.error("[health-records]", error);
    let message = "Une erreur est survenue sur le serveur. Réessayez.";
    if (error instanceof DatabaseConfigError) message = error.message;
    if (error instanceof mongoose.Error.MongooseServerSelectionError) {
      message = "Base de données MongoDB injoignable. Vérifiez qu'elle est démarrée.";
    }
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // corps absent ou invalide
  }
  throw new ApiError(400, "Requête invalide.");
}

export function parseObjectId(id: string): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  return new mongoose.Types.ObjectId(id);
}

/** Valide les champs du formulaire et les convertit au format MongoDB. */
export function recordFields(body: Record<string, unknown>) {
  const { value, errors } = validateHealthRecord(body);
  if (Object.values(errors).some(Boolean)) {
    throw new ApiError(400, "Certaines informations ne sont pas valides.", errors);
  }
  const toDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`) : null);
  const { date, nextDueDate, endDate, ...rest }: HealthRecordInput = value;
  return { ...rest, date: toDate(date)!, nextDueDate: toDate(nextDueDate), endDate: toDate(endDate) };
}

const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;

/** Décode les nouvelles pièces jointes `{ name, mimeType, data (base64) }`. */
export function parseNewAttachments(raw: unknown) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new ApiError(400, "Pièces jointes invalides.");
  return raw.map((item) => {
    const { name, mimeType, data } = (item ?? {}) as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim() || typeof data !== "string" || !base64Pattern.test(data)) {
      throw new ApiError(400, "Pièce jointe invalide.");
    }
    if (typeof mimeType !== "string" || !ATTACHMENT_TYPES.includes(mimeType)) {
      throw new ApiError(400, `« ${name} » : format non accepté (PDF, JPG, PNG ou WebP).`);
    }
    const buffer = Buffer.from(data, "base64");
    if (buffer.length === 0 || buffer.length > ATTACHMENT_MAX_BYTES) {
      throw new ApiError(400, `« ${name} » dépasse la taille maximale de 2 Mo.`);
    }
    return { name: name.trim().slice(0, 200), mimeType, size: buffer.length, data: buffer };
  });
}
