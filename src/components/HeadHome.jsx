// The heads' home (layout "B"): three numbers, then two columns.
//   Left  — To check (with the work and the buttons), Late, In progress
//   Right — meetings and groups (passed in as `side`), who has how much, brands
import Link from "next/link";
import Icon from "@/components/Icon";
import ReviewButtons from "@/components/ReviewButtons";
import { TaskLine } from "@/components/Desk";
import { Block, Counts, SeeAll, TeamLoad, TwoCol } from "@/components/Home";
import { OPEN_TASK, taskKindLabel } from "@/lib/constants";

const now = () => Date.now();
const IST = "Asia/Kolkata";
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
const late = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < now();
const isImg = (n) => /\.(jpe?g|png|webp|gif)$/i.test(n || "");
const isVid = (n) => /\.(mp4|mov|webm|m4v)$/i.test(n || "");

function Preview({ file, title }) {
  if (file && isImg(file.name) && file.href)
    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
    return <img src={file.href} alt={title} className="h-full w-full object-cover" loading="lazy" />;
  if (file && isVid(file.name) && file.href) return <video src={file.href} className="h-full w-full bg-black object-cover" muted playsInline preload="metadata" />;
  return (
    <span className="grid h-full w-full place-items-center text-muted">
      <Icon name={file ? "file" : "tasks"} size={18} />
    </span>
  );
}

/** Brands with open work, most late / busiest first — a short list. */
function Brands({ tasks, brands, boardHref }) {
  const byBrand = new Map(brands.map((b) => [b.id, { ...b, tasks: [] }]));
  for (const t of tasks) if (t.brand) (byBrand.get(t.brand.id) || byBrand.set(t.brand.id, { ...t.brand, tasks: [] }).get(t.brand.id)).tasks.push(t);
  const list = [...byBrand.values()]
    .map((b) => ({ ...b, open: b.tasks.filter((t) => t.status !== "done").length, late: b.tasks.filter(late).length }))
    .filter((b) => b.open)
    .sort((a, b) => b.late - a.late || b.open - a.open || a.name.localeCompare(b.name))
    .slice(0, 6);
  if (!list.length) return null;
  return (
    <Block title="Brands" action={<SeeAll href={boardHref} />}>
      <ul className="mt-1">
        {list.map((b) => (
          <li key={b.id} className="border-b border-line last:border-0">
            <Link href={`/brands/${b.id}`} className="group flex items-center justify-between gap-3 py-2.5 text-[13px]">
              <span className="truncate group-hover:text-brand">{b.name}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {b.open} open{b.late ? <span className="text-rose-500"> · {b.late} late</span> : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Block>
  );
}

/**
 *   tasks   every task in scope
 *   brands  active brands ({ id, name })
 *   files   { taskId: [{ name, href }] } — the latest files of the tasks waiting for review
 *   side    cards for the top of the right column (meetings, groups)
 */
export default function HeadHome({ tasks, brands = [], files = {}, boardHref = "/tasks", side = null }) {
  const today = dayKey(now());
  const review = tasks.filter((t) => ["completed", "client_rejected"].includes(t.status) && !t.with_lead).sort((a, b) => (a.updated_at || "").localeCompare(b.updated_at || ""));
  const overdue = tasks.filter(late).sort((a, b) => a.due_at.localeCompare(b.due_at));
  const inWork = tasks.filter((t) => OPEN_TASK.includes(t.status) && !late(t)).sort((a, b) => (a.due_at || "9").localeCompare(b.due_at || "9"));
  const dueToday = inWork.filter((t) => t.due_at && dayKey(t.due_at) === today);
  const held = tasks.filter((t) => t.status === "on_hold");

  const team = Object.values(
    tasks
      .filter((t) => OPEN_TASK.includes(t.status) && t.assignee)
      .reduce((acc, t) => {
        const p = (acc[t.assignee.id] ||= { id: t.assignee.id, name: t.assignee.name, open: 0, late: 0 });
        p.open += 1;
        if (late(t)) p.late += 1;
        return acc;
      }, {})
  ).sort((a, b) => b.late - a.late || b.open - a.open);

  return (
    <>
      <Counts
        items={[
          { label: "To check", value: review.length, tone: "red", href: "/tasks?show=check" },
          { label: "Late", value: overdue.length, tone: "red", href: "/tasks?show=late" },
          { label: "Due today", value: dueToday.length, tone: "amber", href: "/tasks?show=progress" },
        ]}
      />
      <TwoCol
        main={
          <>
            <div id="review" className="scroll-mt-6">
              <Block title="To check" count={review.length} empty="All checked. Finished work shows up here.">
                <ul className="mt-1">
                  {review.map((t) => {
                    const f = files[t.id] || [];
                    return (
                      <li key={t.id} className="flex flex-col gap-3 border-b border-line py-3.5 last:border-0 sm:flex-row sm:items-center">
                        <Link href={`/tasks/${t.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
                          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-panel-2">
                            <Preview file={f[0]} title={t.title} />
                            {f.length > 1 && <span className="absolute bottom-1 right-1 rounded-full bg-black/60 px-1 text-[9px] font-medium text-white">+{f.length - 1}</span>}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-medium group-hover:text-brand">{t.title}</span>
                            <span className="block truncate text-[12px] text-muted">
                              {[taskKindLabel(t.kind), t.brand?.name, t.assignee?.name.split(" ")[0], t.revision > 0 && `v${t.revision + 1}`].filter(Boolean).join(" · ")}
                            </span>
                            {t.status === "client_rejected" && t.feedback && <span className="mt-1 line-clamp-2 block text-[12px] text-orange-500">Client: “{t.feedback}”</span>}
                          </span>
                        </Link>
                        <div className="shrink-0 sm:max-w-[340px]">
                          <ReviewButtons task={t} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Block>
            </div>
            <div id="late" className="scroll-mt-6">
              <Block title="Late" count={overdue.length}>
                <ul className="mt-1">
                  {overdue.map((t) => (
                    <TaskLine key={t.id} t={t} />
                  ))}
                </ul>
              </Block>
            </div>
            <div id="work" className="scroll-mt-6">
              <Block title="In progress" count={inWork.length} action={inWork.length > 8 ? <SeeAll href={boardHref} /> : null}>
                <ul className="mt-1">
                  {inWork.slice(0, 8).map((t) => (
                    <TaskLine key={t.id} t={t} />
                  ))}
                </ul>
              </Block>
            </div>
          </>
        }
        side={
          <>
            {side}
            <Block title="On hold" count={held.length}>
              <ul className="mt-1">
                {held.map((t) => (
                  <TaskLine key={t.id} t={t} />
                ))}
              </ul>
            </Block>
            <TeamLoad people={team.slice(0, 8)} href={boardHref} />
            <Brands tasks={tasks} brands={brands} boardHref={boardHref} />
          </>
        }
      />
    </>
  );
}
