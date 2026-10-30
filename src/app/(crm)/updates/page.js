import Link from "next/link";
import Icon from "@/components/Icon";
import { Empty } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listFeeds, listGroupPosts, markGroupRead } from "@/lib/leads";
import { canManageTeam, canSeeAllLeads, isStrategist } from "@/lib/permissions";
import { UPDATE_EVENTS } from "@/lib/constants";
import { ago, fmtDateTime } from "@/lib/format";

export const metadata = { title: "Updates" };

const TONE = {
  crl_ready: "bg-brand/15 text-brand",
  proposal_ready: "bg-emerald-400/15 text-emerald-300",
  brief_shared: "bg-fuchsia-400/15 text-fuchsia-300",
  proposal_meeting: "bg-violet-400/15 text-violet-300",
  bot_failed: "bg-rose-400/15 text-rose-300",
};

export default async function UpdatesPage({ searchParams }) {
  const me = await requireMember();
  const { group } = await searchParams;
  const feeds = await listFeeds(me);
  const current = feeds.find((g) => g.id === group) || feeds.find((g) => g.unread) || feeds.find((g) => g.notify.length) || feeds[0];
  const posts = current ? await listGroupPosts(current.id) : [];
  if (current) await markGroupRead(current.id, me.id);
  const leadHref = (lead) => (canSeeAllLeads(me) ? `/leads/${lead.id}` : isStrategist(me) ? `/briefs/${lead.id}` : null);

  return (
    <div className="relative z-[1] mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-9">
      <header className="rise mb-7">
        <p className="eyebrow">Workspace</p>
        <h1 className="page-title mt-1.5"><em>Updates</em></h1>
        <p className="mt-2 text-sm text-muted">What the bots and the pipeline post to your groups — CRL links, proposals, new briefs.</p>
      </header>

      {!feeds.length ? (
        <div className="card">
          <Empty icon="team">You&apos;re not in any group yet. Ask an admin to add you.</Empty>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <nav className="flex gap-1.5 overflow-x-auto md:flex-col">
            {feeds.map((g) => (
              <Link
                key={g.id}
                href={`/updates?group=${g.id}`}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition md:border-transparent ${
                  current?.id === g.id ? "border-brand/30 bg-brand/[0.08] text-ink md:bg-panel-2" : "border-line text-muted hover:bg-panel-2/60 hover:text-ink"
                }`}
              >
                <span className="text-faint">#</span>
                <span className="min-w-0 flex-1 truncate">{g.name}</span>
                {g.unread > 0 && current?.id !== g.id && (
                  <span className="rounded-full bg-brand/20 px-1.5 text-[11px] font-medium tabular-nums text-brand">{g.unread}</span>
                )}
              </Link>
            ))}
          </nav>

          <section className="card min-w-0 p-4 sm:p-6">
            <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight"># {current.name}</h2>
                <p className="mt-1 text-xs text-muted">
                  {current.notify.length
                    ? `Gets: ${UPDATE_EVENTS.filter((e) => current.notify.includes(e.id)).map((e) => e.label).join(", ")}`
                    : "This group doesn't receive any updates yet."}
                </p>
              </div>
              {canManageTeam(me) && (
                <Link href="/team#groups" className="text-xs text-muted hover:text-ink">
                  Change what posts here →
                </Link>
              )}
            </header>

            {posts.length ? (
              <ol className="flex flex-col gap-6">
                {posts.map((p) => {
                  const ev = UPDATE_EVENTS.find((e) => e.id === p.event);
                  const href = p.lead && leadHref(p.lead);
                  return (
                    <li key={p.id} className="flex gap-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONE[p.event] || "bg-panel-2 text-muted"}`}>
                        <Icon name={ev?.icon || "sparkle"} size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-semibold">Inloop bot</span>
                          <span className="text-[11px] text-faint" title={fmtDateTime(p.created_at)}>
                            {ago(p.created_at)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-sm text-ink/90">
                          {href ? (
                            <Link href={href} className="hover:text-brand">
                              {p.title}
                            </Link>
                          ) : (
                            p.title
                          )}
                        </div>
                        {p.url && (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 flex max-w-md items-center gap-3 rounded-xl border border-ink/[0.08] bg-gradient-to-br from-brand/[0.08] to-transparent p-3 transition hover:border-brand/40"
                          >
                            <Icon name="external" size={14} className="shrink-0 text-brand" />
                            <span className="min-w-0 truncate text-sm text-brand">{p.url.replace(/^https?:\/\//, "")}</span>
                          </a>
                        )}
                        {p.body && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted">{p.body}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <Empty icon="clock">Nothing posted here yet.</Empty>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
