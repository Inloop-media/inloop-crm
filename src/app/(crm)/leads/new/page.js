import Link from "next/link";
import NewLeadForm from "@/components/NewLeadForm";
import { requireMember } from "@/lib/auth";
import { listAssignees } from "@/lib/leads";

export const metadata = { title: "New lead" };

export default async function NewLeadPage() {
  await requireMember(["admin", "ops"]);
  const members = await listAssignees();
  return (
    <div className="relative z-[1] mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <Link href="/leads" className="text-sm text-muted hover:text-ink">← Leads</Link>
      <h1 className="page-title mt-4">New <em>lead</em></h1>
      <p className="text-sm text-muted">For leads that didn&apos;t come through the website — calls, referrals, events. It gets the next IM- number, same as website leads.</p>
      <div className="mt-6 card p-5">
        <NewLeadForm members={members} />
      </div>
    </div>
  );
}
