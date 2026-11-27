// Onglet « Santé » : en un seul appel, une carte par animal et le tableau de bord du jour.
import type { ObjectId } from "mongodb";
import { isValidIsoDate } from "@/lib/health-records";
import {
  compareUrgency,
  doseTimesForDay,
  dueVaccines,
  isActiveTreatment,
  shiftIsoDay,
  vaccineStatus,
  VACCINE_SOON_DAYS,
  type DashboardVaccine,
  type DoseItem,
  type HealthSummary,
  type PetHealthCard,
} from "@/lib/health-summary";
import { healthRecords, toHealthRecord, treatmentDoses } from "@/lib/server/health";
import { badRequest, handle, requireUser } from "@/lib/server/http";
import { latestAllowedDay, pets } from "@/lib/server/pets";

type PetRow = { _id: ObjectId; name: string; species: string; breed: string; status: string; thumbnail: string };

/**
 * GET /api/health-records/summary?day=AAAA-MM-JJ — `day` est le jour local du navigateur
 * (par défaut, le jour UTC). Animaux actifs triés par urgence, puis animaux archivés (par nom).
 */
export async function GET(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const latest = latestAllowedDay();
    const day = new URL(request.url).searchParams.get("day") ?? shiftIsoDay(latest, -1);
    if (!isValidIsoDate(day) || day > latest || day < shiftIsoDay(latest, -3)) throw badRequest("Jour invalide.");

    // Miniature de couverture uniquement : les photos en taille réelle ne sont pas lues.
    const petRows = await (await pets())
      .aggregate<PetRow>([
        { $match: { ownerId: uid } },
        {
          $project: {
            name: 1,
            species: 1,
            breed: 1,
            status: 1,
            thumbnail: { $ifNull: [{ $arrayElemAt: ["$photos.thumbnail", 0] }, ""] },
          },
        },
      ])
      .toArray();
    const petIds = petRows.map((p) => p._id.toHexString());

    const [recordDocs, doseDocs] = await Promise.all([
      (await healthRecords())
        .find({ ownerId: uid, petId: { $in: petIds } }, { projection: { attachments: 0, notes: 0 } })
        .toArray(),
      (await treatmentDoses()).find({ ownerId: uid, day }, { projection: { recordId: 1, time: 1 } }).toArray(),
    ]);
    const taken = new Set(doseDocs.map((d) => `${d.recordId}|${d.time}`));
    const records = recordDocs.map((doc) => toHealthRecord({ ...doc, notes: "", attachments: [] }));

    const active: (PetHealthCard & { dosesLeft: number })[] = [];
    const archived: PetHealthCard[] = [];
    const doses: DoseItem[] = [];
    const overdueVaccines: DashboardVaccine[] = [];
    const upcomingVaccines: DashboardVaccine[] = [];

    for (const pet of petRows) {
      const petId = pet._id.toHexString();
      const own = records.filter((r) => r.petId === petId);
      const isArchived = pet.status === "archived";
      const treatments = own.filter((r) => isActiveTreatment(r, day));
      const petDoses: DoseItem[] = treatments.flatMap((r) =>
        doseTimesForDay(r, day).map((time) => ({
          recordId: r.id,
          petId,
          petName: pet.name,
          petThumbnail: pet.thumbnail,
          title: r.title,
          dosage: r.dosage,
          time,
          taken: taken.has(`${r.id}|${time}`),
        })),
      );
      const visits = own.filter((r) => r.type === "visite").map((r) => r.date).sort();
      const card: PetHealthCard = {
        petId,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        thumbnail: pet.thumbnail,
        archived: isArchived,
        vaccine: vaccineStatus(own, day),
        activeTreatments: treatments.length,
        dosesDone: petDoses.filter((d) => d.taken).length,
        dosesTotal: petDoses.length,
        lastVisit: visits.at(-1) ?? null,
        allergies: [...new Set(own.filter((r) => r.type === "allergie").map((r) => r.title))],
      };
      if (isArchived) {
        archived.push(card);
        continue;
      }
      active.push({ ...card, dosesLeft: card.dosesTotal - card.dosesDone });
      doses.push(...petDoses);
      for (const v of dueVaccines(own, day)) {
        const item = { ...v, petId, petName: pet.name };
        if (v.daysLeft < 0) overdueVaccines.push(item);
        else if (v.daysLeft <= VACCINE_SOON_DAYS) upcomingVaccines.push(item);
      }
    }

    active.sort((a, b) => compareUrgency({ ...a, status: a.vaccine.status }, { ...b, status: b.vaccine.status }));
    archived.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    doses.sort((a, b) => a.time.localeCompare(b.time) || a.petName.localeCompare(b.petName, "fr"));
    const byDue = (a: DashboardVaccine, b: DashboardVaccine) => a.dueDate.localeCompare(b.dueDate);

    const summary: HealthSummary = {
      day,
      pets: [...active.map(({ dosesLeft, ...card }) => (void dosesLeft, card)), ...archived],
      doses,
      overdueVaccines: overdueVaccines.sort(byDue),
      upcomingVaccines: upcomingVaccines.sort(byDue),
    };
    return Response.json(summary);
  });
}
