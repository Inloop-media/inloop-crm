import TeamManager from "@/components/TeamManager";
import { PageHeader } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { listGroups, listGuests, listMembers } from "@/lib/leads";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireMember(["admin"]);
  const [list, groups, guests, docs] = await Promise.all([listMembers(), listGroups(), listGuests({ activeOnly: false }), db().from("members").select("id, can_see_documents")]);
  // can_see_documents arrives with migration 020; before that nobody has it
  const docsOn = new Set((docs.error ? [] : docs.data || []).filter((m) => m.can_see_documents).map((m) => m.id));
  const members = list.map((m) => ({ ...m, can_see_documents: docsOn.has(m.id) }));
  return (
    <div className="page max-w-6xl">
      <PageHeader kicker="Workspace" title="Team & groups" sub="Who can sign in, what they can see, and which groups they belong to." />
      <TeamManager members={members} groups={groups} guests={guests} meId={me.id} />
    </div>
  );
}
