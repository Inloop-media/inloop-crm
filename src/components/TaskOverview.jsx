// Tasks seen two ways: one card per brand (counts, progress, who assigned them), and the task list
// below it — filter by brand, sort by due date / brand / status / newest. Server component: the
// filter and sort live in the URL, so every view is a link you can share or bookmark.
import Link from "next/link";
import Icon from "@/components/Icon";
import { Avatar, Empty, Panel } from "@/components/ui";
import { TaskList } from "@/components/Tasks";
import { OPEN_TASK, TASK_STATUSES } from "@/lib/constants";

const now = () => Date.now();
const isOverdue = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < now();
const STATUS_ORDER = Object.keys(TASK_STATUSES);

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
      review: r.tasks.filter((t) => ["completed", "client_rejected"].includes(t.status)).length,
      client: r.tasks.filter((t) => t.status === "sent_to_client").length,
      overdue: r.tasks.filter(isOverdue).length,
      done: r.tasks.filter((t) => t.status === "done").length,
      latest: r.tasks.reduce((m, t) => (t.updated_at > m ? t.updated_at : m), ""),
      assigners: Object.entries(by).sort((a, b) => b[1] - a[1]),
    };
  });
}

const BRAND_SORTS = {
  open: { label: "Most open", fn: (a, b) => b.open - a.open || b.overdue - a.overdue },
  overdue: { label: "Overdue", fn: (a, b) => b.overdue - a.overdue || b.open - a.open },
  recent: { label: "Recent", fn: (a, b) => (b.latest || "").localeCompare(a.latest || "") },
  name: { label: "A–Z", fn: (a, b) => a.name.localeCompare(b.name) },
};
const TASK_SORTS = {
  due: { label: "Due date", fn: (a, b) => (a.due_at || "9999").localeCompare(b.due_at || "9999") },
  brand: { label: "Brand", fn: (a, b) => (a.brand?.name || "").localeCompare(b.brand?.name || "") || (a.due_at || "9999").localeCompare(b.due_at || "9999") },
  status: { label: "Status", fn: (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) },
  new: { label: "Newest", fn: (a, b) => (b.created_at || "").localeCompare(a.created_at || "") },
};
const SHOWS = {
  open: { label: "Open", fn: (t) => t.status !== "done" },
  overdue: { label: "Overdue", fn: isOverdue },
  review: { label: "To review", fn: (t) => ["completed", "client_rejected"].includes(t.status) },
  done: { label: "Approved", fn: (t) => t.status === "done" },
  all: { label: "All", fn: () => true },
};

function hrefWith(base, params, patch, hash = "") {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) q.set(k, v);
  const s = q.toString();
  return `${base}${s ? `?${s}` : ""}${hash}`;
}

function Seg({ options, current, link }) {
  return (
    <nav className="seg flex overflow-x-auto p-1">
      {Object.entries(options).map(([k, o]) => (
        <Link key={k} href={link(k)} scroll={false} data-on={current === k} className="seg-item whitespace-nowrap px-3 py-1.5 text-xs">
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

/** One brand: counts, progress, who assigned the work. */
export function BrandTaskCard({ r, href, selected = false, showAssigners = true }) {
  const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
  return (
    <Link href={href} scroll={false} className={`card card-hover group flex flex-col gap-4 p-5 ${selected ? "ring-2 ring-brand" : ""}`}>
      <div className="flex items-center gap-3">
        <Avatar name={r.name} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium">{r.name}</div>
          <div className="text-xs text-muted">
            {r.total} task{r.total === 1 ? "" : "s"} assigned
          </div>
        </div>
        {r.overdue > 0 && <span className="shrink-0 rounded-full bg-rose-400/15 px-2 py-0.5 text-[11px] font-semibold text-rose-400">{r.overdue} late</span>}
      </div>
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {[
          ["Open", r.open],
          ["Review", r.review],
          ["Client", r.client],
          ["Done", r.done],
        ].map(([l, v]) => (
          <div key={l} className="well px-1 py-2">
            <div className="text-base font-medium">{v}</div>
            <div className="text-[10px] text-muted">{l}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="flex justify-between text-[11px] text-muted">
          <span>Approved</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
          <div className="bar-fill h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {showAssigners && r.assigners.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          <span>Assigned by</span>
          {r.assigners.map(([name, n]) => (
            <span key={name} className="inline-flex items-center gap-1 rounded-full bg-panel-2 py-0.5 pl-0.5 pr-2">
              <Avatar name={name} size={16} />
              {name.split(" ")[0]} <b className="font-semibold text-ink">{n}</b>
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

/**
 * The whole block.
 *   tasks      the tasks in scope (already permission-filtered)
 *   brands     optional: active brands, so ones without tasks still get a card
 *   base       the page path ("/" or "/tasks"); params = current search params (kept in every link)
 *   showAssigners  show "Assigned by …" (useful when several heads assign)
 */
export default function TaskOverview({ tasks, brands = [], base, params = {}, showAssigners = true, title = "By brand", sub }) {
  const bsort = BRAND_SORTS[params.bsort] ? params.bsort : "open";
  const tsort = TASK_SORTS[params.tsort] ? params.tsort : "due";
  const show = SHOWS[params.show] ? params.show : "open";
  const rows = brandRows(tasks, brands).sort(BRAND_SORTS[bsort].fn);
  const brandFilter = rows.some((r) => r.id === params.brand) ? params.brand : "";
  const picked = rows.find((r) => r.id === brandFilter);
  const list = tasks.filter((t) => (!brandFilter || t.brand?.id === brandFilter) && SHOWS[show].fn(t)).sort(TASK_SORTS[tsort].fn);
  const link = (patch, hash = "#task-list") => hrefWith(base, params, patch, hash);

  return (
    <div className="flex flex-col gap-5">
      <Panel title={title} sub={sub || `${rows.length} brand${rows.length === 1 ? "" : "s"} · tap one to see its tasks`} action={<Seg options={BRAND_SORTS} current={bsort} link={(k) => link({ bsort: k }, "")} />}>
        {rows.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => (
              <BrandTaskCard key={r.id} r={r} selected={r.id === brandFilter} showAssigners={showAssigners} href={link({ brand: r.id === brandFilter ? "" : r.id })} />
            ))}
          </div>
        ) : (
          <Empty icon="brand">No tasks assigned yet.</Empty>
        )}
      </Panel>

      <Panel
        id="task-list"
        title={picked ? `${picked.name} · tasks` : "All tasks"}
        sub={`${list.length} shown`}
        action={
          picked ? (
            <Link href={`/brands/${picked.id}`} className="btn-ghost btn-sm">
              <Icon name="brand" size={13} /> Open brand
            </Link>
          ) : null
        }
      >
        <div className="mb-4 flex flex-col gap-3">
          {rows.length > 1 && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              <Link href={link({ brand: "" })} scroll={false} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${!brandFilter ? "solid" : "bg-panel-2 text-muted hover:text-ink"}`}>
                All brands
              </Link>
              {rows.map((r) => (
                <Link key={r.id} href={link({ brand: r.id })} scroll={false} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${brandFilter === r.id ? "solid" : "bg-panel-2 text-muted hover:text-ink"}`}>
                  {r.name}
                  <span className="tabular-nums opacity-60">{r.total - r.done}</span>
                </Link>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Seg options={SHOWS} current={show} link={(k) => link({ show: k })} />
            <span className="flex-1" />
            <span className="text-xs text-muted">Sort</span>
            <Seg options={TASK_SORTS} current={tsort} link={(k) => link({ tsort: k })} />
          </div>
        </div>
        <TaskList tasks={list} showBrand={!brandFilter} empty="No tasks here." />
      </Panel>
    </div>
  );
}
