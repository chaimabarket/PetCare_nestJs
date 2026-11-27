// Prestations du prestataire connecté.
import { ObjectId } from "mongodb";
import { handle, readJson, requireUser } from "@/lib/server/http";
import { findMyProvider, parseService, requireProviderRole, serviceJson, services, type ServiceDoc } from "@/lib/server/services";

/** GET /api/services/providers/me/services — toutes ses prestations, archivées comprises. */
export async function GET(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    await requireProviderRole(uid);
    const provider = await findMyProvider(uid);
    const list = await (await services()).find({ providerId: provider._id.toHexString() }).sort({ status: -1, name: 1 }).toArray();
    return Response.json(list.map(serviceJson));
  });
}

/** POST /api/services/providers/me/services — `{ name, category, durationMinutes, price, description, status? }`. */
export async function POST(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    await requireProviderRole(uid);
    const provider = await findMyProvider(uid);
    const input = await parseService(await readJson(request));
    const now = new Date();
    const doc: ServiceDoc = { _id: new ObjectId(), ...input, providerId: provider._id.toHexString(), createdAt: now, updatedAt: now };
    await (await services()).insertOne(doc);
    return Response.json(serviceJson(doc), { status: 201 });
  });
}
