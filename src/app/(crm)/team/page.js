import TeamManager from "@/components/TeamManager";
import { requireMember } from "@/lib/auth";
import { listGroups, listGuests, listMembers } from "@/lib/leads";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireMember(["admin"]);
  const [members, groups, guests] = await Promise.all([listMembers(), listGroups(), listGuests({ activeOnly: false })]);
  return (
    <div className="relative z-[1] mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-9">
      <header className="rise mb-8">
        <p className="eyebrow">Workspace</p>
        <h1 className="page-title mt-1.5">Team &amp; <em>groups</em></h1>
      </header>
      <TeamManager members={members} groups={groups} guests={guests} meId={me.id} />
    </div>
  );
}
