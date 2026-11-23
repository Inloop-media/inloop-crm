// "Brands this month" for the admin and the CBOs (Krish sir, Udit sir): every active brand's content
// calendar at a glance — approved, with the client, in progress, not assigned — and, in the coral card,
// the work the team leads approved that is waiting to be shared with the client.
import Link from "next/link";
import Icon from "@/components/Icon";
import WorkBar from "@/components/WorkBar";
import { RoundLink } from "@/components/Bold";
import { BrandMark } from "@/components/ui";
import { db } from "@/lib/supabase/server";
import { loadItems, monthLabel } from "@/lib/calendar";
import { countBuckets } from "@/lib/workStatus";
import { taskKindLabel } from "@/lib/constants";

const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);

export default async function BrandMonth() {
  const month = thisMonth();
  const [{ data: brands }, { data: ready }] = await Promise.all([
    db().from("brands").select("id, name").eq("stage", "active").order("name"),
    db()
      .from("tasks")
      .select("id, title, kind, updated_at, brand:brands(id, name), assignee:members!tasks_assignee_id_fkey(name)")
      .eq("status", "ready")
      .order("updated_at")
      .limit(50),
  ]);
  const list = brands || [];
  if (!list.length) return null;
  const items = await loadItems(
    list.map((b) => b.id),
    month
  );
  const rows = list
    .map((b) => ({ b, c: countBuckets(items.filter((i) => i.brand_id === b.id)) }))
    .filter((r) => r.c.total)
    .sort((x, y) => y.c.unassigned - x.c.unassigned || y.c.progress + y.c.review - (x.c.progress + x.c.review) || x.b.name.localeCompare(y.b.name));
  const empty = list.filter((b) => !rows.some((r) => r.b.id === b.id));
  const all = countBuckets(items);
  const toShare = ready || [];

  return (
    <div className="rise grid gap-4 xl:grid-cols-12">
      <section className="card p-5 xl:col-span-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted">Content calendars · {monthLabel(month)}</p>
            <h2 className="mt-1 text-[22px] font-normal leading-tight tracking-[-0.02em]">
              Brands <span className="text-brand">this month</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-panel-2 px-3 py-1.5 text-[12px] text-muted">
              <b className="font-medium tabular-nums text-ink">{all.done}</b>/{all.total} approved · <b className="font-medium tabular-nums text-ink">{all.unassigned}</b> not assigned
            </span>
            <RoundLink href={`/calendar?month=${month}`} label="All brands calendar" />
          </div>
        </div>

        <ul className="mt-4 flex flex-col">
          {rows.map(({ b, c }) => (
            <li key={b.id} className="border-b border-line last:border-0">
              <Link href={`/calendar?brand=${b.id}&month=${month}`} className="group grid items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(150px,1fr)_minmax(0,2fr)]">
                <span className="flex min-w-0 items-center gap-2.5">
                  <BrandMark name={b.name} size={30} />
                  <span className="truncate text-[13.5px] font-medium group-hover:text-brand">{b.name}</span>
                </span>
                <span className="min-w-0">
                  <WorkBar c={c} className="h-2" />
                  <span className="mt-1.5 flex flex-wrap gap-x-3 text-[11.5px] text-muted">
                    <span>
                      <b className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{c.done}</b>/{c.total} approved
                    </span>
                    {c.ready + c.shared > 0 && (
                      <span>
                        <b className="font-medium tabular-nums text-cyan-600 dark:text-cyan-400">{c.ready + c.shared}</b> with client
                      </span>
                    )}
                    {c.progress + c.review > 0 && (
                      <span>
                        <b className="font-medium tabular-nums text-amber-600 dark:text-amber-400">{c.progress + c.review}</b> in progress
                      </span>
                    )}
                    {c.unassigned > 0 && (
                      <span>
                        <b className="font-medium tabular-nums text-brand">{c.unassigned}</b> not assigned
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {!rows.length && <li className="py-6 text-center text-[13px] text-muted">No posts planned for {monthLabel(month)} yet.</li>}
        </ul>
        {empty.length > 0 && (
          <p className="mt-3 text-[12px] text-faint">
            No posts planned yet: {empty.slice(0, 8).map((b) => b.name).join(", ")}
            {empty.length > 8 ? ` +${empty.length - 8} more` : ""}
          </p>
        )}
      </section>

      <section className="card-coral flex flex-col p-5 xl:col-span-4">
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-normal tracking-[-0.01em]">Ready to share</h2>
          <RoundLink href="/tasks" label="Tasks" light />
        </div>
        <div className="mt-4 flex items-end gap-2">
          <span className="text-[64px] font-light leading-none tabular-nums">{toShare.length}</span>
          <span className="mb-2 text-xs leading-tight text-white/80">
            approved by the team,
            <br />
            waiting for the client
          </span>
        </div>
        <ul className="mt-auto flex flex-col gap-1.5 pt-5">
          {toShare.slice(0, 5).map((t) => (
            <li key={t.id}>
              <Link href={`/tasks/${t.id}`} className="flex items-center gap-2.5 rounded-xl bg-white/12 px-3 py-2 text-[12px] transition hover:bg-white/20">
                <Icon name="download" size={13} className="shrink-0 text-white/80" />
                <span className="min-w-0 flex-1 truncate">
                  {t.title} <span className="text-white/65">· {t.brand?.name}</span>
                </span>
                <span className="shrink-0 text-[10.5px] text-white/65">{taskKindLabel(t.kind)}</span>
              </Link>
            </li>
          ))}
          {toShare.length > 5 && <li className="px-1 text-[11px] text-white/75">+{toShare.length - 5} more on the Tasks page</li>}
          {!toShare.length && <li className="text-[12px] text-white/85">Nothing waiting — approved work shows up here.</li>}
        </ul>
      </section>
    </div>
  );
}
