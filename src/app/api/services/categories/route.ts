// Catégories de services : lecture publique, écriture réservée aux administrateurs.
import { ObjectId } from "mongodb";
import { handle, HttpError, readJson, requireUser } from "@/lib/server/http";
import { categories, ensureCategoriesSaved, listCategories, parseCategory, requireAdmin } from "@/lib/server/services";

/** GET /api/services/categories — par ordre d'affichage (catégories par défaut tant que l'admin n'en a pas enregistré). */
export async function GET() {
  return handle(async () => Response.json(await listCategories()));
}

/** POST /api/services/categories — `{ name, icon }` : ajouter une catégorie (admin), placée en dernier. */
export async function POST(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    await requireAdmin(uid);
    const value = parseCategory(await readJson(request));
    await ensureCategoriesSaved();
    const col = await categories();
    const all = await col.find().toArray();
    if (all.some((c) => c.name.toLowerCase() === value.name.toLowerCase())) {
      throw new HttpError(409, `La catégorie « ${value.name} » existe déjà.`);
    }
    const doc = { _id: new ObjectId(), ...value, order: Math.max(-1, ...all.map((c) => c.order)) + 1 };
    await col.insertOne(doc);
    return Response.json(await listCategories(), { status: 201 });
  });
}
