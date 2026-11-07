// Profil prestataire de l'utilisateur connecté (rôle `prestataire`).
import { ObjectId } from "mongodb";
import { handle, readJson, requireUser } from "@/lib/server/http";
import {
  getAvailability,
  parseProvider,
  providerJson,
  providers,
  requireProviderRole,
  serviceJson,
  services,
  type ProviderDoc,
} from "@/lib/server/services";

/** GET /api/services/providers/me — son profil (tous statuts) avec toutes ses prestations, ou `null`. */
export async function GET(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    await requireProviderRole(uid);
    const provider = await (await providers()).findOne({ ownerId: uid });
    if (!provider) return Response.json(null);
    const id = provider._id.toHexString();
    const list = await (await services()).find({ providerId: id }).sort({ status: -1, name: 1 }).toArray();
    return Response.json({ ...providerJson(provider), services: list.map(serviceJson), availability: await getAvailability(id) });
  });
}

/**
 * PUT /api/services/providers/me — crée ou modifie son profil. Chaque enregistrement le (re)met en validation
 * (`pending`) : un profil refusé et corrigé repart en validation.
 */
export async function PUT(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    await requireProviderRole(uid);
    const input = await parseProvider(await readJson(request));
    const now = new Date();
    const col = await providers();
    const existing = await col.findOne({ ownerId: uid });
    let saved: ProviderDoc;
    if (existing) {
      saved = (await col.findOneAndUpdate(
        { _id: existing._id },
        { $set: { ...input, status: "pending", updatedAt: now }, $unset: { rejectionReason: "", reviewedAt: "" } },
        { returnDocument: "after" },
      ))!;
    } else {
      saved = { _id: new ObjectId(), ...input, ownerId: uid, status: "pending", createdAt: now, updatedAt: now };
      await col.insertOne(saved);
    }
    return Response.json(providerJson(saved), { status: existing ? 200 : 201 });
  });
}
