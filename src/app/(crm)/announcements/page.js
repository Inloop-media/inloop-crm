import Announcements from "@/components/Announcements";
import { requireMember } from "@/lib/auth";
import { canAnnounce } from "@/lib/permissions";
import { listAnnouncements } from "@/lib/announcements";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  const me = await requireMember();
  const { items, team, missing } = await listAnnouncements();
  const canPost = canAnnounce(me);
  return (
    <div className="page mx-auto max-w-3xl">
      <header className="rise mb-5">
        <h1 className="text-[34px] font-normal leading-tight tracking-[-0.03em]">Announcements</h1>
        <p className="mt-1 text-[13px] text-muted">{canPost ? "Tell the whole team something — it reaches everyone personally." : "Updates for the whole team from Inloop's management."}</p>
      </header>
      <Announcements items={items} team={team} me={{ id: me.id, role: me.role }} canPost={canPost} missing={missing} />
    </div>
  );
}
