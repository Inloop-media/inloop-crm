// Content calendar → "Brand plans": every brand's month at a glance.
//   Four numbers on top, then rich cards for brands that have a plan (or posts) this month, and one
//   compact row of chips for brands with nothing set yet. Every card / chip opens that brand's calendar.
import Link from "next/link";
import Icon from "@/components/Icon";
import { BrandMark, Empty } from "@/components/ui";
import { planProgress } from "@/lib/calendar";
import { kindPlural } from "@/lib/constants";

const href = (p) => {
  const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v));
  const s = q.toString();
  return `/calendar${s ? `?${s}` : ""}`;
};

/** A small ring with the planned share in the middle. */
function Ring({ pct, tone, label }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid h-12 w-12 shrink-0 place-items-center">
      <svg viewBox="0 0 40 40" className="absolute inset-0 h-12 w-12 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-panel-2)" strokeWidth="3.5" />
        {pct > 0 && <circle cx="20" cy="20" r={r} fill="none" stroke={tone} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} />}
      </svg>
      <span className="text-[11px] font-medium tabular-nums">{label ?? `${pct}%`}</span>
    </span>
  );
}

/** Planned → assigned → done as three stacked layers of one bar. */
function Stages({ max, planned, assigned, done }) {
  const w = (n) => `${max ? Math.min(100, (n / max) * 100) : 0}%`;
  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-panel-2">
      <span className="absolute inset-y-0 left-0 rounded-full bg-ink/15" style={{ width: w(planned) }} />
      <span className="absolute inset-y-0 left-0 rounded-full bg-ink/40" style={{ width: w(assigned) }} />
      <span className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: w(done) }} />
    </div>
  );
}

function PlanCard({ b, plan, p, month }) {
  const pct = p.target ? Math.min(100, Math.round((p.planned / p.target) * 100)) : 100;
  const status = !p.target
    ? ["No deliverables set", "bg-panel-2 text-muted", "var(--color-faint)"]
    : p.planned >= p.target
      ? ["Fully planned", "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400", "#10b981"]
      : p.planned
        ? [`${p.target - p.planned} still to plan`, "bg-amber-500/12 text-amber-600 dark:text-amber-400", "#f59e0b"]
        : ["Not started", "bg-rose-500/12 text-rose-500", "#f43f5e"];
  const max = Math.max(p.target, p.planned, 1);
  return (
    <Link href={href({ brand: b.id, month })} className="group card card-hover flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <BrandMark name={b.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium group-hover:text-brand">{b.name}</div>
          <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-medium ${status[1]}`}>{status[0]}</span>
        </div>
        <Ring pct={p.target ? pct : 0} tone={status[2]} label={p.target ? undefined : "—"} />
      </div>

      <div>
        <Stages max={max} planned={p.planned} assigned={p.assigned} done={p.done} />
        <div className="mt-2 grid grid-cols-3 text-[11.5px] text-muted">
          <span>
            <b className="text-[14px] font-medium tabular-nums text-ink">{p.planned}</b>
            {p.target ? <span className="text-faint">/{p.target}</span> : ""} planned
          </span>
          <span className="text-center">
            <b className="text-[14px] font-medium tabular-nums text-ink">{p.assigned}</b> assigned
          </span>
          <span className="text-right">
            <b className="text-[14px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{p.done}</b> done
          </span>
        </div>
      </div>

      {p.rows.length > 0 && (
        <ul className="flex flex-col gap-2 border-t border-line pt-3">
          {p.rows.map((r) => {
            const of = Math.max(r.target, r.planned, 1);
            return (
              <li key={r.kind} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-[12px]">
                <span className="truncate text-muted">{kindPlural(r.kind)}</span>
                <span className="h-1 overflow-hidden rounded-full bg-panel-2">
                  <span className={`block h-full rounded-full ${r.target && r.planned >= r.target ? "bg-emerald-500" : "bg-ink/50"}`} style={{ width: `${Math.min(100, (r.planned / of) * 100)}%` }} />
                </span>
                <span className="tabular-nums">
                  {r.planned}
                  {r.target ? <span className="text-faint">/{r.target}</span> : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {plan?.inherited && <span className="-mt-2 text-[10.5px] text-faint">Deliverables carried over from an earlier month</span>}
    </Link>
  );
}

export default function PlansOverview({ brands, plans, items, month }) {
  if (!brands.length)
    return (
      <div className="card">
        <Empty icon="brand">No onboarded brands yet.</Empty>
      </div>
    );
  const rows = brands.map((b) => ({ b, plan: plans[b.id], p: planProgress(plans[b.id], items.filter((i) => i.brand_id === b.id)) }));
  const live = rows.filter((r) => r.p.target || r.p.planned).sort((x, y) => (x.p.target ? x.p.planned / x.p.target : 2) - (y.p.target ? y.p.planned / y.p.target : 2));
  const idle = rows.filter((r) => !r.p.target && !r.p.planned);
  const sum = (f) => live.reduce((n, r) => n + r.p[f], 0);
  const target = sum("target");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Brands with a plan", live.length, `of ${rows.length}`],
          ["Posts planned", sum("planned"), target ? `of ${target}` : ""],
          ["Assigned", sum("assigned"), "to the team"],
          ["Done", sum("done"), "posted or approved", "text-emerald-600 dark:text-emerald-400"],
        ].map(([l, v, note, cls]) => (
          <div key={l} className="card px-4 py-3.5">
            <div className="text-[12px] text-muted">{l}</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={`text-[26px] font-light leading-none tabular-nums tracking-[-0.02em] ${cls || ""}`}>{v}</span>
              {note && <span className="text-[11.5px] text-faint">{note}</span>}
            </div>
          </div>
        ))}
      </div>

      {live.length > 0 ? (
        <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {live.map(({ b, plan, p }) => (
            <PlanCard key={b.id} b={b} plan={plan} p={p} month={month} />
          ))}
        </div>
      ) : (
        <p className="card px-5 py-4 text-[13px] text-muted">No brand has a plan for this month yet. Pick one below to set its deliverables.</p>
      )}

      {idle.length > 0 && (
        <section className="card p-5">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[14px] font-medium">
              Not set up yet <span className="text-[13px] font-normal tabular-nums text-muted">{idle.length}</span>
            </h2>
            <span className="text-[12px] text-faint">Open a brand to set this month&apos;s deliverables</span>
          </header>
          <div className="flex flex-wrap gap-2">
            {idle.map(({ b }) => (
              <Link key={b.id} href={href({ brand: b.id, month })} className="group flex items-center gap-2 rounded-full border border-line bg-panel py-1 pl-1 pr-3 text-[12.5px] transition hover:border-line-strong hover:bg-panel-2">
                <BrandMark name={b.name} size={22} />
                <span className="group-hover:text-brand">{b.name}</span>
                <Icon name="plus" size={11} className="text-faint" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
