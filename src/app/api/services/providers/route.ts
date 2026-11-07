// Annuaire des prestataires (public) et profils en attente de validation (administrateur).
import type { NextRequest } from "next/server";
import type { Filter } from "mongodb";
import { normalizeText } from "@/lib/services-models";
import { handle, requireUser } from "@/lib/server/http";
import { providerJson, providers, requireAdmin, type ProviderDoc } from "@/lib/server/services";

/**
 * GET /api/services/providers — prestataires publiés, filtres `?categorie=`, `?ville=`, `?q=` (nom, ville,
 * catégorie, description). `?status=pending` (administrateur) : profils en attente de validation.
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
    return Response.json(items.map(providerJson));
  });
}
