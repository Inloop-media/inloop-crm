import NewLeadForm from "@/components/NewLeadForm";
import { PageHeader } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { notFound } from "next/navigation";
import { listAssignees } from "@/lib/leads";
import { canCreateLead, salesTeam } from "@/lib/permissions";

export const metadata = { title: "New lead" };

export default async function NewLeadPage() {
  const me = await requireMember();
  if (!canCreateLead(me)) notFound();
  const staff = me.role === "admin" || me.role === "ops";
  // The sales head gives leads only to their own team
  const members = (await listAssignees()).filter((m) => staff || m.id === me.id || salesTeam(me).includes(m.id));
  return (
    <div className="page max-w-3xl">
      <PageHeader
        back={{ href: "/leads", label: "Leads" }}
        kicker="Pipeline"
        title="New lead"
        sub="For leads that didn't come through the website — calls, referrals, events. It gets the next IM- number, same as website leads."
      />
      <div className="rise rise-1 card p-6 sm:p-8">
        <NewLeadForm members={members} />
      </div>
    </div>
  );
}
