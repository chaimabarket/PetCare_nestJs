// Créneaux libres d'un prestataire pour une prestation et un jour (lecture publique).
import type { NextRequest } from "next/server";
import { availableSlots } from "@/lib/services-models";
import { badRequest, handle, notFound } from "@/lib/server/http";
import { bookings, getAvailability, objectId, providers, services } from "@/lib/server/services";

/**
 * GET /api/services/providers/:id/slots?serviceId=…&day=AAAA-MM-JJ — débuts possibles (ISO), toutes les 30 min dans
 * les disponibilités, à venir, sans chevauchement avec les réservations en attente ou confirmées du prestataire.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/services/providers/[id]/slots">) {
  return handle(async () => {
    const params = request.nextUrl.searchParams;
    const day = params.get("day") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) throw badRequest("Jour invalide (AAAA-MM-JJ).");
    const provider = await (await providers()).findOne({ _id: objectId((await ctx.params).id), status: "published" });
    if (!provider) throw notFound();
    const providerId = provider._id.toHexString();
    const service = await (await services()).findOne({ _id: objectId(params.get("serviceId") ?? ""), providerId, status: "published" });
    if (!service) throw notFound();

    // Réservations susceptibles de chevaucher ce jour (une nuit de pension déborde sur le lendemain).
    const from = new Date(Date.parse(`${day}T00:00:00Z`) - 2 * 86_400_000);
    const to = new Date(Date.parse(`${day}T00:00:00Z`) + 2 * 86_400_000);
    const busy = await (await bookings())
      .find({ providerId, status: { $in: ["pending", "confirmed"] }, dateTime: { $lt: to }, endsAt: { $gt: from } })
      .toArray();
    const slots = availableSlots({
      day,
      week: await getAvailability(providerId),
      durationMinutes: service.durationMinutes,
      busy: busy.map((b) => ({ start: b.dateTime, end: b.endsAt })),
    });
    return Response.json(slots.map((s) => s.toISOString()));
  });
}
