import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import ThemeToggle from "@/components/ThemeToggle";
import { BrandMark, Empty, StatCard } from "@/components/ui";
import Decide from "@/app/client/Decide";
import ClientChatDock from "@/app/client/ClientChatDock";
import { PLATFORMS, taskKindLabel } from "@/lib/constants";


const KIND_COLOR = { post: "#60a5fa", carousel: "#a78bfa", story: "#f472b6", reel: "#fbbf24", video: "#22d3ee" };
const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** What's coming up on the brand's content calendar (read-only for the client). */
function UpcomingCalendar({ items }) {
  const days = [...new Set(items.map((i) => i.publish_on))].slice(0, 10);
  return (
    <section className="rise card p-5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-normal tracking-[-0.01em]">Coming up</h2>
          <p className="text-xs text-muted">Your content calendar — what goes out next</p>
        </div>
        <span className="rounded-full bg-panel-2 px-2.5 py-1 text-[11px] text-muted">{items.length} planned</span>
      </div>
      {days.length ? (
        <ol className="flex flex-col">
          {days.map((d) => {
            const date = new Date(`${d}T00:00:00Z`);
            return (
              <li key={d} className="flex gap-4 border-b border-line py-3 last:border-0">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-panel-2 text-center leading-none">
                  <span className="text-[10px] uppercase text-muted">{date.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}</span>
                  <span className="text-lg font-medium">{date.getUTCDate()}</span>
                </div>
                <ul className="flex min-w-0 flex-1 flex-col gap-2">
                  {items
                    .filter((i) => i.publish_on === d)
                    .map((i) => (
                      <li key={i.id} className="flex items-center gap-3">
                        <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: KIND_COLOR[i.kind] || "#94a3b8" }} />
                        <div className="min-w-0">
                          <div className={`truncate text-sm font-medium ${i.status === "posted" ? "line-through opacity-60" : ""}`}>{i.title}</div>
                          <div className="text-xs text-muted">
                            {dayFmt.format(date)} · {taskKindLabel(i.kind)}
                            {PLATFORMS.find((p) => p.id === i.platform) ? ` · ${PLATFORMS.find((p) => p.id === i.platform).label}` : ""}
                            {i.status === "posted" && " · Posted ✓"}
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              </li>
            );
          })}
        </ol>
      ) : (
        <Empty icon="calendar">Your next posts show up here once the calendar is planned.</Empty>
      )}
    </section>
  );
}

const isImg = (n) => /\.(jpe?g|png|webp|gif)$/i.test(n || "");
const isVid = (n) => /\.(mp4|mov|webm|m4v)$/i.test(n || "");

function Media({ f, title, big }) {
  const cls = `w-full bg-panel-2 ${big ? "max-h-[70vh] object-contain" : "aspect-square object-cover"}`;
  if (isImg(f.name) && f.href)
    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
    return <img src={f.href} alt={title} className={cls} loading="lazy" />;
  if (isVid(f.name) && f.href) return <video src={f.href} className={`${cls} bg-black`} controls={big} muted={!big} playsInline preload="metadata" />;
  return (
    <a href={f.href} target="_blank" rel="noreferrer" className={`grid place-items-center gap-2 p-6 text-sm text-muted ${big ? "min-h-40" : "aspect-square"} bg-panel-2`}>
      <Icon name={f.storage_path ? "file" : "link"} size={22} />
      <span className="max-w-full truncate px-2">{f.name}</span>
    </a>
  );
}

/** The client's dashboard (data comes from app/client/page.js). */
export default function ClientView({ brand, pending, approved, inProduction, theme, chat, upcoming, lastReadAt, unread, members = [] }) {
  const total = pending.length + approved.length + inProduction;
  const monthKey = new Date().toISOString().slice(0, 7);
  const thisMonth = upcoming.filter((i) => i.publish_on.startsWith(monthKey)).length;
  const gallery = approved.flatMap((t) => t.files.map((f) => ({ ...f, task: t }))).slice(0, 12);

  return (
    <div className="min-h-svh md:flex md:h-svh md:flex-col md:gap-2.5 md:p-2.5">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4 md:rounded-2xl md:border">
        <Logo />
        <span className="hidden h-6 w-px bg-line sm:block" />
        <span className="hidden items-center gap-2 text-sm sm:flex">
          <BrandMark name={brand.name} size={24} />
          {brand.name}
        </span>
        <span className="flex-1" />
        <ThemeToggle initial={theme} variant="icon" />
        <form action="/auth/signout" method="post">
          <button className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-3 text-[13px] text-muted hover:text-ink">
            <Icon name="logout" size={14} /> Sign out
          </button>
        </form>
      </header>

      <div className="app-canvas min-w-0 md:min-h-0 md:flex-1 md:overflow-y-auto md:rounded-2xl md:border md:border-line">
        <main className="page">
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex min-w-0 flex-col gap-4">
              {/* Welcome */}
              <section className="rise card relative overflow-hidden p-6">
                <span className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
                <div className="relative flex flex-wrap items-center gap-4">
                  <BrandMark name={brand.name} size={60} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted">Welcome to the Loop 👋</p>
                    <h1 className="text-[30px] font-normal leading-tight tracking-[-0.02em] md:text-[38px]">{brand.name}</h1>
                    <p className="mt-1 text-sm text-muted">Here&apos;s everything Inloop Media is making for you.</p>
                  </div>
                </div>
                <div className="relative mt-6 flex h-2.5 gap-1">
                  <span className="rounded-full bg-gradient-to-r from-brand-soft to-brand" style={{ width: `${Math.max(3, total ? (approved.length / total) * 100 : 0)}%` }} />
                  <span className="hatch flex-1 rounded-full" />
                </div>
                <p className="relative mt-2 text-[11px] text-muted">
                  {approved.length} of {total} pieces approved
                </p>
              </section>

              <div className="rise grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard coral label="To review" value={pending.length} note={pending.length ? "Needs your OK" : "All caught up"} />
                <StatCard label="In production" value={inProduction} note="Being made now" />
                <StatCard label="Approved" value={approved.length} note="Ready to post" />
                <StatCard label="Posts this month" value={thisMonth} note="On your calendar" />
              </div>

              {/* Approvals */}
              <section className="rise">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-normal tracking-[-0.01em]">Waiting for your approval</h2>
                    <p className="text-xs text-muted">Approve it, or tell us what to change — the team gets it straight away.</p>
                  </div>
                  {pending.length > 0 && <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">{pending.length}</span>}
                </div>
                {pending.length ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {pending.map((t) => (
                      <article key={t.id} className="card overflow-hidden">
                        <div className="flex flex-col gap-1">
                          {t.files.length ? t.files.slice(0, 3).map((f) => <Media key={f.id} f={f} title={t.title} big />) : <div className="well-empty m-4 p-8 text-center text-sm text-muted">No file attached.</div>}
                        </div>
                        <div className="flex flex-col gap-4 p-5">
                          <div>
                            <div className="flex items-center gap-2 text-xs text-muted">
                              <span className="rounded-full bg-brand/12 px-2 py-0.5 font-medium text-brand">{taskKindLabel(t.kind)}</span>
                              {t.revision > 0 && <span>Updated version</span>}
                            </div>
                            <h3 className="mt-2 text-base font-medium">{t.title}</h3>
                          </div>
                          <Decide taskId={t.id} />
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="card">
                    <Empty icon="check">Nothing waiting for you right now. New work shows up here as soon as it&apos;s ready.</Empty>
                  </div>
                )}
              </section>

              <UpcomingCalendar items={upcoming} />

              {/* Approved work */}
              <section className="rise card p-5">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-normal tracking-[-0.01em]">Approved work</h2>
                    <p className="text-xs text-muted">Final files you&apos;ve signed off — tap to open or download</p>
                  </div>
                  <span className="rounded-full bg-panel-2 px-2.5 py-1 text-[11px] text-muted">{approved.length} approved</span>
                </div>
                {gallery.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {gallery.map((f) => (
                      <div key={f.id} className="overflow-hidden rounded-xl border border-line bg-panel-2">
                        <Media f={f} title={f.task.title} />
                        <div className="flex items-center gap-2 p-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12px] font-medium">{f.task.title}</div>
                            <div className="text-[10px] text-muted">{taskKindLabel(f.task.kind)}</div>
                          </div>
                          {f.href && (
                            <a href={f.href} target="_blank" rel="noreferrer" aria-label="Open" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-panel text-muted hover:text-brand">
                              <Icon name="external" size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty icon="file">Approved posts, reels and videos collect here.</Empty>
                )}
              </section>
            </div>

            <aside className="rise min-w-0 xl:sticky xl:top-0">
              <ClientChatDock brandId={brand.id} brandName={brand.name} initial={{ messages: chat.messages, reads: chat.reads }} lastReadAt={lastReadAt} unread={unread} members={members} />
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
