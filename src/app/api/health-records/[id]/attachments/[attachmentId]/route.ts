// Téléchargement d'une pièce jointe (propriétaire de l'acte uniquement).
import { healthRecords, recordNotFound, recordObjectId } from "@/lib/server/health";
import { handle, HttpError, requireUser } from "@/lib/server/http";

/** GET /api/health-records/:id/attachments/:attachmentId */
export async function GET(request: Request, ctx: RouteContext<"/api/health-records/[id]/attachments/[attachmentId]">) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const { id, attachmentId } = await ctx.params;
    const record = await (await healthRecords()).findOne(
      { _id: recordObjectId(id), ownerId: uid },
      { projection: { attachments: 1 } },
    );
    if (!record) throw recordNotFound();
    const attachment = record.attachments.find((a) => a._id.toHexString() === attachmentId);
    if (!attachment) throw new HttpError(404, "Pièce jointe introuvable.");

    const bytes = new Uint8Array(attachment.data.buffer.subarray(0, attachment.data.length()));
    return new Response(bytes, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
