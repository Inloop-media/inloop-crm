// The heads' home: three plain questions — what do I need to check, what's late, how is each brand doing.
import Link from "next/link";
import Icon from "@/components/Icon";
import { Avatar, StatCard } from "@/components/ui";
import ReviewButtons from "@/components/ReviewButtons";
import { OPEN_TASK, taskKindLabel } from "@/lib/constants";

const now = () => Date.now();
const late = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < now();
const daysLate = (t) => Math.max(0, Math.floor((now() - new Date(t.due_at).getTime()) / 86400000));
const isImg = (n) => /\.(jpe?g|png|webp|gif)$/i.test(n || "");
const isVid = (n) => /\.(mp4|mov|webm|m4v)$/i.test(n || "");

function Heading({ id, title, sub, action }) {
  return (
    <div id={id} className="mb-3 mt-10 flex scroll-mt-6 items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-medium tracking-[-0.015em]">{title}</h2>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function Preview({ file, title }) {
  if (file && isImg(file.name) && file.href)
    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
    return <img src={file.href} alt={title} className="h-full w-full object-cover" loading="lazy" />;
  if (file && isVid(file.name) && file.href) return <video src={file.href} className="h-full w-full bg-black object-cover" muted playsInline preload="metadata" />;
  return (
    <span className="grid h-full w-full place-items-center text-muted">
      <Icon name={file ? "file" : "tasks"} size={20} />
    </span>
  );
}

/**
 *   tasks   every task in scope
 *   brands  active brands ({ id, name })
 *   files   { taskId: [{ name, href }] } — the latest files of the tasks waiting for review
 */
export default function HeadHome({ tasks, brands = [], files = {}, boardHref = "/tasks" }) {
  const review = tasks.filter((t) => ["completed", "client_rejected"].includes(t.status)).sort((a, b) => (a.updated_at || "").localeCompare(b.updated_at || ""));
  const overdue = tasks.filter(late).sort((a, b) => a.due_at.localeCompare(b.due_at));
  const withClient = tasks.filter((t) => t.status === "sent_to_client");
  const inWork = tasks.filter((t) => OPEN_TASK.includes(t.status));

  const byBrand = new Map(brands.map((b) => [b.id, { ...b, tasks: [] }]));
  for (const t of tasks) if (t.brand) (byBrand.get(t.brand.id) || byBrand.set(t.brand.id, { ...t.brand, tasks: [] }).get(t.brand.id)).tasks.push(t);
  const brandCards = [...byBrand.values()]
    .map((b) => ({ ...b, open: b.tasks.filter((t) => t.status !== "done").length, late: b.tasks.filter(late).length, done: b.tasks.filter((t) => t.status === "done").length }))
    .sort((a, b) => b.late - a.late || b.open - a.open || a.name.localeCompare(b.name));

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard coral href="#review" label="To check" value={review.length} note={review.length ? "Work the team finished" : "Nothing waiting"} />
        <StatCard href="#late" label="Late" value={overdue.length} tone="#e11d48" note={overdue.length ? "Past the due date" : "Nothing late"} />
        <StatCard href={boardHref} label="In progress" value={inWork.length} note="Being made now" />
        <StatCard href={boardHref} label="With clients" value={withClient.length} note="Waiting for their OK" bar={tasks.length ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100) : 0} />
      </div>

      <Heading id="review" title="To check" sub="The team finished these. Look at the work, then send it to the client, approve it, or send it back." />
      {review.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {review.map((t) => {
            const f = files[t.id] || [];
            return (
              <article key={t.id} className="card flex gap-4 !rounded-3xl p-4">
                <Link href={`/tasks/${t.id}`} className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-panel-2 sm:h-32 sm:w-32">
                  <Preview file={f[0]} title={t.title} />
                  {f.length > 1 && <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-1.5 text-[10px] font-medium text-white">+{f.length - 1}</span>}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div className="min-w-0">
                    <Link href={`/tasks/${t.id}`} className="line-clamp-2 text-[15px] font-medium hover:text-brand">
                      {t.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">
                      {t.brand?.name} · {taskKindLabel(t.kind)} · by {t.assignee?.name.split(" ")[0]}
                      {t.revision > 0 && ` · version ${t.revision + 1}`}
                    </p>
                    {t.status === "client_rejected" && t.feedback && <p className="mt-2 line-clamp-3 rounded-xl bg-orange-400/10 px-3 py-2 text-xs text-orange-300">Client: “{t.feedback}”</p>}
                  </div>
                  <ReviewButtons task={t} />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="card !rounded-3xl p-6 text-sm text-muted">All checked. ✓ New work shows up here when someone finishes a task.</p>
      )}

      {overdue.length > 0 && (
        <>
          <Heading id="late" title="Late" sub="Past the due date — nudge the person or move the date." />
          <ul className="card flex flex-col divide-y divide-line !rounded-3xl px-2">
            {overdue.map((t) => (
              <li key={t.id}>
                <Link href={`/tasks/${t.id}`} className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-panel-2/60">
                  {t.assignee && <Avatar name={t.assignee.name} size={32} />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-muted">
                      {t.brand?.name} · {t.assignee?.name}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-rose-400/15 px-2.5 py-1 text-xs font-medium text-rose-400">{daysLate(t) ? `${daysLate(t)} day${daysLate(t) > 1 ? "s" : ""} late` : "Late today"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <Heading
        title="Brands"
        sub="Tap a brand to see all its work."
        action={
          <Link href={boardHref} className="btn-ghost btn-sm">
            All tasks <Icon name="arrow" size={13} />
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {brandCards.map((b) => {
          const total = b.tasks.length;
          const pct = total ? Math.round((b.done / total) * 100) : 0;
          return (
            <Link key={b.id} href={`/brands/${b.id}`} className="card card-hover flex items-center gap-4 !rounded-3xl p-4">
              <Avatar name={b.name} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-medium">{b.name}</span>
                  {b.late > 0 && <span className="shrink-0 rounded-full bg-rose-400/15 px-1.5 text-[10px] font-semibold leading-4 text-rose-400">{b.late} late</span>}
                </div>
                <div className="text-xs text-muted">{total ? `${b.open} in progress · ${b.done} done` : "No tasks yet"}</div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-panel-2">
                  <span className="bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
