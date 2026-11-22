import { PageTop } from "@/components/Desk";
import AssetsBoard from "@/components/AssetsBoard";
import { requireMember } from "@/lib/auth";
import { listAssets } from "@/lib/assets";
import { canManageAssets, canSeeAssets } from "@/lib/permissions";

export const metadata = { title: "Brand assets" };

export default async function AssetsPage() {
  const me = await requireMember(canSeeAssets);
  const { assets, migration } = await listAssets();
  return (
    <div className="page">
      <PageTop title="Brand assets" sub="Inloop's company profiles, presentations and past work — everything you need to pitch." />
      {migration ? <p className="card p-6 text-[13px] text-muted">Run migration 024 in Supabase to turn this on.</p> : <AssetsBoard assets={assets} canManage={canManageAssets(me)} />}
    </div>
  );
}
