import Link from "next/link";
import DashboardView from "@/components/DashboardView";
import TaskOverview from "@/components/TaskOverview";
import { ClientLogin } from "@/components/ClientAccess";
import { Avatar, CornerLink, Panel } from "@/components/ui";
import Icon from "@/components/Icon";
import { requireMember } from "@/lib/auth";
import { dashboardData } from "@/lib/leads";
import { listClientAccounts } from "@/lib/clients";
import { listBrands } from "@/lib/brands";
import { listMakers, listTasks } from "@/lib/tasks";
import QuickAssign from "@/components/QuickAssign";
import { canAssignTasks, canSeeAllLeads, canSeeLeads, isAdmin, isExecHead, isStrategist } from "@/lib/permissions";
import { fmtDay } from "@/lib/format";

export const metadata = { title: "Dashboard" };

const IST = { timeZone: "Asia/Kolkata" };
const weekday = new Intl.DateTimeFormat("en-IN", { ...IST, weekday: "long", day: "numeric", month: "long" });
function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { ...IST, hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
const PARAMS = ["brand", "bsort", "tsort", "show", "scope", "lay", "month"];
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
  const [tasks, people, brands] = await Promise.all([listTasks(me, { view: team ? "all" : "assigned" }), listMakers(), listBrands()]);
  const active = brands.filter((b) => b.stage === "active").map((b) => ({ id: b.id, name: b.name }));
  const scopeLink = (s) => {
    const q = new URLSearchParams({ ...params, scope: s });
    q.delete("brand");
    if (s !== "team") q.delete("scope");
    const str = q.toString();
    return `/${str ? `?${str}` : ""}`;
  };
  const mine = !team;
  return (
    <div className="page">
      <header className="rise flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            {greeting()}, {me.name.split(" ")[0]} · {weekday.format(new Date())}
          </p>
          <h1 className="mt-1 text-[30px] font-medium leading-tight tracking-[-0.02em] md:text-[36px]">Task desk</h1>
          <p className="mt-1 text-sm text-muted">{mine ? "Everything you\u2019ve assigned, across every brand." : "Everything the execution heads have assigned."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="seg flex p-1">
            <Link href={scopeLink("mine")} data-on={mine} className="seg-item text-xs">
              Assigned by me
            </Link>
            <Link href={scopeLink("team")} data-on={team} className="seg-item text-xs">
              Whole team
            </Link>
          </nav>
          <Link href="/calendar" className="btn-ghost btn-sm">
            <Icon name="calendar" size={13} /> Content calendar
          </Link>
          <QuickAssign brands={active} people={people} defaultBrand={params.brand || ""} />
        </div>
      </header>

      <div className="rise mt-6 [animation-delay:60ms]">
        <TaskOverview tasks={tasks} base="/" params={params} showAssigners={team} people={people} />
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

  const [accounts, data, tasks, brands, people] = await Promise.all([
    isAdmin(me) ? listClientAccounts() : [],
    dashboardData(me),
    canAssignTasks(me) ? listTasks(me, { view: "all" }) : [],
    staff || canAssignTasks(me) ? listBrands() : [],
    canAssignTasks(me) ? listMakers() : [],
  ]);
  const activeBrands = brands.filter((b) => b.stage === "active");
  const work = canAssignTasks(me) ? (
    <section>
      <div className="mb-4 mt-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-medium tracking-[-0.015em]">Brand tasks</h2>
          <p className="text-xs text-muted">What&apos;s assigned for each brand, by whom, and where it stands</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/calendar" className="btn-ghost btn-sm">
            <Icon name="calendar" size={13} /> Calendar
          </Link>
          <QuickAssign brands={activeBrands.map((b) => ({ id: b.id, name: b.name }))} people={people} />
        </div>
      </div>
      <TaskOverview
      tasks={tasks}
      brands={activeBrands}
      people={people}
      base="/"
      params={params}
    />
    </section>
  ) : null;
  return <DashboardView me={me} data={data} clientLogins={accounts.length ? <ClientLogins accounts={accounts} /> : null} taskWork={work} />;
}
