// Content calendar → "Brand plans", in the Overview's bold style:
//   a hero with posts planned against the month's target, a coral card of brands that still need a plan,
//   a card per brand with a plan (ring + one hatched bar per post type; the furthest along is the black
//   card), and grey tiles for brands with nothing set yet. Everything opens that brand's calendar.
import Link from "next/link";
import Icon from "@/components/Icon";
import { DARK, HatchBar, Ring, RoundLink, Tile } from "@/components/Bold";
import { BrandMark, Empty } from "@/components/ui";
import { planProgress } from "@/lib/calendar";
import { kindPlural } from "@/lib/constants";

const href = (p) => {
  const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v));
  const s = q.toString();
  return `/calendar${s ? `?${s}` : ""}`;
};
const share = (p) => (p.target ? Math.min(100, Math.round((p.planned / p.target) * 100)) : p.planned ? 100 : 0);

function PlanCard({ b, plan, p, month, dark }) {
  const pct = share(p);
  const muted = dark ? "text-white/60" : "text-muted";
  const note = !p.target ? "No targets set" : p.planned >= p.target ? "Fully planned" : p.planned ? `${p.target - p.planned} still to plan` : "Not started";
  return (
    <Link href={href({ brand: b.id, month })} className={`group flex flex-col p-5 transition duration-300 hover:-translate-y-1 ${dark ? DARK : "card hover:shadow-[0_20px_40px_-22px_rgb(0_0_0/0.3)]"}`}>
      <div className="flex items-start gap-3">
        <BrandMark name={b.name} size={40} />
        <div className="min-w-0 flex-1">
          {dark && (
            <span className="mb-0.5 flex items-center gap-1.5 text-[11px] text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Furthest along
            </span>
          )}
          <div className="truncate text-[16px] font-medium tracking-[-0.01em]">{b.name}</div>
          <div className={`text-[11.5px] ${!dark && p.target && !p.planned ? "text-brand" : muted}`}>{note}</div>
        </div>
        <Ring pct={pct} light={dark} />
      </div>

      <div className="mt-4 flex items-end gap-2">
        <span className="text-[34px] font-light leading-none tabular-nums tracking-[-0.03em]">{p.planned}</span>
        <span className={`mb-1 text-[12px] ${muted}`}>{p.target ? `of ${p.target} posts planned` : "posts planned"}</span>
      </div>

      <ul className="mt-4 flex flex-col gap-2.5">
        {p.rows.map((r) => {
          const of = Math.max(r.target, r.planned, 1);
          return (
            <li key={r.kind} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3 text-[11.5px]">
              <span className={`truncate ${muted}`}>{kindPlural(r.kind)}</span>
              <HatchBar pct={(r.planned / of) * 100} className="h-2" light={dark} />
              <span className="text-right tabular-nums">
                <b className="font-medium">{r.planned}</b>
                {r.target ? <span className={muted}>/{r.target}</span> : ""}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto grid grid-cols-2 gap-1.5 pt-4">
        {[
          ["Assigned", p.assigned, ""],
          ["Done", p.done, "text-emerald-500"],
        ].map(([l, v, tone]) => (
          <span key={l} className={`flex items-center justify-between rounded-xl px-3 py-2 text-[11px] ${dark ? "bg-white/10 text-white/60" : "bg-panel-2 text-muted"}`}>
            {l}
            <b className={`text-[13px] font-medium tabular-nums ${v && tone ? tone : dark ? "text-white" : "text-ink"}`}>{v}</b>
          </span>
        ))}
      </div>
      {plan?.inherited && <span className={`mt-2 text-[10.5px] ${muted}`}>Targets carried over from an earlier month</span>}
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
  const live = rows.filter((r) => r.p.target || r.p.planned).sort((x, y) => share(y.p) - share(x.p) || y.p.planned - x.p.planned);
  const idle = rows.filter((r) => !r.p.target && !r.p.planned);
  const sum = (f) => live.reduce((n, r) => n + r.p[f], 0);
  const target = sum("target");
  const planned = sum("planned");
  const pct = target ? Math.min(100, Math.round((planned / target) * 100)) : 0;
  const behind = live.filter((r) => r.p.target && r.p.planned < r.p.target).sort((x, y) => share(x.p) - share(y.p));
  const lead = live[0] && share(live[0].p) > 0 ? live[0].b.id : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 xl:grid-cols-12">
        {/* Hero */}
        <section className="card p-5 xl:col-span-8">
          <p className="text-xs text-muted">
            Posts planned this month{target ? ` · target ${target}` : ""}
          </p>
          <h2 className="mt-1 text-[26px] font-normal leading-tight tracking-[-0.02em]">
            Plan every brand&apos;s <span className="text-brand">month</span>
          </h2>
          <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="text-[52px] font-normal leading-none tracking-[-0.03em] tabular-nums">{planned}</span>
            <span className="mb-1.5 text-sm text-muted">posts planned</span>
            {target > 0 && <span className={`mb-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${pct >= 100 ? "bg-emerald-400/15 text-emerald-500" : "bg-brand/10 text-brand"}`}>{pct}% of target</span>}
          </div>
          <div className="relative mt-8">
            <HatchBar pct={pct} />
            <span className="absolute -top-7 right-[3%] flex flex-col items-center">
              <span className="rounded-md bg-solid px-1.5 py-0.5 text-[10px] font-medium text-on-solid">Target {target}</span>
              <span className="h-6 w-px bg-ink" />
            </span>
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            <Tile icon="calendar" label="Brands with a plan" value={live.length} note={`of ${rows.length} brands`} />
            <Tile icon="team" label="Assigned" value={sum("assigned")} note="given to the team" />
            <Tile icon="check" label="Done" value={sum("done")} note="posted or approved" />
          </div>
        </section>

        {/* Still to plan */}
        <section className="card-coral flex flex-col p-5 xl:col-span-4">
          <h2 className="text-xl font-normal tracking-[-0.01em]">Still to plan</h2>
          <div className="mt-5 flex items-end gap-2">
            <span className="text-[64px] font-light leading-none tabular-nums">{behind.length + idle.length}</span>
            <span className="mb-2 text-xs leading-tight text-white/80">
              of {rows.length}
              <br />
              brands
            </span>
          </div>
          <p className="mt-1 text-[11px] text-white/75">Behind on posts, or no plan set yet</p>
          <div className="mt-auto flex flex-col gap-2.5 pt-5">
            {behind.slice(0, 4).map(({ b, p }) => (
              <Link key={b.id} href={href({ brand: b.id, month })} className="flex items-center gap-3 text-[11px] hover:opacity-90">
                <span className="w-24 shrink-0 truncate text-white/90">{b.name}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
                  <span className="block h-full rounded-full bg-white" style={{ width: `${share(p)}%` }} />
                </span>
                <span className="w-9 text-right font-medium tabular-nums">
                  {p.planned}/{p.target}
                </span>
              </Link>
            ))}
            {idle.length > 0 && <p className="text-[11px] text-white/85">+ {idle.length} brands with no plan yet — set them below</p>}
            {!behind.length && !idle.length && <p className="text-[12px] text-white/85">Every brand is planned ✓</p>}
          </div>
        </section>
      </div>

      {live.length > 0 && (
        <div className="grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {live.map(({ b, plan, p }) => (
            <PlanCard key={b.id} b={b} plan={plan} p={p} month={month} dark={b.id === lead} />
          ))}
        </div>
      )}

      {idle.length > 0 && (
        <section className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-normal tracking-[-0.01em]">No plan yet</h2>
              <p className="text-xs text-muted">Open a brand to set this month&apos;s deliverables</p>
            </div>
            <span className="grid h-9 min-w-9 place-items-center rounded-full bg-brand px-2 text-sm font-medium text-white">{idle.length}</span>
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {idle.map(({ b }) => (
              <Link key={b.id} href={href({ brand: b.id, month })} className="group flex items-center gap-3 rounded-2xl bg-panel-2 p-3 transition hover:bg-panel-3">
                <BrandMark name={b.name} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{b.name}</span>
                  <span className="block text-[11px] text-muted">Set deliverables</span>
                </span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-panel text-ink shadow-[var(--card-shadow)] transition group-hover:bg-solid group-hover:text-on-solid">
                  <Icon name="plus" size={13} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
