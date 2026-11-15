import Logo from "@/components/Logo";
import { Suspense } from "react";
import { unreadCounts } from "@/lib/chat";
import Link from "next/link";
import { PhoneTabs, Sidebar } from "@/components/Nav";
import Icon from "@/components/Icon";
import MobileHeader, { SidebarProfile } from "@/components/MobileHeader";
import FeedbackNote from "@/components/FeedbackNote";
import Celebration from "@/components/Celebration";
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
  // Sidebar (ClickUp / Notion style): your work on top, sales, then every brand as a workspace
  const tasksCount = await taskBadge(me).catch(() => 0);
  const feeds = await listFeeds(me);
  const main = [{ href: "/", label: "Home", icon: "home" }];
  if (canAssignTasks(me) || isMaker(me) || tasksCount) main.push({ href: "/tasks", label: canAssignTasks(me) ? "Tasks" : "My tasks", icon: "tasks", badge: tasksCount });
  if (canSeeCalendar(me)) main.push({ href: "/calendar", label: "Content calendar", icon: "calendar" });
  const sales = [];
  if (canSeeLeads(me)) sales.push({ href: "/leads", label: "Leads", icon: "leads" });
  if (canSeeBriefs(me)) sales.push({ href: "/briefs", label: "Proposals", icon: "brief", badge: await briefsBadge(me) });
  const groups = [
    { title: "", items: main },
    { title: "Sales", items: sales },
  ].filter((g) => g.items.length);

  let brands = null;
  if (canSeeBrands(me) || canSeeCalendar(me)) {
    const { data } = await db().from("brands").select("id, name, stage").order("name");
    const list = (data || []).filter((b) => b.stage === "active" || canSeeBrands(me));
    const unread = canSeeBrands(me) ? await unreadCounts(list.map((b) => b.id), me.id).catch(() => ({})) : {};
    brands = {
      allHref: canSeeBrands(me) ? "/brands" : "/calendar",
      items: list
        .sort((a, b) => (b.stage === "active") - (a.stage === "active") || a.name.localeCompare(b.name))
        .map((b) => ({ id: b.id, name: b.name, href: canSeeBrands(me) ? `/brands/${b.id}` : `/calendar?brand=${b.id}`, badge: unread[b.id] || 0, muted: b.stage !== "active" })),
    };
  }

  const bottom = [];
  if (feeds.length) bottom.push({ href: "/updates", label: "Updates", icon: "slack", badge: feeds.reduce((n, g) => n + g.unread, 0) });
  if (canManageTeam(me)) bottom.push({ href: "/team", label: "Team", icon: "team" });
  if (me.role === "admin") bottom.push({ href: "/feedback", label: "Feedback", icon: "chat", badge: await newFeedback() });
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
    <div className="min-h-svh">
      <MobileHeader {...profile} />

      <div className="md:flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-svh w-[248px] shrink-0 flex-col gap-6 border-r border-line bg-panel/40 px-3 py-5 backdrop-blur-xl md:flex">
          <Link href="/" aria-label="Home" className="px-3">
            <Logo />
          </Link>
          <Suspense>
          <Sidebar
            groups={groups}
            brands={brands}
            bottom={bottom}
            top={
              canCreateLead(me) ? (
                <Link href="/leads/new" className="btn-primary btn-sm mx-1 !justify-start">
                  <Icon name="plus" size={14} /> New lead
                </Link>
              ) : null
            }
            footer={<SidebarProfile {...profile} />}
          />
          </Suspense>
        </aside>
        <main className="relative z-[1] min-w-0 flex-1 pb-[calc(env(safe-area-inset-bottom)+96px)] md:pb-6">{children}</main>
      </div>
      <Suspense>
        <PhoneTabs groups={groups} brands={brands} bottom={bottom} />
      </Suspense>
      {me.role !== "admin" && <FeedbackNote />}
      <Celebration initial={await unseenCelebrations(me).catch(() => [])} />
    </div>
  );
}
