// The task desk: headline numbers, a status pipeline, brands on the left, the task table on the right
// and who's carrying how much. Server component — filters and sorting live in the URL, so every view
// is a link you can share or bookmark.
import Link from "next/link";
import Icon from "@/components/Icon";
import SelectNav from "@/components/SelectNav";
import { Avatar, Empty } from "@/components/ui";
import { OPEN_TASK, TASK_STATUSES, taskKindLabel } from "@/lib/constants";

const now = () => Date.now();
const REVIEW = ["completed", "client_rejected"];
const isOverdue = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < now();
const STATUS_ORDER = Object.keys(TASK_STATUSES);

// The pipeline, left to right. "In review" folds completed + client-asked-for-changes together.
const STAGES = [
  { id: "todo", label: "To do", color: TASK_STATUSES.assigned.color, has: (t) => t.status === "assigned" },
  { id: "doing", label: "In progress", color: TASK_STATUSES.in_progress.color, has: (t) => t.status === "in_progress" },
  { id: "revision", label: "Revision", color: TASK_STATUSES.revision.color, has: (t) => t.status === "revision" },
  { id: "review", label: "In review", color: TASK_STATUSES.completed.color, has: (t) => REVIEW.includes(t.status) },
  { id: "client", label: "With client", color: TASK_STATUSES.sent_to_client.color, has: (t) => t.status === "sent_to_client" },
  { id: "done", label: "Approved", color: TASK_STATUSES.done.color, has: (t) => t.status === "done" },
];

/** Per-brand numbers from a list of tasks (+ brands that have none yet, if given). */
export function brandRows(tasks, brands = []) {
  const rows = new Map(brands.map((b) => [b.id, { id: b.id, name: b.name, tasks: [] }]));
  for (const t of tasks) {
    if (!t.brand) continue;
    if (!rows.has(t.brand.id)) rows.set(t.brand.id, { id: t.brand.id, name: t.brand.name, tasks: [] });
    rows.get(t.brand.id).tasks.push(t);
  }
  return [...rows.values()].map((r) => {
    const by = {};
    for (const t of r.tasks) {
      const n = t.assigner?.name || "—";
      by[n] = (by[n] || 0) + 1;
    }
    return {
      ...r,
      total: r.tasks.length,
      open: r.tasks.filter((t) => OPEN_TASK.includes(t.status)).length,
      active: r.tasks.filter((t) => t.status !== "done").length,
      review: r.tasks.filter((t) => REVIEW.includes(t.status)).length,
      client: r.tasks.filter((t) => t.status === "sent_to_client").length,
      overdue: r.tasks.filter(isOverdue).length,
      done: r.tasks.filter((t) => t.status === "done").length,
      latest: r.tasks.reduce((m, t) => (t.updated_at > m ? t.updated_at : m), ""),
      assigners: Object.entries(by).sort((a, b) => b[1] - a[1]),
    };
  });
}

const BRAND_SORTS = {
  open: { label: "Most active", fn: (a, b) => b.active - a.active || b.overdue - a.overdue },
  overdue: { label: "Most overdue", fn: (a, b) => b.overdue - a.overdue || b.active - a.active },
  recent: { label: "Recently updated", fn: (a, b) => (b.latest || "").localeCompare(a.latest || "") },
  name: { label: "A–Z", fn: (a, b) => a.name.localeCompare(b.name) },
};
const byDue = (a, b) => (a.due_at || "9999").localeCompare(b.due_at || "9999");
const TASK_SORTS = {
  due: { label: "Due date", fn: byDue },
  brand: { label: "Brand", fn: (a, b) => (a.brand?.name || "").localeCompare(b.brand?.name || "") || byDue(a, b) },
  status: { label: "Status", fn: (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || byDue(a, b) },
  assignee: { label: "Assignee", fn: (a, b) => (a.assignee?.name || "").localeCompare(b.assignee?.name || "") || byDue(a, b) },
  new: { label: "Newest", fn: (a, b) => (b.created_at || "").localeCompare(a.created_at || "") },
};
export const SHOWS = {
  open: { label: "Active", fn: (t) => t.status !== "done" },
  review: { label: "Needs review", fn: (t) => REVIEW.includes(t.status) },
  overdue: { label: "Overdue", fn: isOverdue },
  client: { label: "With client", fn: (t) => t.status === "sent_to_client" },
  done: { label: "Approved", fn: (t) => t.status === "done" },
  all: { label: "All", fn: () => true },
};

export function hrefWith(base, params, patch, hash = "") {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) q.set(k, v);
  const s = q.toString();
  return `${base}${s ? `?${s}` : ""}${hash}`;
}

/** Thin stacked bar of where a set of tasks sits in the pipeline. */
function StageBar({ tasks, className = "h-1.5" }) {
  const total = tasks.length;
  return (
    <div className={`flex w-full gap-[2px] overflow-hidden rounded-full bg-panel-2 ${className}`}>
      {total > 0 &&
        STAGES.map((s) => {
          const n = tasks.filter(s.has).length;
          return n ? <span key={s.id} title={`${s.label}: ${n}`} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(n / total) * 100}%`, background: s.color }} /> : null;
        })}
    </div>
  );
}

/** Headline numbers — each one is a filter for the table below. */
export function TaskKpis({ tasks, base, params }) {
  const today = new Date().toDateString();
  const dueToday = tasks.filter((t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).toDateString() === today).length;
  const week = now() - 7 * 86400000;
  const approvedWeek = tasks.filter((t) => t.status === "done" && t.done_at && new Date(t.done_at).getTime() > week).length;
  const items = [
    { show: "open", label: "Active tasks", value: tasks.filter(SHOWS.open.fn).length, note: `${tasks.filter((t) => OPEN_TASK.includes(t.status)).length} with the team`, icon: "tasks" },
    { show: "review", label: "Needs your review", value: tasks.filter(SHOWS.review.fn).length, note: "Completed or sent back", icon: "check", accent: "#a78bfa" },
    { show: "overdue", label: "Overdue", value: tasks.filter(isOverdue).length, note: dueToday ? `${dueToday} more due today` : "Nothing else due today", icon: "alert", accent: "#fb7185" },
    { show: "client", label: "With client", value: tasks.filter(SHOWS.client.fn).length, note: "Waiting on approval", icon: "clock", accent: "#22d3ee" },
    { show: "done", label: "Approved", value: tasks.filter(SHOWS.done.fn).length, note: `${approvedWeek} this week`, icon: "sparkle", accent: "#4ade80" },
  ];
  const current = SHOWS[params.show] ? params.show : "open";
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map((it, i) => {
        const on = current === it.show;
        return (
          <Link
            key={it.show}
            href={hrefWith(base, params, { show: it.show }, "#task-list")}
            scroll={false}
            className={`card group relative flex flex-col gap-3 overflow-hidden !rounded-3xl p-4 transition hover:-translate-y-0.5 ${i === 0 ? "col-span-2 md:col-span-1" : ""} ${on ? "ring-1 ring-brand/60" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">{it.label}</span>
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-panel-2 text-muted group-hover:text-ink" style={it.accent && it.value ? { color: it.accent } : undefined}>
                <Icon name={it.icon} size={13} />
              </span>
            </div>
            <div className="text-[32px] font-medium leading-none tracking-[-0.03em] tabular-nums">{it.value}</div>
            <div className="truncate text-[11px] text-muted">{it.note}</div>
            {on && <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-brand" />}
          </Link>
        );
      })}
    </div>
  );
}

/** One bar for the whole pipeline with a legend. */
export function Pipeline({ tasks }) {
  return (
    <div className="card !rounded-3xl px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <span className="text-sm font-medium">Pipeline</span>
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
          {STAGES.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
              <b className="font-medium tabular-nums text-ink">{tasks.filter(s.has).length}</b>
            </li>
          ))}
        </ul>
      </div>
      <StageBar tasks={tasks} className="mt-3 h-2.5" />
    </div>
  );
}

function BrandRail({ rows, brandFilter, link, bsort, base, params, totalActive, showAssigners }) {
  return (
    <section className="card !rounded-3xl p-3">
      <header className="flex items-center justify-between gap-2 px-2 pb-3 pt-1">
        <h2 className="text-sm font-medium">
          Brands <span className="text-muted">· {rows.length}</span>
        </h2>
        <SelectNav value={bsort} options={Object.entries(BRAND_SORTS).map(([k, o]) => ({ value: k, label: o.label, href: hrefWith(base, params, { bsort: k }) }))} />
      </header>
      <nav className="flex max-h-[290px] flex-col gap-0.5 overflow-y-auto lg:max-h-[560px]">
        <Link href={link({ brand: "" })} scroll={false} className={`flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-sm transition ${!brandFilter ? "bg-panel-2 font-medium" : "text-muted hover:bg-panel-2/60 hover:text-ink"}`}>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-panel-2 text-muted">
            <Icon name="board" size={14} />
          </span>
          <span className="flex-1">All brands</span>
          <span className="tabular-nums text-xs text-muted">{totalActive}</span>
        </Link>
        {rows.map((r) => {
          const on = r.id === brandFilter;
          return (
            <Link key={r.id} href={link({ brand: on ? "" : r.id })} scroll={false} className={`relative flex items-center gap-3 rounded-2xl px-2.5 py-2.5 transition ${on ? "bg-panel-2" : "hover:bg-panel-2/60"}`}>
              {on && <span className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-brand" />}
              <Avatar name={r.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`truncate text-sm ${on ? "font-medium" : ""}`}>{r.name}</span>
                  {r.overdue > 0 && <span className="shrink-0 rounded-full bg-rose-400/15 px-1.5 text-[10px] font-semibold leading-4 text-rose-400">{r.overdue} late</span>}
                </div>
                <StageBar tasks={r.tasks} className="mt-1.5 h-1" />
                {showAssigners && r.assigners.length > 0 && (
                  <div className="mt-1 truncate text-[10px] text-faint">
                    {r.assigners.map(([n, c]) => `${n.split(" ")[0]} ${c}`).join(" · ")}
                  </div>
                )}
              </div>
              <span className="w-6 text-right text-xs tabular-nums text-muted">{r.active}</span>
            </Link>
          );
        })}
        {!rows.length && <p className="px-3 py-6 text-center text-xs text-muted">No brands yet.</p>}
      </nav>
    </section>
  );
}

function TeamLoad({ tasks }) {
  const people = new Map();
  for (const t of tasks) {
    if (!t.assignee || t.status === "done") continue;
    const p = people.get(t.assignee.id) || { name: t.assignee.name, open: 0, late: 0, review: 0 };
    if (OPEN_TASK.includes(t.status)) p.open++;
    if (isOverdue(t)) p.late++;
    if (REVIEW.includes(t.status)) p.review++;
    people.set(t.assignee.id, p);
  }
  const list = [...people.values()].sort((a, b) => b.open - a.open || b.late - a.late);
  const max = Math.max(1, ...list.map((p) => p.open));
  if (!list.length) return null;
  return (
    <section className="card !rounded-3xl p-5">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Team load</h2>
        <span className="text-[11px] text-muted">open tasks</span>
      </header>
      <ul className="flex flex-col gap-3.5">
        {list.slice(0, 8).map((p) => (
          <li key={p.name} className="flex items-center gap-3">
            <Avatar name={p.name} size={26} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {p.late > 0 && <span className="mr-1.5 text-rose-400">{p.late} late</span>}
                  <b className="font-medium text-ink">{p.open}</b>
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-panel-2">
                <span className="bar-fill" style={{ width: `${(p.open / max) * 100}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const shortDay = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
/** "Overdue 2d", "Due in 5h", "Today", "18 Nov" — short enough for a table cell. */
function Due({ t }) {
  if (!t.due_at) return <span className="text-faint">—</span>;
  const ms = new Date(t.due_at).getTime() - now();
  const open = OPEN_TASK.includes(t.status);
  if (open && ms < 0) {
    const d = Math.floor(-ms / 86400000);
    return <span className="font-medium text-rose-400">Overdue{d ? ` ${d}d` : ""}</span>;
  }
  if (open && ms < 86400000) return <span className="font-medium text-amber-400">In {Math.max(1, Math.round(ms / 3600000))}h</span>;
  return <span>{shortDay.format(new Date(t.due_at))}</span>;
}

const COLS = "md:grid md:grid-cols-[minmax(0,1fr)_130px_160px_96px_150px] md:items-center md:gap-4";

function StatusTag({ status }) {
  const s = TASK_STATUSES[status] || { label: status, color: "#9ca3af" };
  const label = { completed: "In review", client_rejected: "Changes asked" }[status] || s.label;
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: `color-mix(in srgb, ${s.color} 14%, transparent)`, color: `color-mix(in oklab, ${s.color} 72%, var(--color-ink))` }}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
      <span className="truncate">{label}</span>
    </span>
  );
}

function Row({ t, showBrand }) {
  return (
    <Link href={`/tasks/${t.id}`} className={`group flex items-start gap-3 px-4 py-3 transition hover:bg-panel-2/70 sm:px-5 ${COLS}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg bg-panel-2 text-[9px] font-semibold uppercase tracking-wide text-muted sm:grid">{taskKindLabel(t.kind).slice(0, 4)}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium group-hover:text-brand">{t.title}</span>
            {t.revision > 0 && <span className="shrink-0 rounded-full bg-rose-400/15 px-1.5 text-[10px] font-semibold leading-4 text-rose-400">R{t.revision}</span>}
          </div>
          {/* phone: the other columns collapse into one line */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted md:hidden">
            {showBrand && t.brand && <span>{t.brand.name}</span>}
            {t.assignee && <span>· {t.assignee.name.split(" ")[0]}</span>}
            <span>·</span>
            <Due t={t} />
            <StatusTag status={t.status} />
          </div>
        </div>
      </div>
      <span className="hidden truncate text-xs text-muted md:block">{t.brand?.name || "—"}</span>
      <span className="hidden min-w-0 items-center gap-2 text-xs md:flex">
        {t.assignee ? (
          <>
            <Avatar name={t.assignee.name} size={22} />
            <span className="truncate">{t.assignee.name}</span>
          </>
        ) : (
          <span className="text-faint">Unassigned</span>
        )}
      </span>
      <span className="hidden whitespace-nowrap text-xs text-muted md:block">
        <Due t={t} />
      </span>
      <span className="hidden md:block">
        <StatusTag status={t.status} />
      </span>
    </Link>
  );
}

/**
 *   tasks      the tasks in scope (already permission-filtered)
 *   brands     optional: active brands, so ones without tasks still show
 *   base       the page path ("/" or "/tasks"); params = current search params (kept in every link)
 *   showAssigners  show who assigned the work (useful when several heads assign)
 *   kpis       show the headline numbers + pipeline on top
 */
export default function TaskOverview({ tasks, brands = [], base, params = {}, showAssigners = true, kpis = true }) {
  const bsort = BRAND_SORTS[params.bsort] ? params.bsort : "open";
  const tsort = TASK_SORTS[params.tsort] ? params.tsort : "due";
  const show = SHOWS[params.show] ? params.show : "open";
  const rows = brandRows(tasks, brands).sort(BRAND_SORTS[bsort].fn);
  const brandFilter = rows.some((r) => r.id === params.brand) ? params.brand : "";
  const picked = rows.find((r) => r.id === brandFilter);
  const scoped = brandFilter ? tasks.filter((t) => t.brand?.id === brandFilter) : tasks;
  const list = scoped.filter(SHOWS[show].fn).sort(TASK_SORTS[tsort].fn);
  const link = (patch, hash = "") => hrefWith(base, params, patch, hash);

  // Group under brand headings when sorted by brand across all brands
  const groups = tsort === "brand" && !brandFilter ? [...new Set(list.map((t) => t.brand?.name || "No brand"))].map((name) => ({ name, items: list.filter((t) => (t.brand?.name || "No brand") === name) })) : [{ name: "", items: list }];

  return (
    <div className="flex flex-col gap-4">
      {kpis && (
        <>
          <TaskKpis tasks={tasks} base={base} params={params} />
          <Pipeline tasks={tasks} />
        </>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <BrandRail rows={rows} brandFilter={brandFilter} link={link} bsort={bsort} base={base} params={params} totalActive={tasks.filter(SHOWS.open.fn).length} showAssigners={showAssigners} />
          <div className="hidden lg:block">
            <TeamLoad tasks={scoped} />
          </div>
        </aside>

        <section id="task-list" className="card min-w-0 scroll-mt-6 overflow-hidden !rounded-3xl">
          <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 pb-3 pt-4 sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {picked ? <Avatar name={picked.name} size={34} /> : null}
              <div className="min-w-0">
                <h2 className="truncate text-base font-medium">{picked ? picked.name : "All tasks"}</h2>
                <p className="text-xs text-muted">
                  {list.length} {SHOWS[show].label.toLowerCase()} task{list.length === 1 ? "" : "s"}
                  {picked && showAssigners && picked.assigners.length > 0 && <> · assigned by {picked.assigners.map(([n, c]) => `${n.split(" ")[0]} (${c})`).join(", ")}</>}
                </p>
              </div>
            </div>
            {picked && (
              <Link href={`/brands/${picked.id}`} className="btn-ghost btn-sm">
                <Icon name="brand" size={13} /> Open brand
              </Link>
            )}
            <SelectNav label="Sort" value={tsort} options={Object.entries(TASK_SORTS).map(([k, o]) => ({ value: k, label: o.label, href: link({ tsort: k }) }))} />
          </header>

          <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 sm:px-4">
            {Object.entries(SHOWS).map(([k, o]) => {
              const n = scoped.filter(o.fn).length;
              const on = show === k;
              return (
                <Link key={k} href={link({ show: k })} scroll={false} className={`relative flex shrink-0 items-center gap-1.5 px-2.5 py-3 text-xs font-medium transition ${on ? "text-ink" : "text-muted hover:text-ink"}`}>
                  {o.label}
                  <span className={`rounded-full px-1.5 tabular-nums leading-4 ${on ? "bg-brand/15 text-brand" : "bg-panel-2"} ${k === "overdue" && n ? "!bg-rose-400/15 !text-rose-400" : ""}`}>{n}</span>
                  {on && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-brand" />}
                </Link>
              );
            })}
          </nav>

          <div className={`hidden border-b border-line bg-panel-2/40 px-5 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-faint ${COLS}`}>
            <span>Task</span>
            <span>Brand</span>
            <span>Assignee</span>
            <span>Due</span>
            <span>Status</span>
          </div>

          {list.length ? (
            groups.map((g) => (
              <div key={g.name || "all"}>
                {g.name && (
                  <div className="flex items-center gap-2 border-b border-line bg-panel-2/30 px-5 py-2 text-xs font-medium">
                    <Avatar name={g.name} size={18} />
                    {g.name}
                    <span className="text-muted">{g.items.length}</span>
                  </div>
                )}
                <div className="divide-y divide-line">
                  {g.items.map((t) => (
                    <Row key={t.id} t={t} showBrand={!brandFilter} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="py-6">
              <Empty icon="tasks">{show === "overdue" ? "Nothing overdue. 🎉" : show === "review" ? "Nothing waiting for your review." : "No tasks here."}</Empty>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
