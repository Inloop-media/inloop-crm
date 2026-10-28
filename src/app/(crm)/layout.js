import Logo from "@/components/Logo";
import Nav from "@/components/Nav";
import Icon from "@/components/Icon";
import ConnectCalendar from "@/components/ConnectCalendar";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { listFeeds } from "@/lib/leads";
import { canManageTeam, canSeeBriefs, canSeeLeads, isStrategist } from "@/lib/permissions";
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
  const roleLabel = me.role === "member" ? me.groups.map((g) => g.name).join(" · ") || "Member" : ROLES.find((r) => r.id === me.role)?.label;

  return (
    <div className="min-h-svh md:grid md:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-line bg-panel/90 px-4 py-3 backdrop-blur md:h-svh md:flex-col md:items-stretch md:justify-start md:border-b-0 md:border-r md:bg-panel/60 md:px-3 md:py-5">
        <div className="md:px-2">
          <Logo />
        </div>
        <div className="flex-1 md:mt-8">
          <div className="eyebrow mb-2 hidden px-3 md:block">Workspace</div>
          <Nav items={items} />
        </div>

        <div className={canSeeLeads(me) ? "hidden md:block" : "hidden"}>
          {me.calendar_connected_at ? (
            <div className="mx-1 mb-3 flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs text-muted">
              <Icon name="calendar" size={14} className="text-emerald-400" />
              Calendar connected
            </div>
          ) : (
            <div className="mx-1 mb-3 rounded-lg border border-brand/25 bg-brand/[0.06] p-3">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Icon name="calendar" size={14} className="text-brand" />
                Connect your calendar
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">Needed to book Google Meet calls from the CRM.</p>
              <ConnectCalendar domain={process.env.ALLOWED_DOMAIN} className="mt-2 text-xs font-medium text-brand hover:underline">
                Connect →
              </ConnectCalendar>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 md:border-t md:border-line md:px-2 md:pt-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-fuchsia-400 text-xs font-semibold text-black">
            {initials(me.name)}
          </span>
          <div className="hidden min-w-0 flex-1 md:block">
            <div className="truncate text-sm">{me.name}</div>
            <div className="truncate text-xs text-muted">{roleLabel}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button title="Sign out" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-panel-2 hover:text-white">
              <Icon name="logout" />
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
