// Amigo's endpoint: a question in, display blocks (text, tables, charts, links) out.
// Everything is answered from the CRM's own database — no outside AI service is called.
import { getCurrentMember } from "@/lib/auth";
import { answer, canUseAmigo } from "@/lib/amigo";

export async function POST(request) {
  const me = await getCurrentMember();
  if (!me || !canUseAmigo(me)) return Response.json({ error: "Amigo is for admins and execution heads." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const question = String(body?.question || "").trim().slice(0, 500);
  if (!question) return Response.json({ error: "Kuch poocho 🙂" }, { status: 400 });
  try {
    return Response.json({ blocks: await answer(question, me) });
  } catch (e) {
    console.error("Amigo failed:", e);
    return Response.json({ error: "Abhi jawab nahi de paaya. Thodi der mein dobara try karo." }, { status: 500 });
  }
}
