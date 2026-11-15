// Liens de partage du carnet d'un animal : liste et création (propriétaire uniquement).
import { SHARES_MAX_ACTIVE, validateShareInput } from "@/lib/health-share";
import { requirePetAccess } from "@/lib/server/health";
import { healthShares, newShareToken, toHealthShare, type HealthShareDoc } from "@/lib/server/health-share";
import { badRequest, handle, HttpError, readJson, requireUser } from "@/lib/server/http";
import { ObjectId } from "mongodb";

/** GET /api/health-records/shares?petId=… — liens de l'animal, du plus récent au plus ancien (actifs ou non). */
export async function GET(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const petId = new URL(request.url).searchParams.get("petId")?.trim();
    if (!petId) throw badRequest("Le paramètre petId est obligatoire.");
    await requirePetAccess(uid, petId);
    const docs = await (await healthShares()).find({ ownerId: uid, petId }).sort({ createdAt: -1 }).limit(50).toArray();
    return Response.json({ shares: docs.map(toHealthShare) });
  });
}

/**
 * POST /api/health-records/shares { petId, label, scope, durationHours } — crée un lien.
 * Le jeton n'est renvoyé qu'ici, une seule fois : seule son empreinte est enregistrée.
 * Permis aussi pour un animal archivé (le partage ne modifie pas le carnet, il le montre).
 */
export async function POST(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const body = await readJson(request);
    const petId = typeof body.petId === "string" ? body.petId.trim() : "";
    await requirePetAccess(uid, petId);
    const { value, error } = validateShareInput(body);
    if (error) throw badRequest(error);

    const col = await healthShares();
    const now = new Date();
    const active = await col.countDocuments({ ownerId: uid, petId, revokedAt: null, expiresAt: { $gt: now } });
    if (active >= SHARES_MAX_ACTIVE) {
      throw new HttpError(409, `${SHARES_MAX_ACTIVE} liens actifs maximum par animal : désactivez-en un d'abord.`);
    }

    const { token, tokenHash } = newShareToken();
    const share: HealthShareDoc = {
      _id: new ObjectId(),
      ownerId: uid,
      petId,
      tokenHash,
      label: value.label,
      scope: value.scope,
      createdAt: now,
      expiresAt: new Date(now.getTime() + value.durationHours * 3600_000),
      revokedAt: null,
      accessCount: 0,
      lastAccessAt: null,
      accessLog: [],
    };
    await col.insertOne(share);
    return Response.json({ share: toHealthShare(share), token }, { status: 201 });
  });
}
