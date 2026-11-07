// Signaler une annonce ou une histoire (traité par l'administration dans MongoDB Atlas).
import { ObjectId } from "mongodb";
import { REPORT_REASONS, type ReportReason, type ReportTarget } from "@/lib/adoption-models";
import { reports } from "@/lib/server/adoption";
import { badRequest, handle, readJson, requireUser } from "@/lib/server/http";

const TARGETS: ReportTarget[] = ["annonce", "happy-tail"];

export async function POST(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const { targetType, targetId, reason, comment = "" } = await readJson(request);
    if (!TARGETS.includes(targetType as ReportTarget)) throw badRequest("Type de contenu invalide.");
    if (typeof targetId !== "string" || !targetId || targetId.length > 100) throw badRequest("Contenu invalide.");
    if (!REPORT_REASONS.includes(reason as ReportReason)) throw badRequest("Motif invalide.");
    if (typeof comment !== "string" || comment.length > 500) throw badRequest("Commentaire : 500 caractères maximum.");

    await (await reports()).insertOne({
      _id: new ObjectId(),
      reporterId: uid,
      targetType: targetType as ReportTarget,
      targetId,
      reason: reason as ReportReason,
      comment: comment.trim(),
      createdAt: new Date(),
    });
    return new Response(null, { status: 201 });
  });
}
