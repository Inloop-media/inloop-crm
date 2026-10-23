import Link from "next/link";
import NewLeadForm from "@/components/NewLeadForm";
import { requireMember } from "@/lib/auth";
import { listMembers } from "@/lib/leads";

export const metadata = { title: "New lead" };

export default async function NewLeadPage() {
  await requireMember(["admin", "ops"]);
  const members = await listMembers({ activeOnly: true });
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
      <Link href="/leads" className="text-sm text-muted hover:text-white">← Leads</Link>
      <h1 className="mt-4 text-xl font-semibold">New lead</h1>
      <p className="text-sm text-muted">For leads that didn&apos;t come through the website — calls, referrals, events.</p>
      <div className="mt-6 rounded-xl border border-line bg-panel p-5">
        <NewLeadForm members={members} />
      </div>
    </div>
  );
}
