// Chiffres publics du module (page Happy Tails).
import { listings } from "@/lib/server/adoption";
import { handle } from "@/lib/server/http";

export async function GET() {
  return handle(async () => {
    const adopted = await (await listings()).countDocuments({ status: "adoptee" });
    return Response.json({ adopted });
  });
}
