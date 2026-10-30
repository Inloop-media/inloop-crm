import NewLeadForm from "@/components/NewLeadForm";
import { PageHeader } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listAssignees } from "@/lib/leads";

export const metadata = { title: "New lead" };

export default async function NewLeadPage() {
  await requireMember(["admin", "ops"]);
  const members = await listAssignees();
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
