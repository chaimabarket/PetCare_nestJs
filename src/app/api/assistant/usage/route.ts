// Compteur de l'assistant IA : chaque question d'un utilisateur connecté compte, 30 par jour au maximum.
import { handle, requireUser } from "@/lib/server/http";
import { countMessage } from "@/lib/server/assistant";

/** POST /api/assistant/usage — +1 message aujourd'hui ; 429 si la limite est atteinte. */
export async function POST(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    return Response.json({ count: await countMessage(uid) });
  });
}
