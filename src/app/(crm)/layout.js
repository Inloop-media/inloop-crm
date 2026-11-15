import { PhoneTabs, Rail, RailTool, TopBar } from "@/components/Nav";
import MobileHeader, { AvatarMenu } from "@/components/MobileHeader";
import PushSetup from "@/components/PushSetup";
import ThemeToggle from "@/components/ThemeToggle";
import FeedbackNote from "@/components/FeedbackNote";
import Celebration from "@/components/Celebration";
import { unreadCounts } from "@/lib/chat";
import { unseenCelebrations } from "@/lib/brands";
import { taskBadge } from "@/lib/tasks";
import { getTheme } from "@/lib/theme";
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
  // Icon rail, top to bottom: your work, sales, clients
  const tasksCount = await taskBadge(me).catch(() => 0);
  const feeds = await listFeeds(me);
  const items = [{ href: "/", label: "Home", icon: "home" }];
  if (canAssignTasks(me) || isMaker(me) || tasksCount) items.push({ href: "/tasks", label: canAssignTasks(me) ? "Tasks" : "My tasks", icon: "tasks", badge: tasksCount });
  if (canSeeCalendar(me)) items.push({ href: "/calendar", label: "Content calendar", icon: "calendar" });
  if (canSeeLeads(me)) items.push({ href: "/leads", label: "Leads", icon: "leads" });
  if (canSeeBriefs(me)) items.push({ href: "/briefs", label: "Proposals", icon: "brief", badge: await briefsBadge(me) });
  if (canSeeBrands(me)) {
    const { data } = await db().from("brands").select("id");
    const unread = await unreadCounts((data || []).map((b) => b.id), me.id).catch(() => ({}));
    items.push({ href: "/messages", label: "Messages", icon: "chat", badge: Object.values(unread).reduce((n, c) => n + c, 0) });
    items.push({ href: "/brands", label: "Brands", icon: "brand" });
  }
  if (canCreateLead(me)) items.push({ href: "/leads/new", label: "New lead", icon: "plus" });

  const bottom = [];
  if (feeds.length) bottom.push({ href: "/updates", label: "Updates", icon: "slack", badge: feeds.reduce((n, g) => n + g.unread, 0) });
  if (canManageTeam(me)) bottom.push({ href: "/team", label: "Team", icon: "team" });
  if (me.role === "admin") bottom.push({ href: "/feedback", label: "Feedback", icon: "sparkle", badge: await newFeedback() });
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

  const date = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="min-h-svh md:h-svh md:p-3">
      <MobileHeader {...profile} />
      <div className="md:flex md:h-full md:overflow-hidden md:rounded-[34px] md:bg-[var(--wash)] md:shadow-[0_0_0_1px_rgb(0_0_0/0.04),0_30px_80px_-40px_rgb(0_0_0/0.35)]">
        <Rail
          items={items}
          bottom={bottom}
          logo={
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/images/hero-logo.webp" alt="Inloop" className="h-auto w-6" />
          }
          tools={
            <>
              <ThemeToggle initial={theme} variant="icon" />
              <form action="/auth/signout" method="post">
                <RailTool type="submit" label="Sign out" icon="logout" />
              </form>
            </>
          }
        />
        <div id="scroller" className="min-w-0 flex-1 md:overflow-y-auto">
          <TopBar
            items={[...items, ...bottom]}
            date={date}
            search={canSeeLeads(me)}
            right={
              <>
                <PushSetup variant="circle" />
                <AvatarMenu {...profile} />
              </>
            }
          />
          <main className="relative z-[1] min-w-0 pb-[calc(env(safe-area-inset-bottom)+104px)] md:pb-8">{children}</main>
        </div>
      </div>
      <PhoneTabs items={items.filter((it) => it.href !== "/leads/new")} bottom={bottom} />
      {me.role !== "admin" && <FeedbackNote />}
      <Celebration initial={await unseenCelebrations(me).catch(() => [])} />
    </div>
  );
}
