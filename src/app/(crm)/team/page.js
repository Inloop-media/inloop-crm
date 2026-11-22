import TeamManager from "@/components/TeamManager";
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
    <div className="page">
      <header className="rise mb-5">
        <h1 className="text-[34px] font-normal leading-tight tracking-[-0.03em]">Team &amp; groups</h1>
        <p className="mt-1.5 text-[13px] text-muted">Who can sign in, what they can see, and which groups they belong to.</p>
      </header>
      <TeamManager members={members} groups={groups} guests={guests} meId={me.id} />
    </div>
  );
}
