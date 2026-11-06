import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/api";
import { HealthRecordModel } from "@/lib/server/health-record-model";

/**
 * GET /api/health-records/pets — animaux ayant au moins un acte dans le carnet de l'utilisateur
 * (nombre d'actes et date du dernier), pour la page d'accueil du module.
 */
export async function GET(request: NextRequest) {
  return handle(request, async (uid) => {
    const rows = await HealthRecordModel.aggregate<{ _id: string; petName: string; count: number; lastDate: Date }>([
      { $match: { ownerId: uid } },
      { $sort: { date: -1 } },
      { $group: { _id: "$petId", petName: { $first: "$petName" }, count: { $sum: 1 }, lastDate: { $first: "$date" } } },
      { $sort: { petName: 1 } },
    ]);
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
