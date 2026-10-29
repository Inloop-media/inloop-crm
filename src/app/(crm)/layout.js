import Logo from "@/components/Logo";
import Nav, { TabBar } from "@/components/Nav";
import MobileHeader from "@/components/MobileHeader";
import Icon from "@/components/Icon";
import ConnectCalendar from "@/components/ConnectCalendar";
import PushSetup from "@/components/PushSetup";
import ThemeToggle from "@/components/ThemeToggle";
import { getTheme } from "@/lib/theme";
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
  const theme = await getTheme();
  const roleLabel = me.role === "member" ? me.groups.map((g) => g.name).join(" · ") || "Member" : ROLES.find((r) => r.id === me.role)?.label;

  return (
    <div className="min-h-svh md:grid md:grid-cols-[248px_1fr]">
      <MobileHeader
        name={me.name}
        initials={initials(me.name)}
        roleLabel={roleLabel}
        calendar={canSeeLeads(me) ? Boolean(me.calendar_connected_at) : null}
        domain={process.env.ALLOWED_DOMAIN}
        theme={theme}
      />

      <aside className="sticky top-0 z-20 hidden h-svh flex-col border-r border-line bg-panel/70 px-3 pb-4 pt-6 backdrop-blur-xl md:flex">
        <div className="px-2.5">
          <Logo />
        </div>
        <div className="mt-9 flex-1 overflow-y-auto">
          <div className="eyebrow mb-2.5 px-3">Workspace</div>
          <Nav items={items} />
        </div>

        <div className="flex flex-col gap-2.5">
          <PushSetup />
          {canSeeLeads(me) &&
            (me.calendar_connected_at ? (
              <div className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs text-muted">
                <Icon name="calendar" size={14} className="text-emerald-400" />
                Calendar connected
              </div>
            ) : (
              <div className="rounded-xl border border-brand/25 bg-brand/[0.06] p-3">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Icon name="calendar" size={14} className="text-brand" />
                  Connect your calendar
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">Needed to book Google Meet calls from the CRM.</p>
                <ConnectCalendar domain={process.env.ALLOWED_DOMAIN} className="mt-2 text-xs font-medium text-brand hover:underline">
                  Connect →
                </ConnectCalendar>
              </div>
            ))}
          <ThemeToggle initial={theme} />

          <div className="mt-1 flex items-center gap-3 rounded-xl border border-line bg-panel-2/50 p-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-fuchsia-400 text-xs font-semibold text-on-brand">
              {initials(me.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{me.name}</div>
              <div className="truncate text-[11px] text-muted">{roleLabel}</div>
            </div>
            <form action="/auth/signout" method="post">
              <button title="Sign out" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-panel-3 hover:text-ink">
                <Icon name="logout" size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="relative z-[1] min-w-0 pb-[calc(env(safe-area-inset-bottom)+84px)] md:pb-0">{children}</main>
      <TabBar items={items} />
    </div>
  );
}
