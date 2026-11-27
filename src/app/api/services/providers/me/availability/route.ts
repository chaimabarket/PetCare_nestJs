// Disponibilités du prestataire connecté, jour par jour (1 = lundi … 7 = dimanche).
import { validateAvailability } from "@/lib/services-models";
import { badRequest, handle, readJson, requireUser } from "@/lib/server/http";
import { withTransaction } from "@/lib/server/mongo";
import { availability, findMyProvider, getAvailability, requireProviderRole } from "@/lib/server/services";

export async function GET(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    await requireProviderRole(uid);
    const provider = await findMyProvider(uid);
    return Response.json(await getAvailability(provider._id.toHexString()));
  });
}

/** PUT /api/services/providers/me/availability — `{ days: [{ weekday, enabled, ranges: [{ start, end }] }] }`. */
export async function PUT(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    await requireProviderRole(uid);
    const provider = await findMyProvider(uid);
    const { value, error } = validateAvailability((await readJson(request)).days);
    if (error) throw badRequest(error);
    const providerId = provider._id.toHexString();
    const col = await availability();
    await withTransaction(async (session) => {
      for (const day of value) {
        await col.replaceOne({ _id: `${providerId}_${day.weekday}` }, { ...day, providerId }, { upsert: true, session });
      }
    });
    return Response.json(await getAvailability(providerId));
  });
}
