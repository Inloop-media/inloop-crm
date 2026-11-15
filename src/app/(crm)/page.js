import Link from "next/link";
import DashboardView from "@/components/DashboardView";
import HeadHome from "@/components/HeadHome";
import AdminHome from "@/components/AdminHome";
import Icon from "@/components/Icon";
import { requireMember } from "@/lib/auth";
import { dashboardData } from "@/lib/leads";
import { listBrands } from "@/lib/brands";
import { listMakers, listTasks, reviewFiles } from "@/lib/tasks";
import QuickAssign from "@/components/QuickAssign";
import { PageTop } from "@/components/Desk";
import { canSeeAllLeads, canSeeLeads, isExecHead, isStrategist } from "@/lib/permissions";

export const metadata = { title: "Dashboard" };

const IST = { timeZone: "Asia/Kolkata" };
const weekday = new Intl.DateTimeFormat("en-IN", { ...IST, weekday: "long", day: "numeric", month: "long" });
function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { ...IST, hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Execution heads (Udit, Krish): what to check, what's late, how each brand is doing. */
async function ExecDashboard({ me }) {
  const [tasks, people, brands] = await Promise.all([listTasks(me, { view: "all" }), listMakers(), listBrands()]);
  const active = brands.filter((b) => b.stage === "active").map((b) => ({ id: b.id, name: b.name }));
  const files = await reviewFiles(tasks);
  return (
    <div className="page">
      <PageTop
        title={`${greeting()}, ${me.name.split(" ")[0]} 👋`}
        sub={weekday.format(new Date())}
        right={
          <>
            <Link href="/calendar" className="btn-ghost btn-sm">
              <Icon name="calendar" size={13} /> Content calendar
            </Link>
            <QuickAssign brands={active} people={people} label="New task" />
          </>
        }
      />
      <div className="rise">
        <HeadHome tasks={tasks} brands={active} files={files} />
      </div>
    </div>
  );
}

export default async function Dashboard() {
  const me = await requireMember();
  const staff = canSeeAllLeads(me);

  // Execution heads who aren't also on sales / strategy get a dashboard about their tasks
  if (isExecHead(me) && !staff && !canSeeLeads(me) && !isStrategist(me)) return <ExecDashboard me={me} />;

  // Admin / ops: what needs them, the agency at a glance, meetings
  if (staff) {
    const [data, tasks, brands, people] = await Promise.all([dashboardData(me), listTasks(me, { view: "all" }), listBrands(), listMakers()]);
    const active = brands.filter((b) => b.stage === "active").map((b) => ({ id: b.id, name: b.name }));
    return (
      <AdminHome
        me={me}
        data={data}
        brands={brands}
        tasks={tasks}
        actions={<QuickAssign brands={active} people={people} label="New task" />}
      />
    );
  }

  // Sales executives and strategists keep their own dashboard
  return <DashboardView me={me} data={await dashboardData(me)} />;
}
