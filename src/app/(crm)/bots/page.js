import { PageTop } from "@/components/Desk";
import CrlBot from "@/components/CrlBot";
import { requireMember } from "@/lib/auth";
import { listBotRuns } from "@/lib/bots";
import { canUseBots } from "@/lib/permissions";

export const metadata = { title: "Bots" };

export default async function BotsPage() {
  await requireMember(canUseBots);
  const { runs, migration } = await listBotRuns("crl");
  return (
    <div className="page">
      <PageTop title="Bots" sub="Run a bot on its own — for a new client or anything outside the leads flow." />
      {migration ? <p className="card p-6 text-[13px] text-muted">Run migration 038_bot_runs.sql in Supabase to turn this on.</p> : <CrlBot runs={runs} />}
    </div>
  );
}
