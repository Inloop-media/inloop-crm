import { getCurrentMember } from "@/lib/auth";
import { unseenAnnouncements } from "@/lib/announcements";

/** Announcements the signed-in member hasn't pressed "Got it" on (polled by the pop-up). */
export async function GET() {
  const me = await getCurrentMember();
  if (!me) return Response.json({ items: [] }, { status: 401 });
  const items = await unseenAnnouncements(me).catch(() => []);
  return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
