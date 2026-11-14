import Link from "next/link";
import DashboardView from "@/components/DashboardView";
import { ClientLogin } from "@/components/ClientAccess";
import { Avatar, CornerLink, Panel } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { dashboardData } from "@/lib/leads";
import { listClientAccounts } from "@/lib/clients";
import { isAdmin } from "@/lib/permissions";
import { fmtDay } from "@/lib/format";

export const metadata = { title: "Dashboard" };

/** Admin: every brand's client login, ready to share. */
function ClientLogins({ accounts }) {
  const origin = process.env.CRM_URL || "https://inloop-crm.vercel.app";
  return (
    <Panel title="Client logins" sub="Share these with the brand — they sign in with Client login" action={<CornerLink href="/brands" icon="brand" label="Brands" />}>
      <ul className="flex flex-col gap-5">
        {accounts.slice(0, 4).map((a) => (
          <li key={a.id} className="flex flex-col gap-2.5">
            <Link href={`/brands/${a.brand.id}`} className="flex items-center gap-2.5">
              <Avatar name={a.brand.name} size={28} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.brand.name}</span>
              <span className="text-[11px] text-muted">{a.last_login_at ? "Logged in" : `Since ${fmtDay(a.brand.onboarded_at || a.created_at)}`}</span>
            </Link>
            <ClientLogin account={a} origin={origin} compact />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default async function Dashboard() {
  const me = await requireMember();
  const accounts = isAdmin(me) ? await listClientAccounts() : [];
  return <DashboardView me={me} data={await dashboardData(me)} clientLogins={accounts.length ? <ClientLogins accounts={accounts} /> : null} />;
}
