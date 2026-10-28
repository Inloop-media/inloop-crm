import DashboardView from "@/components/DashboardView";
import { requireMember } from "@/lib/auth";
import { dashboardData } from "@/lib/leads";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const me = await requireMember();
  return <DashboardView me={me} data={await dashboardData(me)} />;
}
