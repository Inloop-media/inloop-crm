import { getCurrentMember } from "@/lib/auth";
import { unseenCelebrations } from "@/lib/brands";

/** New-client celebrations the signed-in member hasn't seen yet (polled by the pop-up). */
export async function GET() {
  const me = await getCurrentMember();
  if (!me) return Response.json({ items: [] }, { status: 401 });
  const items = await unseenCelebrations(me).catch(() => []);
  return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
