// Animaux ayant au moins un acte dans le carnet de l'utilisateur (page d'accueil du module).
import { healthRecords } from "@/lib/server/health";
import { handle, requireUser } from "@/lib/server/http";

/** GET /api/health-records/pets — nombre d'actes et date du dernier, par animal. */
export async function GET(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const rows = await (await healthRecords())
      .aggregate<{ _id: string; petName: string; count: number; lastDate: Date }>([
        { $match: { ownerId: uid } },
        { $sort: { date: -1 } },
        { $group: { _id: "$petId", petName: { $first: "$petName" }, count: { $sum: 1 }, lastDate: { $first: "$date" } } },
        { $sort: { petName: 1 } },
      ])
      .toArray();
    return Response.json({
      pets: rows.map((r) => ({
        petId: r._id,
        petName: r.petName,
        count: r.count,
        lastDate: r.lastDate.toISOString().slice(0, 10),
      })),
    });
  });
}
