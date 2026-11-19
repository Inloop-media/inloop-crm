import { PhoneTabs, SideButton, Sidebar, TopBar } from "@/components/Nav";
import Logo from "@/components/Logo";
import { canUseAmigo } from "@/lib/amigo";
import MobileHeader, { AvatarMenu } from "@/components/MobileHeader";
import PushSetup from "@/components/PushSetup";
import ThemeToggle from "@/components/ThemeToggle";
import SwitchAccount from "@/components/SwitchAccount";
import FeedbackNote from "@/components/FeedbackNote";
import Celebration from "@/components/Celebration";
import { unreadCounts } from "@/lib/chat";
import { unseenCelebrations } from "@/lib/brands";
import { taskBadge } from "@/lib/tasks";
import { getTheme } from "@/lib/theme";
import { dmUnread } from "@/lib/dm";
import { requirementCounts } from "@/lib/requirements";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { listFeeds } from "@/lib/leads";
import { canAssignTasks, canCreateLead, canManageTeam, canSeeBrands, canSeeBriefs, canSeeCalendar, canSeeLeads, isMaker, isStrategist } from "@/lib/permissions";
import { ROLES } from "@/lib/constants";

/** Work waiting on this member: open briefs for strategists, commercials for admin / ops. */
async function briefsBadge(me) {
  const staff = me.role === "admin" || me.role === "ops";
  let q = db().from("proposals").select("id", { count: "exact", head: true });
  if (staff) q = q.in("stage", ["awaiting_commercials", "proposal_review", "crl_failed", "proposal_failed"]);
  else if (isStrategist(me)) q = q.or(`strategist_id.is.null,and(strategist_id.eq.${me.id},stage.in.(picked_up,crl_failed))`);
  else return 0;
  const { count } = await q;
  return count || 0;
}

/** Feedback notes no admin has looked at yet (0 until migration 007 has run). */
async function newFeedback() {
  const { count, error } = await db().from("feedback").select("id", { count: "exact", head: true }).eq("status", "new");
  return error ? 0 : count || 0;
}

const initials = (name) =>
  String(name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

export default async function CrmLayout({ children }) {
  const me = await requireMember();
  // Sidebar groups: your work, sales, clients, admin
  const tasksCount = await taskBadge(me).catch(() => 0);
  const feeds = await listFeeds(me);
  const main = [{ href: "/", label: "Overview", icon: "home" }];
  if (canUseAmigo(me)) main.push({ href: "/amigo", label: "Amigo", icon: "sparkle", tag: "AI" });
  if (canAssignTasks(me) || isMaker(me) || tasksCount) main.push({ href: "/tasks", label: canAssignTasks(me) ? "Tasks" : "My tasks", icon: "tasks", badge: tasksCount });
  if (canSeeCalendar(me)) main.push({ href: "/calendar", label: "Content calendar", icon: "calendar" });
  main.push({ href: "/library", label: "Brand library", icon: "board" });
  main.push({ href: "/dm", label: "Direct messages", icon: "chat", badge: await dmUnread(me.id).catch(() => 0) });
  main.push({ href: "/requirements", label: "Requirements", icon: "list", badge: (await requirementCounts(me.id).catch(() => ({ inbox: 0 }))).inbox });
  const sales = [];
  if (canSeeLeads(me)) sales.push({ href: "/leads", label: "Leads", icon: "leads" });
  if (canSeeBriefs(me)) sales.push({ href: "/briefs", label: "Proposals", icon: "brief", badge: await briefsBadge(me) });
  if (canCreateLead(me)) sales.push({ href: "/leads/new", label: "New lead", icon: "plus" });
  const clients = [];
  if (canSeeBrands(me)) {
    const { data } = await db().from("brands").select("id");
    const unread = await unreadCounts((data || []).map((b) => b.id), me.id).catch(() => ({}));
    clients.push({ href: "/brands", label: "Brands", icon: "brand" });
    clients.push({ href: "/messages", label: "Messages", icon: "chat", badge: Object.values(unread).reduce((n, c) => n + c, 0) });
  }
  const admin = [];
  if (feeds.length) admin.push({ href: "/updates", label: "Updates", icon: "slack", badge: feeds.reduce((n, g) => n + g.unread, 0) });
  if (canManageTeam(me)) admin.push({ href: "/team", label: "Team", icon: "team" });
  if (me.role === "admin") admin.push({ href: "/feedback", label: "Feedback", icon: "alert", badge: await newFeedback() });
  // Heads see the groups they run, each with its own page
  const GROUP_ICON = { design: "board", video: "video", production: "video", development: "link", performance: "chart", social: "chat", strategy: "brief", sales: "leads", execution: "team" };
  const staffMe = me.role === "admin";
  const myGroups = [
    // "All groups" opens every team at a glance; the groups you head follow, each with its own page
    ...(staffMe || (me.ledGroups || []).length || (me.groups || []).length ? [{ href: "/groups", label: staffMe ? "All groups" : "My groups", icon: "team" }] : []),
    ...(me.ledGroups || []).map((g) => ({ href: `/groups/${g.id}`, label: g.name, icon: GROUP_ICON[g.kind] || "team" })),
  ];
  const groups = [
    { title: "Main", items: main },
    { title: "Groups", items: myGroups },
    { title: "Sales", items: sales },
    { title: "Clients", items: clients },
    { title: "Admin", items: admin },
  ].filter((g) => g.items.length);
  const items = [...main, ...sales.filter((i) => i.href !== "/leads/new"), ...clients];
  const bottom = admin;
  const theme = await getTheme();
  const roleLabel = me.role === "member" ? me.groups.map((g) => g.name).join(" · ") || "Member" : ROLES.find((r) => r.id === me.role)?.label;

  const profile = {
    name: me.name,
    initials: initials(me.name),
    roleLabel,
    calendar: canSeeLeads(me) ? Boolean(me.calendar_connected_at) : null,
    domain: process.env.ALLOWED_DOMAIN,
    theme,
  };

  return (
    <div className="min-h-svh md:flex md:h-svh md:flex-col md:gap-2.5 md:p-2.5">
      <MobileHeader {...profile} />
      <TopBar
        logo={<Logo />}
        search={canSeeLeads(me)}
        right={
          <>
            <ThemeToggle initial={theme} variant="icon" />
            <PushSetup variant="circle" />
            <AvatarMenu {...profile} />
          </>
        }
      />
      <div className="md:flex md:min-h-0 md:flex-1 md:gap-2.5">
        <Sidebar
          groups={groups}
          bottom={
            <>
              <SwitchAccount variant="side" domain={process.env.ALLOWED_DOMAIN} />
              <form action="/auth/signout" method="post">
                <SideButton type="submit" label="Logout" icon="logout" />
              </form>
            </>
          }
        />
        <div className="md:flex md:min-w-0 md:flex-1 md:flex-col md:gap-2.5">
          <div id="scroller" className="app-canvas min-w-0 md:min-h-0 md:flex-1 md:overflow-y-auto md:rounded-2xl md:border md:border-line">
            <main className="relative z-[1] min-w-0 pb-[calc(env(safe-area-inset-bottom)+104px)] md:pb-6">{children}</main>
          </div>
          <footer className="hidden h-10 shrink-0 items-center justify-between rounded-2xl border border-line bg-panel px-4 text-[11px] text-muted md:flex">
            <span>
              © {new Date().getFullYear()} · Kyro <span className="text-faint">v2.0</span>
            </span>
            <span>
              by <span className="rounded-md border border-line bg-panel-2 px-1.5 py-0.5 font-medium text-ink">Inloop Media</span>
            </span>
          </footer>
        </div>
      </div>
      <PhoneTabs items={items.filter((it) => it.href !== "/leads/new")} bottom={bottom} />
      {me.role !== "admin" && <FeedbackNote />}
      <Celebration initial={await unseenCelebrations(me).catch(() => [])} />
    </div>
  );
}
