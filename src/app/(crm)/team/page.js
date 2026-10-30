import TeamManager from "@/components/TeamManager";
import { PageHeader } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listGroups, listGuests, listMembers } from "@/lib/leads";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireMember(["admin"]);
  const [members, groups, guests] = await Promise.all([listMembers(), listGroups(), listGuests({ activeOnly: false })]);
  return (
    <div className="page max-w-6xl">
      <PageHeader kicker="Workspace" title="Team & groups" sub="Who can sign in, what they can see, and which groups they belong to." />
      <TeamManager members={members} groups={groups} guests={guests} meId={me.id} />
    </div>
  );
}
