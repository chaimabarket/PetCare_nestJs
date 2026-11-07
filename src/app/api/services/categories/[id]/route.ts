// Une catégorie (administrateur) : renommer, changer l'icône ou l'ordre, supprimer.
import { badRequest, handle, HttpError, readJson, requireUser } from "@/lib/server/http";
import { withTransaction } from "@/lib/server/mongo";
import {
  categories,
  ensureCategoriesSaved,
  findCategory,
  listCategories,
  parseCategory,
  providers,
  requireAdmin,
  services,
} from "@/lib/server/services";

type Ctx = RouteContext<"/api/services/categories/[id]">;

/**
 * PUT /api/services/categories/:id — `{ name, icon, order? }`. Un renommage est répercuté sur les profils
 * et les prestations qui utilisent la catégorie.
 */
export async function PUT(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    await requireAdmin(uid);
    const body = await readJson(request);
    const value = parseCategory(body);
    let order: number | undefined;
    if (body.order !== undefined) {
      if (!Number.isInteger(body.order) || (body.order as number) < 0 || (body.order as number) > 1000) {
        throw badRequest("Ordre invalide.");
      }
      order = body.order as number;
    }
    await ensureCategoriesSaved();
    const category = await findCategory((await ctx.params).id);
    const col = await categories();
    const others = await col.find({ _id: { $ne: category._id } }).toArray();
    if (others.some((c) => c.name.toLowerCase() === value.name.toLowerCase())) {
      throw new HttpError(409, `La catégorie « ${value.name} » existe déjà.`);
    }
    await withTransaction(async (session) => {
      await col.updateOne({ _id: category._id }, { $set: { ...value, ...(order !== undefined && { order }) } }, { session });
      if (value.name !== category.name) {
        await (await providers()).updateMany({ category: category.name }, { $set: { category: value.name } }, { session });
        await (await services()).updateMany({ category: category.name }, { $set: { category: value.name } }, { session });
      }
    });
    return Response.json(await listCategories());
  });
}

/** DELETE /api/services/categories/:id — refusé (409) tant qu'un profil ou une prestation l'utilise. */
export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    await requireAdmin(uid);
    await ensureCategoriesSaved();
    const category = await findCategory((await ctx.params).id);
    const used =
      (await (await providers()).countDocuments({ category: category.name }, { limit: 1 })) +
      (await (await services()).countDocuments({ category: category.name }, { limit: 1 }));
    if (used) throw new HttpError(409, `La catégorie « ${category.name} » est utilisée par des prestataires : renommez-la plutôt.`);
    await (await categories()).deleteOne({ _id: category._id });
    return Response.json(await listCategories());
  });
}
