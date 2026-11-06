import type { NextRequest } from "next/server";
import { ApiError, handle, notFound, parseObjectId } from "@/lib/server/api";
import { HealthRecordModel } from "@/lib/server/health-record-model";

/** GET /api/health-records/:id/attachments/:attachmentId — télécharge une pièce jointe. */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/health-records/[id]/attachments/[attachmentId]">,
) {
  return handle(request, async (uid) => {
    const { id, attachmentId } = await ctx.params;
    const record = await HealthRecordModel.findOne({ _id: parseObjectId(id), ownerId: uid }, { attachments: 1 });
    if (!record) throw notFound();
    const attachment = record.attachments.find((a) => String(a._id) === attachmentId);
    if (!attachment) throw new ApiError(404, "Pièce jointe introuvable.");

    return new Response(new Uint8Array(attachment.data), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(attachment.data.length),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
