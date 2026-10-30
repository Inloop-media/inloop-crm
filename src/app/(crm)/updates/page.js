import Link from "next/link";
import Icon from "@/components/Icon";
import { Empty, PageHeader } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listFeeds, listGroupPosts, markGroupRead } from "@/lib/leads";
import { canManageTeam, canSeeAllLeads, isStrategist } from "@/lib/permissions";
import { UPDATE_EVENTS } from "@/lib/constants";
import { ago, fmtDateTime } from "@/lib/format";

export const metadata = { title: "Updates" };

const TONE = {
  crl_ready: "tint-lavender text-brand",
  proposal_ready: "tint-green text-emerald-400",
  brief_shared: "tint-pink text-fuchsia-400",
  proposal_meeting: "tint-blue text-violet-400",
  bot_failed: "tint-pink text-rose-400",
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
    <div className="page max-w-6xl">
      <PageHeader kicker="Workspace" title="Updates" sub="What the bots and the pipeline post to your groups — CRL links, proposals, new briefs." />

      {!feeds.length ? (
        <div className="card">
          <Empty icon="team">You&apos;re not in any group yet. Ask an admin to add you.</Empty>
        </div>
      ) : (
        <div className="rise rise-1 grid gap-5 md:grid-cols-[250px_1fr]">
          <nav className="flex gap-1.5 self-start overflow-x-auto rounded-[24px] bg-panel p-1.5 shadow-[var(--card-shadow)] md:flex-col">
            {feeds.map((g) => (
              <Link
                key={g.id}
                href={`/updates?group=${g.id}`}
                className={`flex shrink-0 items-center gap-2.5 rounded-[18px] px-3.5 py-2.5 text-sm transition ${current?.id === g.id ? "solid" : "text-muted hover:bg-panel-2 hover:text-ink"}`}
              >
                <span className="opacity-50">#</span>
                <span className="min-w-0 flex-1 truncate">{g.name}</span>
                {g.unread > 0 && current?.id !== g.id && (
                  <span className="rounded-full bg-brand px-1.5 text-[11px] font-medium tabular-nums text-on-brand">{g.unread}</span>
                )}
              </Link>
            ))}
          </nav>

          <section className="card min-w-0 p-5 sm:p-7">
            <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-5">
              <div className="min-w-0">
                <h2 className="text-xl font-medium tracking-tight"># {current.name}</h2>
                <p className="mt-1 text-xs text-muted">
                  {current.notify.length
                    ? `Gets: ${UPDATE_EVENTS.filter((e) => current.notify.includes(e.id)).map((e) => e.label).join(", ")}`
                    : "This group doesn't receive any updates yet."}
                </p>
              </div>
              {canManageTeam(me) && (
                <Link href="/team#groups" className="btn-ghost btn-sm">
                  Change what posts here
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
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONE[p.event] || "bg-panel-2 text-muted"}`}>
                        <Icon name={ev?.icon || "sparkle"} size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-medium">Inloop bot</span>
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
                            className="well mt-2.5 flex max-w-md items-center gap-3 p-3.5 transition hover:-translate-y-0.5 hover:bg-panel-3"
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
