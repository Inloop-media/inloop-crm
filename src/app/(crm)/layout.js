import Logo from "@/components/Logo";
import Link from "next/link";
import { Suspense } from "react";
import Nav, { Rail, TabBar } from "@/components/Nav";
import MobileHeader, { ProfileMenu } from "@/components/MobileHeader";
import ThemeToggle from "@/components/ThemeToggle";
import FeedbackNote from "@/components/FeedbackNote";
import { getTheme } from "@/lib/theme";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { listFeeds } from "@/lib/leads";
import { canCreateLead, canManageTeam, canSeeBriefs, canSeeLeads, isStrategist } from "@/lib/permissions";
import { ROLES } from "@/lib/constants";

/** Work waiting on this member: open briefs for strategists, commercials for admin / ops. */
async function briefsBadge(me) {
  const staff = me.role === "admin" || me.role === "ops";
  let q = db().from("proposals").select("id", { count: "exact", head: true });
  if (staff) q = q.in("stage", ["awaiting_commercials", "crl_failed", "proposal_failed"]);
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
  const items = [{ href: "/", label: "Dashboard", icon: "home" }];
  if (canSeeLeads(me)) items.push({ href: "/leads", label: "Leads", icon: "leads" });
  if (canSeeBriefs(me)) items.push({ href: "/briefs", label: "Briefs", icon: "brief", badge: await briefsBadge(me) });
  const feeds = await listFeeds(me);
  if (feeds.length) items.push({ href: "/updates", label: "Updates", icon: "slack", badge: feeds.reduce((n, g) => n + g.unread, 0) });
  if (canManageTeam(me)) items.push({ href: "/team", label: "Team", icon: "team" });
  if (me.role === "admin") items.push({ href: "/feedback", label: "Feedback", icon: "chat", badge: await newFeedback() });
  const theme = await getTheme();
  const roleLabel = me.role === "member" ? me.groups.map((g) => g.name).join(" · ") || "Member" : ROLES.find((r) => r.id === me.role)?.label;

  // Quick actions on the left rail
  const rail = [{ href: "/", label: "Home", icon: "home" }];
  if (canCreateLead(me)) rail.push({ href: "/leads/new", label: "New lead", icon: "plus" });
  if (canSeeLeads(me)) {
    rail.push({ href: "/leads?view=board", label: "Pipeline board", icon: "board" });
    rail.push({ href: "/leads?view=list", label: "Lead list", icon: "list" });
  }
  if (canSeeBriefs(me)) rail.push({ href: "/briefs", label: "Briefs", icon: "brief" });
  if (feeds.length) rail.push({ href: "/updates", label: "Updates", icon: "bell" });

  const profile = {
    name: me.name,
    initials: initials(me.name),
    roleLabel,
    calendar: canSeeLeads(me) ? Boolean(me.calendar_connected_at) : null,
    domain: process.env.ALLOWED_DOMAIN,
    theme,
  };

  return (
    <div className="min-h-svh md:p-4 lg:p-5">
      <MobileHeader {...profile} />

      <div className="md:frame md:flex md:min-h-[calc(100svh-2.5rem)] md:flex-col">
        {/* Desktop top bar: logo · sections · search / bell / profile */}
        <header className="relative z-20 hidden items-center gap-4 px-6 pt-5 md:flex">
          <div className="flex flex-1 items-center">
            <Link href="/" aria-label="Dashboard">
              <Logo compact />
            </Link>
          </div>
          <Nav items={items} />
          <div className="flex flex-1 justify-end">
            <ProfileMenu {...profile} />
          </div>
        </header>

        <div className="md:flex md:flex-1">
          {/* Desktop left rail: quick actions on top, theme switch at the bottom */}
          <aside className="sticky top-5 z-20 hidden h-[calc(100svh-7rem)] shrink-0 flex-col items-center justify-between py-6 pl-6 md:flex">
            <Suspense>
              <Rail actions={rail} />
            </Suspense>
            <ThemeToggle initial={theme} />
          </aside>
          <main className="relative z-[1] min-w-0 flex-1 pb-[calc(env(safe-area-inset-bottom)+96px)] md:pb-2">{children}</main>
        </div>
      </div>
      <TabBar items={items} />
      {me.role !== "admin" && <FeedbackNote />}
    </div>
  );
}
