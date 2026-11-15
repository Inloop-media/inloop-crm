import Link from "next/link";
import DashboardView from "@/components/DashboardView";
import TaskOverview from "@/components/TaskOverview";
import { ClientLogin } from "@/components/ClientAccess";
import { Avatar, CornerLink, Panel, StatStrip } from "@/components/ui";
import Icon from "@/components/Icon";
import { requireMember } from "@/lib/auth";
import { dashboardData } from "@/lib/leads";
import { listClientAccounts } from "@/lib/clients";
import { listBrands } from "@/lib/brands";
import { listTasks } from "@/lib/tasks";
import { canAssignTasks, canSeeAllLeads, canSeeLeads, isAdmin, isExecHead, isStrategist } from "@/lib/permissions";
import { OPEN_TASK } from "@/lib/constants";
import { fmtDay } from "@/lib/format";

export const metadata = { title: "Dashboard" };

const IST = { timeZone: "Asia/Kolkata" };
const weekday = new Intl.DateTimeFormat("en-IN", { ...IST, weekday: "long", day: "numeric", month: "long" });
const now = () => Date.now();
const isOverdue = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < now();
function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { ...IST, hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
const PARAMS = ["brand", "bsort", "tsort", "show", "scope"];
const pick = (sp) => Object.fromEntries(PARAMS.filter((k) => typeof sp?.[k] === "string").map((k) => [k, sp[k]]));

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

/** Execution heads (Udit, Krish): the work they assigned — overall and brand by brand. */
async function ExecDashboard({ me, params }) {
  const team = params.scope === "team";
  const tasks = await listTasks(me, { view: team ? "all" : "assigned" });
  const open = tasks.filter((t) => OPEN_TASK.includes(t.status));
  const scopeLink = (s) => {
    const q = new URLSearchParams({ ...params, scope: s });
    q.delete("brand");
    if (s !== "team") q.delete("scope");
    const str = q.toString();
    return `/${str ? `?${str}` : ""}`;
  };
  return (
    <div className="page">
      <header className="rise flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            {greeting()}, {me.name.split(" ")[0]} · {weekday.format(new Date())}
          </p>
          <h1 className="page-title mt-1">Dashboard</h1>
        </div>
        <StatStrip
          className="w-full sm:w-auto"
          items={[
            { label: team ? "Team tasks" : "Assigned by me", value: tasks.length, icon: "tasks", tint: "lavender" },
            { label: "Open", value: open.length, icon: "clock", tint: "blue" },
            { label: "To review", value: tasks.filter((t) => ["completed", "client_rejected"].includes(t.status)).length, icon: "check", tint: "amber" },
            { label: "Overdue", value: tasks.filter(isOverdue).length, icon: "alert", tint: "pink" },
            { label: "Approved", value: tasks.filter((t) => t.status === "done").length, icon: "sparkle", tint: "green" },
          ]}
        />
      </header>

      <div className="rise mt-6 flex flex-wrap items-center gap-3 [animation-delay:60ms]">
        <nav className="seg flex p-1.5">
          <Link href={scopeLink("mine")} data-on={!team} className="seg-item">
            Assigned by me
          </Link>
          <Link href={scopeLink("team")} data-on={team} className="seg-item">
            Whole team
          </Link>
        </nav>
        <span className="flex-1" />
        <Link href="/tasks" className="btn-ghost btn-sm">
          <Icon name="tasks" size={13} /> Review queue
        </Link>
      </div>

      <div className="rise mt-5 [animation-delay:120ms]">
        <TaskOverview tasks={tasks} base="/" params={params} showAssigners={team} sub={team ? "Everything the heads assigned, brand by brand" : "Work you assigned, brand by brand · tap one to see its tasks"} />
      </div>
    </div>
  );
}

export default async function Dashboard({ searchParams }) {
  const me = await requireMember();
  const params = pick(await searchParams);
  const staff = canSeeAllLeads(me);

  // Execution heads who aren't also on sales / strategy get a dashboard about their tasks
  if (isExecHead(me) && !staff && !canSeeLeads(me) && !isStrategist(me)) return <ExecDashboard me={me} params={params} />;

  const [accounts, data, tasks, brands] = await Promise.all([
    isAdmin(me) ? listClientAccounts() : [],
    dashboardData(me),
    canAssignTasks(me) ? listTasks(me, { view: "all" }) : [],
    staff ? listBrands() : [],
  ]);
  const work = canAssignTasks(me) ? (
    <TaskOverview
      tasks={tasks}
      brands={brands.filter((b) => b.stage === "active")}
      base="/"
      params={params}
      title="Brands · tasks"
      sub="What's assigned for each brand and by whom · tap a brand to see its tasks"
    />
  ) : null;
  return <DashboardView me={me} data={data} clientLogins={accounts.length ? <ClientLogins accounts={accounts} /> : null} taskWork={work} />;
}
