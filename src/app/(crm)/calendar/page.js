import Link from "next/link";
import Icon from "@/components/Icon";
import ContentCalendar from "@/components/ContentCalendar";
import MasterCalendar from "@/components/MasterCalendar";
import PlansOverview from "@/components/PlansOverview";
import { FilterPills } from "@/components/Desk";
import { Avatar, Empty } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listBrands } from "@/lib/brands";
import { listMakers } from "@/lib/tasks";
import { calendarLock, loadItems, loadPlans, monthLabel, planProgress, shiftMonth, validMonth } from "@/lib/calendar";
import { canAssignTasks, canEditCalendar, canSeeCalendar, canLockCalendar, canDeleteCalendar, canSetPlan } from "@/lib/permissions";

export const metadata = { title: "Content calendar" };

const href = (p) => {
  const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v));
  const s = q.toString();
  return `/calendar${s ? `?${s}` : ""}`;
};

function MonthNav({ month, brand, view }) {
  return (
    <div className="flex items-center gap-1">
      <Link href={href({ brand, view, month: shiftMonth(month, -1) })} className="icon-btn !h-9 !w-9" aria-label="Previous month">
        <Icon name="chevron" size={14} className="rotate-90" />
      </Link>
      <span className="min-w-[9.5rem] text-center text-sm font-medium">{monthLabel(month)}</span>
      <Link href={href({ brand, view, month: shiftMonth(month, 1) })} className="icon-btn !h-9 !w-9" aria-label="Next month">
        <Icon name="chevron" size={14} className="-rotate-90" />
      </Link>
    </div>
  );
}

export default async function CalendarPage({ searchParams }) {
  const me = await requireMember(canSeeCalendar);
  const sp = await searchParams;
  const month = validMonth(sp.month);
  const brands = (await listBrands()).filter((b) => b.stage === "active");
  const brand = brands.find((b) => b.id === sp.brand) || null;
  const view = !brand && sp.view === "plans" ? "plans" : "";
  const ids = brand ? [brand.id] : brands.map((b) => b.id);
  const [items, plans, people, lock] = await Promise.all([loadItems(ids, month), loadPlans(ids, month), brand && canAssignTasks(me) ? listMakers(me) : [], brand ? calendarLock(brand.id) : null]);

  return (
    <div className="page">
      <header className="rise flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          {brand ? (
            <Link href={href({ month })} className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink">
              <Icon name="back" size={12} /> All brands
            </Link>
          ) : (
            <p className="text-sm text-muted">Monthly deliverables & content</p>
          )}
          <div className="flex items-center gap-3">
            {brand && <Avatar name={brand.name} size={40} />}
            <h1 className="text-[30px] font-medium leading-tight tracking-[-0.02em] md:text-[36px]">{brand ? brand.name : "Content calendar"}</h1>
          </div>
          {!brand && <p className="mt-1 text-sm text-muted">{view ? "Each brand's monthly deliverables. Pick a brand to plan its posts." : "Every brand's posts in one calendar. Click a day to see what's going out."}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {brand && (
            <Link href={`/brands/${brand.id}`} className="btn-ghost btn-sm">
              <Icon name="brand" size={13} /> Brand
            </Link>
          )}
          {!brand && (
            <FilterPills
              items={[
                { label: "All brands calendar", href: href({ month }), on: !view },
                { label: "Brand plans", href: href({ month, view: "plans" }), on: view === "plans" },
              ]}
            />
          )}
          <MonthNav month={month} brand={brand?.id} view={view} />
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
            lock={lock}
            canLock={canLockCalendar(me)}
              canDelete={canDeleteCalendar(me)}
          />
        ) : view === "plans" ? (
          <PlansOverview brands={brands} plans={plans} items={items} month={month} />
        ) : brands.length ? (
          <MasterCalendar month={month} brands={brands.map((b) => ({ id: b.id, name: b.name }))} items={items} />
        ) : (
          <div className="card">
            <Empty icon="calendar">No onboarded brands yet — the calendar fills up once brands sign and posts are planned.</Empty>
          </div>
        )}
      </div>
    </div>
  );
}
