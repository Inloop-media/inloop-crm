import TeamManager from "@/components/TeamManager";
import { requireMember } from "@/lib/auth";
import { listMembers } from "@/lib/leads";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireMember(["admin"]);
  const members = await listMembers();
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
      <h1 className="text-xl font-semibold">Team</h1>
      <p className="text-sm text-muted">Only people listed here can sign in. Executives see just the leads assigned to them.</p>
      <div className="mt-6">
        <TeamManager members={members} meId={me.id} />
      </div>
    </div>
  );
}
