import Link from "next/link";
import Icon from "@/components/Icon";
import ContentCalendar from "@/components/ContentCalendar";
import { Avatar, Empty } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listBrands } from "@/lib/brands";
import { listMakers } from "@/lib/tasks";
import { loadItems, loadPlans, monthLabel, planProgress, shiftMonth, validMonth } from "@/lib/calendar";
import { kindPlural } from "@/lib/constants";
import { canAssignTasks, canEditCalendar, canSeeCalendar, canSetPlan } from "@/lib/permissions";

export const metadata = { title: "Content calendar" };

const href = (p) => {
  const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v));
  const s = q.toString();
  return `/calendar${s ? `?${s}` : ""}`;
};

function MonthNav({ month, brand }) {
  return (
    <div className="flex items-center gap-1">
      <Link href={href({ brand, month: shiftMonth(month, -1) })} className="icon-btn !h-9 !w-9" aria-label="Previous month">
        <Icon name="chevron" size={14} className="rotate-90" />
      </Link>
      <span className="min-w-[9.5rem] text-center text-sm font-medium">{monthLabel(month)}</span>
      <Link href={href({ brand, month: shiftMonth(month, 1) })} className="icon-btn !h-9 !w-9" aria-label="Next month">
        <Icon name="chevron" size={14} className="-rotate-90" />
      </Link>
    </div>
  );
}

/** Every brand's month at a glance: plan vs planned vs done. */
function Overview({ brands, plans, items, month }) {
  const rows = brands
    .map((b) => {
      const mine = items.filter((i) => i.brand_id === b.id);
      return { b, plan: plans[b.id], p: planProgress(plans[b.id], mine) };
    })
    .sort((x, y) => (x.p.target ? x.p.planned / x.p.target : 2) - (y.p.target ? y.p.planned / y.p.target : 2));
  if (!rows.length) return <div className="card"><Empty icon="brand">No onboarded brands yet.</Empty></div>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(({ b, plan, p }) => {
        const pct = p.target ? Math.min(100, Math.round((p.planned / p.target) * 100)) : 0;
        const status = !p.target ? ["No plan set", "text-muted"] : p.planned >= p.target ? ["Fully planned", "text-emerald-400"] : p.planned ? [`${p.target - p.planned} still to plan`, "text-amber-400"] : ["Calendar not started", "text-rose-400"];
        return (
          <Link key={b.id} href={href({ brand: b.id, month })} className="card card-hover flex flex-col gap-4 !rounded-3xl p-5">
            <div className="flex items-center gap-3">
              <Avatar name={b.name} size={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{b.name}</div>
                <div className={`text-xs ${status[1]}`}>{status[0]}</div>
              </div>
              <Icon name="chevron" size={14} className="-rotate-90 text-faint" />
            </div>
            <div>
              <div className="flex items-baseline justify-between text-xs text-muted">
                <span>
                  <b className="text-lg font-medium text-ink">{p.planned}</b>
                  {p.target ? ` / ${p.target}` : ""} planned
                </span>
                <span>
                  {p.assigned} assigned · {p.done} done
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2">
                <span className="bar-fill" style={{ width: `${p.target ? pct : p.planned ? 100 : 0}%` }} />
              </div>
            </div>
            {p.rows.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {p.rows.map((r) => (
                  <span key={r.kind} className="rounded-full bg-panel-2 px-2 py-0.5 text-[11px] text-muted">
                    {kindPlural(r.kind)} <b className="font-medium text-ink">{r.planned}</b>
                    {r.target ? `/${r.target}` : ""}
                  </span>
                ))}
              </div>
            )}
            {plan?.inherited && <span className="-mt-2 text-[10px] text-faint">Plan carried over from an earlier month</span>}
          </Link>
        );
      })}
    </div>
  );
}

export default async function CalendarPage({ searchParams }) {
  const me = await requireMember(canSeeCalendar);
  const sp = await searchParams;
  const month = validMonth(sp.month);
  const brands = (await listBrands()).filter((b) => b.stage === "active");
  const brand = brands.find((b) => b.id === sp.brand) || null;
  const ids = brand ? [brand.id] : brands.map((b) => b.id);
  const [items, plans, people] = await Promise.all([loadItems(ids, month), loadPlans(ids, month), brand && canAssignTasks(me) ? listMakers() : []]);

  return (
    <div className="page">
      <header className="rise flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          {brand ? (
            <Link href={href({ month })} className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink">
              <Icon name="back" size={12} /> All brands
            </Link>
          ) : (
            <p className="text-sm text-muted">Monthly plan & content</p>
          )}
          <div className="flex items-center gap-3">
            {brand && <Avatar name={brand.name} size={40} />}
            <h1 className="text-[30px] font-medium leading-tight tracking-[-0.02em] md:text-[36px]">{brand ? brand.name : "Content calendar"}</h1>
          </div>
          {!brand && <p className="mt-1 text-sm text-muted">Pick a brand to plan its month. Strategists build the calendar, heads assign each post as a task.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {brand && (
            <Link href={`/brands/${brand.id}`} className="btn-ghost btn-sm">
              <Icon name="brand" size={13} /> Brand
            </Link>
          )}
          <MonthNav month={month} brand={brand?.id} />
        </div>
      </header>

      {brand && brands.length > 1 && (
        <nav className="rise mt-5 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [animation-delay:40ms]">
          {brands.map((b) => (
            <Link key={b.id} href={href({ brand: b.id, month })} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${b.id === brand.id ? "solid" : "bg-panel text-muted hover:text-ink"}`}>
              {b.name}
            </Link>
          ))}
        </nav>
      )}

      <div className="rise mt-5 [animation-delay:80ms]">
        {brand ? (
          <ContentCalendar
            brand={{ id: brand.id, name: brand.name }}
            month={month}
            monthName={monthLabel(month)}
            items={items}
            plan={plans[brand.id] || null}
            progress={planProgress(plans[brand.id], items)}
            people={people}
            canEdit={canEditCalendar(me)}
            canAssign={canAssignTasks(me)}
            canPlan={canSetPlan(me)}
          />
        ) : (
          <Overview brands={brands} plans={plans} items={items} month={month} />
        )}
      </div>
    </div>
  );
}
