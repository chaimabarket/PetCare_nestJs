// Annuaire des prestataires (public) et profils en attente de validation (administrateur).
import type { NextRequest } from "next/server";
import type { Filter } from "mongodb";
import { EMPTY_WEEK, normalizeText, type ProviderSummary } from "@/lib/services-models";
import { handle, requireUser } from "@/lib/server/http";
import { availability, providerJson, providers, requireAdmin, services, type ProviderDoc } from "@/lib/server/services";

/**
 * GET /api/services/providers — prestataires publiés, avec horaires, nombre de prestations et prix minimum ;
 * filtres `?categorie=`, `?ville=`, `?q=` (nom, ville, catégorie, description).
 * `?status=pending` (administrateur) : profils en attente de validation.
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const params = request.nextUrl.searchParams;
    let filter: Filter<ProviderDoc> = { status: "published" };
    if (params.get("status") === "pending") {
      const { uid } = await requireUser(request);
      await requireAdmin(uid);
      filter = { status: "pending" };
    } else {
      const category = params.get("categorie")?.trim();
      if (category) filter.category = category;
    }
    let items = await (await providers()).find(filter).sort({ updatedAt: -1 }).toArray();
    const city = normalizeText(params.get("ville") ?? "");
    const q = normalizeText(params.get("q") ?? "");
    if (city) items = items.filter((p) => normalizeText(p.city) === city);
    if (q) items = items.filter((p) => normalizeText(`${p.name} ${p.city} ${p.category} ${p.description}`).includes(q));

    const ids = items.map((p) => p._id.toHexString());
    const [offers, hours] = await Promise.all([
      (await services()).find({ providerId: { $in: ids }, status: "published" }, { projection: { providerId: 1, name: 1, price: 1 } }).toArray(),
      (await availability()).find({ providerId: { $in: ids } }).toArray(),
    ]);
    const summaries: ProviderSummary[] = items.map((p) => {
      const id = p._id.toHexString();
      const own = offers.filter((s) => s.providerId === id).sort((a, b) => a.price - b.price);
      return {
        ...providerJson(p),
        availability: EMPTY_WEEK.map((d) => {
          const day = hours.find((h) => h.providerId === id && h.weekday === d.weekday);
          return day ? { weekday: day.weekday, enabled: day.enabled, ranges: day.ranges } : d;
        }),
        serviceCount: own.length,
        ...(own.length && { minPrice: own[0].price, cheapestService: own[0].name }),
      };
    });
    return Response.json(summaries);
  });
}
